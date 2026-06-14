import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Repository } from "@/server/repository/types";

/**
 * Integration test for the Postgres repository's concurrency safety. Skipped
 * unless TEST_DATABASE_URL points at a throwaway pgvector database with the
 * migrations applied:
 *
 *   docker run -d --name pl-test-pg -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=proofline_test -p 55432:5432 pgvector/pgvector:pg16
 *   DATABASE_URL=postgres://postgres:test@localhost:55432/proofline_test npm run db:migrate
 *   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/proofline_test npm test -- pg-concurrency
 *
 * Proves the lost-update race (two writers read the same messages array, second
 * write clobbers the first) is closed by the SELECT … FOR UPDATE row lock.
 */
const TEST_URL = process.env.TEST_DATABASE_URL;
const suite = TEST_URL ? describe : describe.skip;

suite("PgRepository concurrency (integration)", () => {
  let repo: Repository;
  let closeDb: () => Promise<void>;
  let wsId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    process.env.EMBEDDINGS_PROVIDER = "local"; // no network on seed corpus ingest
    const [{ PgRepository }, client] = await Promise.all([
      import("@/server/repository/pg"),
      import("@/server/db/client"),
    ]);
    closeDb = client.closeDb;
    repo = new PgRepository();
    const created = await repo.createUserWithWorkspace({
      email: `conc_${Date.now()}@test.local`,
      name: "Concurrency Test",
      passwordHash: "x",
    });
    wsId = created.workspaceId;
  }, 60_000);

  afterAll(async () => {
    if (closeDb) await closeDb();
  });

  it("does not lose messages under 20 concurrent addReply calls", async () => {
    const opened = await repo.ingestInboundEmail(wsId, {
      messageId: "<seed@m>",
      threadId: `t_replies_${Date.now()}`,
      from: "ada@customer.com",
      fromName: "Ada",
      subject: "Concurrent replies",
      body: "opening message",
    });
    const id = opened.ticketId;

    const N = 20;
    await Promise.all(Array.from({ length: N }, (_, i) => repo.addReply(wsId, id, `reply-${i}`, false, "Agent")));

    const ticket = await repo.findTicket(wsId, id);
    const replies = (ticket?.messages ?? []).filter((m) => m.kind === "agent");
    expect(replies).toHaveLength(N); // none clobbered by a racing writer
    expect(new Set(replies.map((m) => m.text)).size).toBe(N); // all distinct, none duplicated
  }, 30_000);

  it("opens exactly one ticket when the same new Gmail thread is ingested concurrently", async () => {
    const threadId = `race_${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repo.ingestInboundEmail(wsId, {
          messageId: `<m${i}@x>`,
          threadId,
          from: "carol@customer.com",
          fromName: "Carol",
          subject: "Race",
          body: `body ${i}`,
        }),
      ),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1); // one winner created the ticket
    expect(new Set(results.map((r) => r.ticketId)).size).toBe(1); // all map to the same ticket

    const ticket = await repo.findTicket(wsId, results[0]!.ticketId);
    const customerMsgs = (ticket?.messages ?? []).filter((m) => m.kind === "customer");
    expect(customerMsgs).toHaveLength(5); // 1 opener + 4 appended, none lost
  }, 30_000);

  it("dedupes a repeated messageId across concurrent ingests", async () => {
    const threadId = `dup_${Date.now()}`;
    await repo.ingestInboundEmail(wsId, { messageId: "<once@m>", threadId, from: "e@f.com", fromName: "E", subject: "Dup", body: "hello" });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        repo.ingestInboundEmail(wsId, { messageId: "<once@m>", threadId, from: "e@f.com", fromName: "E", subject: "Dup", body: "hello again" }),
      ),
    );
    expect(results.every((r) => r.duplicate)).toBe(true);
    const ticket = await repo.findTicket(wsId, results[0]!.ticketId);
    expect((ticket?.messages ?? []).filter((m) => m.kind === "customer")).toHaveLength(1); // not re-appended
  }, 30_000);
});

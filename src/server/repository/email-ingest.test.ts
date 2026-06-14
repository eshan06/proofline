import { describe, it, expect } from "vitest";
import { MemoryRepository } from "@/server/repository/memory";
import type { InboundEmail } from "@/server/email/gmail";

function inbound(over: Partial<InboundEmail> = {}): InboundEmail {
  return {
    messageId: "<m1@mail>",
    threadId: "thread-A",
    from: "ada@customer.com",
    fromName: "Ada Lovelace",
    subject: "Need a refund",
    body: "I was double charged, please help.",
    ...over,
  };
}

let wsSeq = 0;
const newWs = () => `ws_email_test_${++wsSeq}`;

describe("ingestInboundEmail (memory)", () => {
  it("opens a new email ticket for a new thread", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const res = await repo.ingestInboundEmail(ws, inbound());
    expect(res).toMatchObject({ created: true, duplicate: false });

    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === res.ticketId)!;
    expect(t.channel).toBe("email");
    expect(t.customer.company).toBe("ada@customer.com"); // sender address stashed for outbound
    expect(t.subject).toBe("Need a refund");
    expect(t.tags).toContain("email");
    expect(t.messages).toHaveLength(1);
    expect(t.messages[0]).toMatchObject({ kind: "customer", text: "I was double charged, please help." });
  });

  it("appends a reply in the same thread to the same ticket", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const first = await repo.ingestInboundEmail(ws, inbound({ messageId: "<m1@mail>" }));
    const second = await repo.ingestInboundEmail(ws, inbound({ messageId: "<m2@mail>", body: "Any update?" }));
    expect(second.ticketId).toBe(first.ticketId);
    expect(second).toMatchObject({ created: false, duplicate: false });

    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === first.ticketId)!;
    expect(t.messages.filter((m) => m.kind === "customer")).toHaveLength(2);
    expect(t.status).toBe("open");
    expect(t.unread).toBe(true);
  });

  it("dedupes a repeated messageId (idempotent polling)", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const first = await repo.ingestInboundEmail(ws, inbound({ messageId: "<dup@mail>" }));
    const dup = await repo.ingestInboundEmail(ws, inbound({ messageId: "<dup@mail>" }));
    expect(dup).toMatchObject({ ticketId: first.ticketId, created: false, duplicate: true });

    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === first.ticketId)!;
    expect(t.messages.filter((m) => m.kind === "customer")).toHaveLength(1); // not appended twice
  });

  it("separate Gmail threads become separate tickets", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const a = await repo.ingestInboundEmail(ws, inbound({ threadId: "thread-A", messageId: "<a@mail>" }));
    const b = await repo.ingestInboundEmail(ws, inbound({ threadId: "thread-B", messageId: "<b@mail>" }));
    expect(a.ticketId).not.toBe(b.ticketId);
    expect(b.created).toBe(true);
  });

  it("exposes thread metadata for outbound replies (latest inbound messageId)", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const r = await repo.ingestInboundEmail(ws, inbound({ messageId: "<m1@mail>" }));
    await repo.ingestInboundEmail(ws, inbound({ messageId: "<m2@mail>", body: "ping" }));
    const ref = await repo.getEmailThread(ws, r.ticketId);
    expect(ref).toEqual({ gmailThreadId: "thread-A", customerEmail: "ada@customer.com", lastInboundMessageId: "<m2@mail>" });
  });

  it("getEmailThread is null for a non-email ticket id", async () => {
    const repo = new MemoryRepository();
    expect(await repo.getEmailThread(newWs(), "TKT-nope")).toBeNull();
  });
});

describe("gmail account (memory)", () => {
  it("stores, resolves (case-insensitively), and clears the account", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    expect(await repo.getGmailAccount(ws)).toBeNull();

    await repo.setGmailAccount(ws, { refreshToken: "rt-123", address: "Support@Acme.com" });
    expect(await repo.getGmailAccount(ws)).toEqual({ refreshToken: "rt-123", address: "support@acme.com" });
    expect(await repo.resolveGmailWorkspace("SUPPORT@acme.com")).toBe(ws);
    expect(await repo.resolveGmailWorkspace("unknown@x.com")).toBeNull();

    await repo.clearGmailAccount(ws);
    expect(await repo.getGmailAccount(ws)).toBeNull();
  });
});

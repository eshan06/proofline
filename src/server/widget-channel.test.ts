import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryRepository } from "@/server/repository/memory";
import { clientKey } from "@/server/rate-limit";
import { secureToken } from "@/lib/utils";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x/api", { headers });
}

describe("secureToken", () => {
  it("is unguessable hex of the requested byte length, and unique per call", () => {
    const a = secureToken(18);
    const b = secureToken(18);
    expect(a).toMatch(/^[0-9a-f]{36}$/);
    expect(a).not.toEqual(b);
  });
});

describe("clientKey — x-forwarded-for spoof resistance", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_PROXY_HOPS;
  });

  it("ignores the client-controlled leftmost XFF entry, trusting the rightmost by default", () => {
    // "1.1.1.1" is attacker-supplied; the nearest proxy appends the real source last.
    const k = clientKey(reqWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 9.9.9.9" }), "login");
    expect(k).toBe("login:9.9.9.9");
  });

  it("honors RATE_LIMIT_PROXY_HOPS for deeper proxy chains", () => {
    process.env.RATE_LIMIT_PROXY_HOPS = "2";
    const k = clientKey(reqWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 9.9.9.9" }), "login");
    expect(k).toBe("login:2.2.2.2");
  });

  it("falls back to x-real-ip, then to a shared 'unknown' bucket", () => {
    expect(clientKey(reqWith({ "x-real-ip": "5.5.5.5" }), "ai")).toBe("ai:5.5.5.5");
    expect(clientKey(reqWith({}), "ai")).toBe("ai:unknown");
  });
});

describe("website chat channel (in-memory backend)", () => {
  let repo: MemoryRepository;
  let workspaceId: string;
  let siteKey: string;

  beforeEach(async () => {
    repo = new MemoryRepository();
    workspaceId = await repo.createDemoWorkspace();
    siteKey = (await repo.getWorkspace(workspaceId)).widget.siteKey;
  });

  it("exposes a resolvable, non-empty site key", async () => {
    expect(siteKey).toMatch(/^[0-9a-f]+$/);
    expect((await repo.resolveSiteKey(siteKey))?.workspaceId).toBe(workspaceId);
    expect(await repo.resolveSiteKey("not-a-real-key")).toBeNull();
  });

  it("creates a web ticket from an inbound message and rounds agent replies back to the visitor", async () => {
    const { token, ticketId } = await repo.startWidgetConversation(workspaceId, { name: "Dana" }, "I need a refund");

    const ticket = await repo.findTicket(workspaceId, ticketId);
    expect(ticket?.channel).toBe("web");
    expect(ticket?.status).toBe("open");
    expect(ticket?.messages[0]?.text).toBe("I need a refund");

    // An approved agent reply must appear in the visitor-facing transcript.
    await repo.addReply(workspaceId, ticketId, "Happy to help, Dana — refund issued.", false, "Maya");
    const transcript = await repo.getWidgetTranscript(workspaceId, token);
    expect(transcript?.map((m) => m.role)).toEqual(["visitor", "agent"]);
    expect(transcript?.[1]?.text).toBe("Happy to help, Dana — refund issued.");

    // A follow-up visitor message threads onto the same ticket.
    expect(await repo.appendWidgetMessage(workspaceId, token, "Thanks!")).toBe(true);
    expect((await repo.getWidgetTranscript(workspaceId, token))?.length).toBe(3);
  });

  it("rejects unknown conversation tokens (no cross-conversation leakage)", async () => {
    expect(await repo.getWidgetTranscript(workspaceId, "bogus-token")).toBeNull();
    expect(await repo.appendWidgetMessage(workspaceId, "bogus-token", "hi")).toBe(false);
  });
});

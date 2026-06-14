import { describe, it, expect } from "vitest";
import { MemoryRepository } from "@/server/repository/memory";
import type { InboundSlackMessage } from "@/server/slack/slack";

function msg(over: Partial<InboundSlackMessage> = {}): InboundSlackMessage {
  return {
    channel: "C123",
    threadTs: "1700000000.0001",
    ts: "1700000000.0001",
    userId: "U1",
    userName: "Dana",
    text: "our integration is down",
    ...over,
  };
}

let wsSeq = 0;
const newWs = () => `ws_slack_test_${++wsSeq}`;

describe("ingestSlackMessage (memory)", () => {
  it("opens a new ticket for a new (channel, thread)", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const res = await repo.ingestSlackMessage(ws, msg());
    expect(res).toMatchObject({ created: true, duplicate: false });
    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === res.ticketId)!;
    expect(t.channel).toBe("slack");
    expect(t.tags).toContain("slack");
    expect(t.customer.name).toBe("Dana");
    expect(t.messages).toHaveLength(1);
  });

  it("appends later messages in the same thread to the same ticket", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const first = await repo.ingestSlackMessage(ws, msg({ ts: "1700000000.0001" }));
    const second = await repo.ingestSlackMessage(ws, msg({ ts: "1700000000.0002", text: "still down" }));
    expect(second.ticketId).toBe(first.ticketId);
    expect(second).toMatchObject({ created: false, duplicate: false });
    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === first.ticketId)!;
    expect(t.messages.filter((m) => m.kind === "customer")).toHaveLength(2);
  });

  it("dedupes a redelivered event ts", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const first = await repo.ingestSlackMessage(ws, msg({ ts: "dup.1" }));
    const dup = await repo.ingestSlackMessage(ws, msg({ ts: "dup.1" }));
    expect(dup).toMatchObject({ ticketId: first.ticketId, created: false, duplicate: true });
    const t = (await repo.getWorkspace(ws)).tickets.find((x) => x.id === first.ticketId)!;
    expect(t.messages.filter((m) => m.kind === "customer")).toHaveLength(1);
  });

  it("different threads in the same channel are different tickets", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const a = await repo.ingestSlackMessage(ws, msg({ threadTs: "t.a", ts: "t.a" }));
    const b = await repo.ingestSlackMessage(ws, msg({ threadTs: "t.b", ts: "t.b" }));
    expect(a.ticketId).not.toBe(b.ticketId);
  });

  it("exposes (channel, threadTs) for outbound replies", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    const r = await repo.ingestSlackMessage(ws, msg({ channel: "C999", threadTs: "9.9" }));
    expect(await repo.getSlackThread(ws, r.ticketId)).toEqual({ channel: "C999", threadTs: "9.9" });
    expect(await repo.getSlackThread(ws, "TKT-nope")).toBeNull();
  });
});

describe("slack account (memory)", () => {
  it("stores, resolves by team id, and clears", async () => {
    const repo = new MemoryRepository();
    const ws = newWs();
    expect(await repo.getSlackAccount(ws)).toBeNull();
    await repo.setSlackAccount(ws, { botToken: "xoxb-1", teamId: "T42", teamName: "Acme" });
    expect(await repo.getSlackAccount(ws)).toEqual({ botToken: "xoxb-1", teamId: "T42", teamName: "Acme" });
    expect(await repo.resolveSlackWorkspace("T42")).toBe(ws);
    expect(await repo.resolveSlackWorkspace("T-unknown")).toBeNull();
    await repo.clearSlackAccount(ws);
    expect(await repo.getSlackAccount(ws)).toBeNull();
  });
});

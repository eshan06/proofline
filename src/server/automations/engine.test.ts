import { describe, expect, it } from "vitest";
import {
  evaluate,
  matchesCondition,
  matchesTrigger,
  planAction,
  type TicketEvent,
} from "./engine";
import { seedTickets } from "@/data/tickets";
import { seedAutomations } from "@/data/workspace";
import type { Ticket } from "@/lib/schemas";

const ticket = (id: string): Ticket => structuredClone(seedTickets.find((t) => t.id === id)!);

const event = (over: Partial<TicketEvent> & { ticket: Ticket }): TicketEvent => ({
  kind: "ticket.created",
  ...over,
});

describe("triggers", () => {
  it("matches 'New ticket created' on creation", () => {
    expect(matchesTrigger("New ticket created", event({ ticket: ticket("TKT-1042") }))).toBe(true);
    expect(
      matchesTrigger("New ticket created", event({ kind: "draft.generated", ticket: ticket("TKT-1042") })),
    ).toBe(false);
  });

  it("matches the confidence threshold trigger only below the limit", () => {
    const low = event({ kind: "draft.generated", ticket: ticket("TKT-1038"), confidence: 0.58 });
    const high = event({ kind: "draft.generated", ticket: ticket("TKT-1042"), confidence: 0.92 });
    expect(matchesTrigger("AI confidence < 65%", low)).toBe(true);
    expect(matchesTrigger("AI confidence < 65%", high)).toBe(false);
  });

  it("matches keyword detection against subject + messages", () => {
    const trig = "Keyword detected: “login”, “password”, “2FA”";
    const loginTicket = { ...ticket("TKT-1029"), subject: "I cannot login to my account" };
    expect(matchesTrigger(trig, event({ ticket: loginTicket }))).toBe(true);
    expect(matchesTrigger(trig, event({ ticket: ticket("TKT-1031") }))).toBe(false);
  });
});

describe("conditions", () => {
  it("matches tag and channel conditions", () => {
    expect(matchesCondition("Tag is billing", event({ ticket: ticket("TKT-1042") }))).toBe(true);
    expect(matchesCondition("Tag is billing", event({ ticket: ticket("TKT-1029") }))).toBe(false);
    expect(matchesCondition("Channel is email", event({ ticket: ticket("TKT-1031") }))).toBe(true);
    expect(matchesCondition("Any channel", event({ ticket: ticket("TKT-1029") }))).toBe(true);
  });

  it("evaluates Priority ≥ high", () => {
    expect(matchesCondition("Priority ≥ high", event({ ticket: ticket("TKT-1042") }))).toBe(true); // urgent
    expect(matchesCondition("Priority ≥ high", event({ ticket: ticket("TKT-1029") }))).toBe(false); // low
  });

  it("matches customer plan from the joined event", () => {
    const e = event({ ticket: ticket("TKT-1031"), customerPlan: "Scale" });
    expect(matchesCondition("Customer plan is Scale", e)).toBe(true);
    expect(matchesCondition("Customer plan is Enterprise", e)).toBe(false);
  });

  it("parses dollar amounts mentioned in the thread", () => {
    const big = { ...ticket("TKT-1031"), subject: "Refund needed for $750 overcharge" };
    expect(matchesCondition("Amount mentioned > $500", event({ ticket: big }))).toBe(true);
    expect(matchesCondition("Amount mentioned > $500", event({ ticket: ticket("TKT-1031") }))).toBe(false);
  });

  it("fails closed on an unknown condition", () => {
    expect(matchesCondition("Phase of the moon is full", event({ ticket: ticket("TKT-1042") }))).toBe(false);
  });
});

describe("actions", () => {
  it("plans a tag mutation", () => {
    const t = ticket("TKT-1029");
    const action = planAction("Add tag: login");
    action.mutate?.(t);
    expect(t.tags).toContain("login");
  });

  it("plans an escalation mutation", () => {
    const t = ticket("TKT-1029");
    planAction("Escalate to engineering").mutate?.(t);
    expect(t.status).toBe("escalated");
    expect(t.stage).toBe("escalated");
  });
});

describe("evaluate — the low-confidence safety net (a4)", () => {
  const safetyNet = seedAutomations.find((a) => a.id === "a4")!;

  it("fires and holds the draft when confidence is below 65%", () => {
    const r = evaluate(safetyNet, event({ kind: "draft.generated", ticket: ticket("TKT-1038"), confidence: 0.58 }));
    expect(r.fired).toBe(true);
    expect(r.logLine).toBe("TKT-1038 · draft held at 58% confidence");
  });

  it("does not fire for a high-confidence draft", () => {
    const r = evaluate(safetyNet, event({ kind: "draft.generated", ticket: ticket("TKT-1042"), confidence: 0.92 }));
    expect(r.fired).toBe(false);
  });

  it("does not fire when disabled", () => {
    const r = evaluate({ ...safetyNet, enabled: false }, event({ kind: "draft.generated", ticket: ticket("TKT-1038"), confidence: 0.58 }));
    expect(r.fired).toBe(false);
  });
});

describe("evaluate — billing escalation (a1) condition reporting", () => {
  const billing = seedAutomations.find((a) => a.id === "a1")!;

  it("reports a condition-not-met when no amount is present", () => {
    const r = evaluate(billing, event({ ticket: ticket("TKT-1042") }));
    expect(r.fired).toBe(false);
    expect(r.logLine).toContain("condition not met");
  });

  it("fires when a billing ticket mentions an amount over the limit", () => {
    const big = { ...ticket("TKT-1042"), subject: "Charged $640 twice on billing" };
    const r = evaluate(billing, event({ ticket: big }));
    expect(r.fired).toBe(true);
    expect(big.status).toBe("escalated");
  });
});

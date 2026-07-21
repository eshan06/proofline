import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { MemoryRepository } from "@/server/repository/memory";
import { isEntitled, effectiveSeatLimit } from "@/server/billing/plans";

/**
 * Regression tests for the go-live hardening pass: entitlement gating, seat &
 * last-admin invariants, single-use invites, KB delete, the per-workspace AI
 * budget, Stripe webhook idempotency + ordering. All run against the in-memory
 * repo (the default test backend); the Postgres repo mirrors the same contracts.
 */

function freshOwner(r: MemoryRepository, tag: string) {
  return r.createUserWithWorkspace({ email: `owner-${tag}@x.com`, name: "Owner", passwordHash: "h" });
}

describe("plan entitlement helpers", () => {
  it("only active/trialing are entitled", () => {
    expect(isEntitled("active")).toBe(true);
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("past_due")).toBe(false);
    expect(isEntitled("canceled")).toBe(false);
  });
  it("delinquent/cancelled drops to the Free seat limit", () => {
    expect(effectiveSeatLimit("Scale", "active")).toBe(50);
    expect(effectiveSeatLimit("Growth", "active")).toBe(10);
    expect(effectiveSeatLimit("Scale", "past_due")).toBe(2);
    expect(effectiveSeatLimit("Growth", "canceled")).toBe(2);
  });
});

describe("last-admin invariant (guarded member ops)", () => {
  it("blocks removing or demoting the only active Admin, but allows it once a second exists", async () => {
    const r = new MemoryRepository();
    const { user, workspaceId } = await freshOwner(r, "lastadmin");

    await expect(r.removeMemberGuarded(workspaceId, user.id)).rejects.toThrow(/last Admin/i);
    await expect(r.updateMemberRoleGuarded(workspaceId, user.id, "Agent")).rejects.toThrow(/last Admin/i);

    await r.inviteMember(workspaceId, "two@x.com", "Admin");
    const second = await r.acceptInvite({ workspaceId, email: "two@x.com", role: "Admin" });

    // Two admins now → removing the owner is allowed.
    await expect(r.removeMemberGuarded(workspaceId, user.id)).resolves.toBeTruthy();
    // Back to one → the invariant holds again.
    await expect(r.removeMemberGuarded(workspaceId, second.userId)).rejects.toThrow(/last Admin/i);
  });
});

describe("seat-limit guard (invite)", () => {
  it("rejects an invite that would exceed the seat limit", async () => {
    const r = new MemoryRepository();
    const { workspaceId } = await freshOwner(r, "seat");
    await expect(r.inviteMemberGuarded(workspaceId, "a@x.com", "Agent", 1)).resolves.toBeTruthy();
    await expect(r.inviteMemberGuarded(workspaceId, "b@x.com", "Agent", 1)).rejects.toThrow(/seat/i);
  });
});

describe("invite acceptance is single-use (strict mode)", () => {
  it("accepts a pending invite once, then rejects replays and forged emails", async () => {
    const r = new MemoryRepository();
    const { workspaceId } = await freshOwner(r, "invite");
    await r.inviteMember(workspaceId, "c@x.com", "Agent");

    await expect(r.acceptInvite({ workspaceId, email: "c@x.com", role: "Agent", seatLimit: 10 })).resolves.toBeTruthy();
    // Replay after acceptance → no longer pending.
    await expect(r.acceptInvite({ workspaceId, email: "c@x.com", role: "Agent", seatLimit: 10 })).rejects.toThrow(/no longer valid/i);
    // Never-invited email with a (forged-but-valid) token → rejected.
    await expect(r.acceptInvite({ workspaceId, email: "nobody@x.com", role: "Agent", seatLimit: 10 })).rejects.toThrow(/no longer valid/i);
  });

  it("rejects acceptance that would exceed the seat limit", async () => {
    const r = new MemoryRepository();
    const { workspaceId } = await freshOwner(r, "inviteseat");
    // Exercise both sides of the boundary: below the limit succeeds, at it rejects.
    await r.inviteMember(workspaceId, "d@x.com", "Agent");
    await expect(r.acceptInvite({ workspaceId, email: "d@x.com", role: "Agent", seatLimit: 1 })).resolves.toBeTruthy();
    await r.inviteMember(workspaceId, "e@x.com", "Agent");
    await expect(r.acceptInvite({ workspaceId, email: "e@x.com", role: "Agent", seatLimit: 1 })).rejects.toThrow(/seat limit/i);
  });
});

describe("KB document delete", () => {
  it("removes a doc and is idempotent-safe (re-delete 404s)", async () => {
    const r = new MemoryRepository();
    const { workspaceId } = await freshOwner(r, "kb");
    const doc = await r.addKbDoc(workspaceId, { name: "policy.txt", source: "Upload", status: "indexed", chunks: "3", cited: "0", synced: "now" });
    await expect(r.deleteKbDoc(workspaceId, doc.id)).resolves.toBeUndefined();
    await expect(r.deleteKbDoc(workspaceId, doc.id)).rejects.toThrow(/Unknown document/i);
  });
});

describe("per-workspace daily AI budget", () => {
  it("allows up to the limit, then denies", async () => {
    const r = new MemoryRepository();
    const { workspaceId } = await freshOwner(r, "aibudget");
    expect(await r.consumeWorkspaceAiCall(workspaceId, 2)).toBe(true);
    expect(await r.consumeWorkspaceAiCall(workspaceId, 2)).toBe(true);
    expect(await r.consumeWorkspaceAiCall(workspaceId, 2)).toBe(false);
  });
});

describe("Stripe event idempotency ledger", () => {
  it("returns true the first time and false on replay", async () => {
    const r = new MemoryRepository();
    const id = `evt_${crypto.randomUUID()}`;
    expect(await r.markStripeEventProcessed(id, "checkout.session.completed")).toBe(true);
    expect(await r.markStripeEventProcessed(id, "checkout.session.completed")).toBe(false);
  });
});

describe("Stripe webhook: idempotency + ordering", () => {
  const SECRET = "whsec_hardening_test";
  function signed(obj: unknown): { body: string; sig: string } {
    const body = JSON.stringify(obj);
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
    return { body, sig: `t=${t},v1=${v1}` };
  }

  beforeAll(() => {
    process.env.BILLING_PROVIDER = "stripe";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_PRICE_GROWTH = "price_g";
    process.env.STRIPE_PRICE_SCALE = "price_s";
  });

  it("applies a checkout event once, ignores its replay, and ignores stale out-of-order updates", async () => {
    const { billing } = await import("@/server/billing");
    const { repo } = await import("@/server/repository");
    const b = billing();
    const wsId = `ws_wh_${crypto.randomUUID().slice(0, 8)}`;

    const checkout = signed({
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      created: 1000,
      data: { object: { client_reference_id: wsId, metadata: { plan: "Scale" }, customer: "cus_1", subscription: "sub_1" } },
    });
    const r1 = await b.handleWebhook(checkout.body, checkout.sig);
    expect(r1.handled).toBe(true);
    expect((await repo().getSubscription(wsId)).plan).toBe("Scale");

    // Replay the same event id → deduped, not applied again.
    const r2 = await b.handleWebhook(checkout.body, checkout.sig);
    expect(r2.handled).toBe(false);

    // Newer active update (created=3000) then a STALE past_due (created=2000).
    const active = signed({
      id: "evt_active", type: "customer.subscription.updated", created: 3000,
      data: { object: { metadata: { workspaceId: wsId }, status: "active", items: { data: [{ price: { id: "price_s" } }] } } },
    });
    await b.handleWebhook(active.body, active.sig);
    expect((await repo().getSubscription(wsId)).status).toBe("active");

    const stalePastDue = signed({
      id: "evt_pastdue", type: "customer.subscription.updated", created: 2000,
      data: { object: { metadata: { workspaceId: wsId }, status: "past_due", items: { data: [{ price: { id: "price_s" } }] } } },
    });
    const r3 = await b.handleWebhook(stalePastDue.body, stalePastDue.sig);
    expect(r3.handled).toBe(false); // older than the applied event → ignored
    expect((await repo().getSubscription(wsId)).status).toBe("active"); // not clobbered
  });

  it("a redelivery after a transient apply failure is processed, not deduped away", async () => {
    const { billing } = await import("@/server/billing");
    const { repo } = await import("@/server/repository");
    const b = billing();
    const wsId = `ws_retry_${crypto.randomUUID().slice(0, 8)}`;
    const evt = signed({
      id: `evt_retry_${crypto.randomUUID().slice(0, 8)}`,
      type: "checkout.session.completed",
      created: 1000,
      data: { object: { client_reference_id: wsId, metadata: { plan: "Growth" }, customer: "cus_r", subscription: "sub_r" } },
    });

    // First delivery: the state write fails AFTER the idempotency mark. The
    // handler must throw (route → 500 → Stripe retries) and un-mark the event.
    const inst = repo();
    const original = inst.setSubscription;
    inst.setSubscription = async () => { throw new Error("transient DB failure"); };
    try {
      await expect(b.handleWebhook(evt.body, evt.sig)).rejects.toThrow(/transient/);
    } finally {
      inst.setSubscription = original;
    }

    // Stripe redelivers the SAME event id: it must apply, not hit the dedup path.
    const retry = await b.handleWebhook(evt.body, evt.sig);
    expect(retry.handled).toBe(true);
    expect((await repo().getSubscription(wsId)).plan).toBe("Growth");
  });
});

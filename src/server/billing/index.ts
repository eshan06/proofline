import crypto from "node:crypto";
import { logger } from "@/server/logger";
import { repo } from "@/server/repository";
import { planForPrice, planSeatLimit, type PlanName } from "./plans";

/**
 * Billing provider. The product depends only on this interface; the mock keeps
 * the billing UI clickable with no Stripe account (and persists the chosen plan
 * so plan/seat gating is exercised end-to-end in dev), and the real Stripe
 * implementation slots in behind BILLING_PROVIDER=stripe + keys. Subscription
 * state is persisted by the repository; this layer only talks to Stripe.
 */
export interface CheckoutInput {
  workspaceId: string;
  plan: "growth" | "scale";
  successUrl: string;
  cancelUrl: string;
}

export interface WebhookResult {
  type: string;
  handled: boolean;
}

export interface PortalInput {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  /** Create a Stripe Customer Portal session for an existing subscriber. */
  portal(input: PortalInput): Promise<{ url: string }>;
  /** Verify the signature and parse the event; persist any subscription change. Throws on bad signature. */
  handleWebhook(payload: string, signature: string | null): Promise<WebhookResult>;
  /**
   * Cancel a live subscription (on workspace/account deletion) so a deleted
   * customer is not billed again. Best-effort: callers log and continue on error
   * so deletion is never blocked by a billing outage. No-op if id is null.
   */
  cancelSubscription(stripeSubscriptionId: string | null): Promise<void>;
  /** Delete the Stripe customer (erases their PII at the sub-processor). Best-effort; no-op if id is null. */
  deleteCustomer(stripeCustomerId: string | null): Promise<void>;
}

/**
 * Thrown when a Stripe webhook signature is missing/invalid. The route maps this
 * to a 400 (and does NOT alert): the request is untrusted, not a server fault.
 * Any OTHER error from handleWebhook is an internal failure → 500 + alert + retry.
 */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

const planName = (p: "growth" | "scale"): PlanName => (p === "scale" ? "Scale" : "Growth");

class MockBillingProvider implements BillingProvider {
  async createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
    // No Stripe round-trip in mock mode, so persist the upgrade immediately —
    // this is what makes the plan/seat gating real and testable without keys.
    const plan = planName(input.plan);
    await repo().setSubscription(input.workspaceId, { plan, status: "active", seats: planSeatLimit(plan) });
    logger.info("billing.mock_checkout", { workspaceId: input.workspaceId, plan });
    return { url: `${input.successUrl}?mock_checkout=1&plan=${input.plan}` };
  }

  async portal(input: PortalInput): Promise<{ url: string }> {
    logger.info("billing.mock_portal", { customerId: input.stripeCustomerId });
    return { url: input.returnUrl };
  }

  async handleWebhook(payload: string): Promise<WebhookResult> {
    let type = "unknown";
    try {
      type = (JSON.parse(payload) as { type?: string }).type ?? "unknown";
    } catch {
      /* non-JSON test ping */
    }
    logger.info("billing.webhook", { type, mode: "mock" });
    return { type, handled: true };
  }

  async cancelSubscription(stripeSubscriptionId: string | null): Promise<void> {
    if (stripeSubscriptionId) logger.info("billing.mock_cancel", { stripeSubscriptionId });
  }
  async deleteCustomer(stripeCustomerId: string | null): Promise<void> {
    if (stripeCustomerId) logger.info("billing.mock_delete_customer", { stripeCustomerId });
  }
}

class StripeBillingProvider implements BillingProvider {
  constructor(private secretKey: string, private webhookSecret: string) {}

  async createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
    const plan = planName(input.plan);
    const price = input.plan === "scale" ? process.env.STRIPE_PRICE_SCALE : process.env.STRIPE_PRICE_GROWTH;
    if (!price) throw new Error("Stripe price id not configured (STRIPE_PRICE_GROWTH / STRIPE_PRICE_SCALE).");
    const seats = planSeatLimit(plan);
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", input.successUrl);
    form.set("cancel_url", input.cancelUrl);
    form.set("client_reference_id", input.workspaceId);
    form.set("line_items[0][price]", price);
    form.set("line_items[0][quantity]", String(seats));
    // Session metadata (for checkout.session.completed) + subscription metadata
    // (copied onto the subscription, for customer.subscription.* events).
    form.set("metadata[workspaceId]", input.workspaceId);
    form.set("metadata[plan]", plan);
    form.set("subscription_data[metadata][workspaceId]", input.workspaceId);
    form.set("subscription_data[metadata][plan]", plan);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      logger.error("billing.stripe_checkout_error", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) });
      throw new Error("Could not create Stripe checkout session.");
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: data.url };
  }

  async portal(input: PortalInput): Promise<{ url: string }> {
    const form = new URLSearchParams();
    form.set("customer", input.stripeCustomerId);
    form.set("return_url", input.returnUrl);
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      logger.error("billing.stripe_portal_error", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) });
      throw new Error("Could not create Stripe billing portal session.");
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe did not return a portal URL.");
    return { url: data.url };
  }

  async handleWebhook(payload: string, signature: string | null): Promise<WebhookResult> {
    const event = verifyStripeSignature(payload, signature, this.webhookSecret);
    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const customerId = typeof obj.customer === "string" ? obj.customer : null;
    const subscriptionId =
      typeof obj.subscription === "string" ? obj.subscription : event.type.startsWith("customer.subscription") && typeof obj.id === "string" ? obj.id : null;

    // Resolve the workspace: prefer metadata/client_reference_id, then fall back
    // to the stored Stripe customer/subscription id so events that lack metadata
    // (e.g. edited from the Stripe Dashboard) still apply instead of being dropped.
    let workspaceId = meta.workspaceId || (typeof obj.client_reference_id === "string" ? obj.client_reference_id : "");
    if (!workspaceId) {
      workspaceId = (await repo().findWorkspaceByStripeIds({ customerId, subscriptionId })) ?? "";
    }

    if (!workspaceId) {
      // Unresolvable → warn (not info) so a silently-dropped event is visible.
      logger.warn("billing.webhook_unmatched", { type: event.type, mode: "stripe", customerId, subscriptionId });
      return { type: event.type, handled: false };
    }

    // Idempotency: skip an event id we already processed (Stripe redelivers
    // at-least-once on any non-2xx). Events without an id (shouldn't happen in
    // prod) bypass dedup but are still ordering-guarded below.
    if (event.id && !(await repo().markStripeEventProcessed(event.id, event.type))) {
      logger.info("billing.webhook_duplicate", { type: event.type, id: event.id, workspaceId });
      return { type: event.type, handled: false };
    }

    // Everything after the mark must either apply or un-mark: the route returns
    // 500 on a post-verification failure precisely so Stripe redelivers, and a
    // redelivery only helps if the failed event is no longer in the ledger.
    try {
      // Ordering guard for subscription state: ignore an event older than the last
      // one we applied (Stripe does not guarantee delivery order), so a stale
      // past_due can't clobber a newer active renewal. Events with no usable
      // `created` (never seen from Stripe in practice) apply unguarded.
      const eventAt = typeof event.created === "number" ? event.created : 0;
      const mutatesSubState =
        event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.deleted";
      if (mutatesSubState && eventAt) {
        const current = await repo().getSubscription(workspaceId).catch(() => null);
        if (current?.eventAt && eventAt < current.eventAt) {
          logger.info("billing.webhook_stale", { type: event.type, workspaceId, eventAt, lastAt: current.eventAt });
          return { type: event.type, handled: false };
        }
      }

      if (event.type === "checkout.session.completed") {
        await repo().setSubscription(workspaceId, {
          plan: (meta.plan as PlanName) || "Growth",
          status: "active",
          seats: planSeatLimit((meta.plan as string) || "Growth"),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          // Never write a 0 watermark — it would disable the guard for later events.
          ...(eventAt ? { eventAt } : {}),
        });
      } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
        const item = (((obj.items as Record<string, unknown>)?.data as unknown[])?.[0] ?? {}) as Record<string, unknown>;
        const priceId = (item.price as Record<string, unknown>)?.id as string | undefined;
        const plan = planForPrice(priceId) ?? (meta.plan as PlanName) ?? "Growth";
        // current_period_end moved from the Subscription to the SubscriptionItem in
        // newer Stripe API versions — read the nested value, falling back to top-level.
        const rawPeriodEnd =
          typeof item.current_period_end === "number" ? item.current_period_end : typeof obj.current_period_end === "number" ? obj.current_period_end : undefined;
        const periodEnd = rawPeriodEnd !== undefined ? new Date(rawPeriodEnd * 1000).toISOString() : undefined;
        await repo().setSubscription(workspaceId, {
          plan,
          // Keep the full status union — don't coerce trialing/past_due/canceled to active.
          status: (obj.status as "active" | "trialing" | "past_due" | "canceled") ?? "active",
          seats: planSeatLimit(plan),
          ...(eventAt ? { eventAt } : {}),
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
          // Persist the Stripe ids here too, not only at checkout: if the checkout
          // event was lost/unmatched, the portal, deletion cleanup, and the
          // stored-id fallback above would otherwise never work for this tenant.
          ...(customerId ? { stripeCustomerId: customerId } : {}),
          ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
        });
      } else if (event.type === "customer.subscription.deleted") {
        // Cancellation drops paid entitlements back to Free.
        await repo().setSubscription(workspaceId, { plan: "Free", status: "canceled", seats: planSeatLimit("Free"), ...(eventAt ? { eventAt } : {}) });
      }
    } catch (err) {
      // Un-mark so Stripe's redelivery is processed instead of deduped away.
      if (event.id) await repo().unmarkStripeEventProcessed(event.id).catch(() => {});
      throw err;
    }
    logger.info("billing.webhook", { type: event.type, mode: "stripe", workspaceId });
    return { type: event.type, handled: true };
  }

  async cancelSubscription(stripeSubscriptionId: string | null): Promise<void> {
    if (!stripeSubscriptionId) return;
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) {
      throw new Error(`Stripe subscription cancel failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
  }

  async deleteCustomer(stripeCustomerId: string | null): Promise<void> {
    if (!stripeCustomerId) return;
    const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(stripeCustomerId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) {
      throw new Error(`Stripe customer delete failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
  }
}

interface StripeEvent {
  id?: string;
  type: string;
  created?: number;
  data?: { object?: unknown };
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header) without the
 * SDK — the documented HMAC-SHA256 over `${timestamp}.${payload}` compared in
 * constant time, with a 5-minute replay tolerance. Throws WebhookSignatureError
 * on any mismatch (the route maps that to 400, not a server error).
 */
export function verifyStripeSignature(payload: string, sigHeader: string | null, secret: string): StripeEvent {
  if (!sigHeader) throw new WebhookSignatureError("Missing Stripe-Signature header.");
  // Collect ALL v1 entries: during a webhook-secret rotation Stripe signs with
  // both secrets and sends multiple v1 signatures — accepting any match (each
  // still compared in constant time) is what the official SDKs do.
  const parts: Record<string, string> = {};
  const v1s: string[] = [];
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (!k || !v) continue;
    if (k.trim() === "v1") v1s.push(v.trim());
    else parts[k.trim()] = v.trim();
  }
  const t = parts.t;
  if (!t || v1s.length === 0) throw new WebhookSignatureError("Malformed Stripe-Signature header.");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const ok = v1s.some((sig) => {
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) throw new WebhookSignatureError("Stripe signature mismatch.");
  const age = Math.floor(Date.now() / 1000) - Number(t);
  if (!Number.isFinite(age) || Math.abs(age) > 300) throw new WebhookSignatureError("Stripe timestamp outside tolerance.");
  return JSON.parse(payload) as StripeEvent;
}

let cached: BillingProvider | null = null;

export function billing(): BillingProvider {
  if (cached) return cached;
  const kind = process.env.BILLING_PROVIDER ?? "mock";
  if (kind === "stripe") {
    const key = process.env.STRIPE_SECRET_KEY;
    const whsec = process.env.STRIPE_WEBHOOK_SECRET;
    if (!key || !whsec) {
      // Selecting Stripe but missing its keys must NOT silently fall back to the
      // mock (which grants paid entitlements for free and ack-and-discards real
      // webhooks). In production that's a payment-integrity hazard, so fail fast;
      // startup validation (validateProductionEnv) catches this even earlier.
      if (process.env.NODE_ENV === "production") {
        throw new Error("BILLING_PROVIDER=stripe but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET is missing. Refusing to fall back to mock billing in production.");
      }
      logger.warn("billing.stripe_unconfigured", { reason: "missing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET" });
      cached = new MockBillingProvider();
      return cached;
    }
    cached = new StripeBillingProvider(key, whsec);
    return cached;
  }
  cached = new MockBillingProvider();
  return cached;
}

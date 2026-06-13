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

export interface BillingProvider {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  /** Verify the signature and parse the event; persist any subscription change. Throws on bad signature. */
  handleWebhook(payload: string, signature: string | null): Promise<WebhookResult>;
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

  async handleWebhook(payload: string, signature: string | null): Promise<WebhookResult> {
    const event = verifyStripeSignature(payload, signature, this.webhookSecret);
    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const workspaceId = meta.workspaceId || (typeof obj.client_reference_id === "string" ? obj.client_reference_id : "");

    if (event.type === "checkout.session.completed" && workspaceId) {
      await repo().setSubscription(workspaceId, {
        plan: (meta.plan as PlanName) || "Growth",
        status: "active",
        seats: planSeatLimit((meta.plan as string) || "Growth"),
        stripeCustomerId: typeof obj.customer === "string" ? obj.customer : null,
        stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
      });
    } else if ((event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") && workspaceId) {
      const priceId = ((((obj.items as Record<string, unknown>)?.data as unknown[])?.[0] as Record<string, unknown>)?.price as Record<string, unknown>)?.id as string | undefined;
      const plan = planForPrice(priceId) ?? (meta.plan as PlanName) ?? "Growth";
      const periodEnd = typeof obj.current_period_end === "number" ? new Date(obj.current_period_end * 1000).toISOString() : undefined;
      await repo().setSubscription(workspaceId, {
        plan,
        // Keep the full status union — don't coerce trialing/canceled to active.
        status: (obj.status as "active" | "trialing" | "past_due" | "canceled") ?? "active",
        seats: planSeatLimit(plan),
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      });
    } else if (event.type === "customer.subscription.deleted" && workspaceId) {
      // Cancellation drops paid entitlements back to Free.
      await repo().setSubscription(workspaceId, { plan: "Free", status: "canceled", seats: planSeatLimit("Free") });
    }
    logger.info("billing.webhook", { type: event.type, mode: "stripe", workspaceId: workspaceId || undefined });
    return { type: event.type, handled: true };
  }
}

interface StripeEvent {
  type: string;
  data?: { object?: unknown };
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header) without the
 * SDK — the documented HMAC-SHA256 over `${timestamp}.${payload}` compared in
 * constant time, with a 5-minute replay tolerance. Throws on any mismatch.
 */
export function verifyStripeSignature(payload: string, sigHeader: string | null, secret: string): StripeEvent {
  if (!sigHeader) throw new Error("Missing Stripe-Signature header.");
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw new Error("Malformed Stripe-Signature header.");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Stripe signature mismatch.");
  const age = Math.floor(Date.now() / 1000) - Number(t);
  if (!Number.isFinite(age) || Math.abs(age) > 300) throw new Error("Stripe timestamp outside tolerance.");
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

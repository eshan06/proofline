import { logger } from "@/server/logger";

/**
 * Billing provider. The product depends only on this interface; the mock keeps
 * the billing UI fully clickable with no Stripe account, and the real Stripe
 * implementation slots in behind BILLING_PROVIDER=stripe + keys.
 */
export interface CheckoutInput {
  workspaceId: string;
  plan: "growth" | "scale";
  seats: number;
  successUrl: string;
  cancelUrl: string;
}

export interface Subscription {
  plan: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  seats: number;
  currentPeriodEnd: string;
}

export interface WebhookResult {
  type: string;
  handled: boolean;
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  getSubscription(workspaceId: string): Promise<Subscription>;
  /** Verify the signature and parse the event. Throws on bad signature. */
  handleWebhook(payload: string, signature: string | null): Promise<WebhookResult>;
}

class MockBillingProvider implements BillingProvider {
  async createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
    logger.info("billing.checkout_created", { workspaceId: input.workspaceId, plan: input.plan, seats: input.seats });
    // A real provider returns a Stripe Checkout URL; the mock loops back to
    // success so the upgrade flow is end-to-end clickable.
    return { url: `${input.successUrl}?mock_checkout=1&plan=${input.plan}` };
  }
  async getSubscription(): Promise<Subscription> {
    return { plan: "Growth", status: "active", seats: 3, currentPeriodEnd: "2026-07-01" };
  }
  async handleWebhook(payload: string): Promise<WebhookResult> {
    // No signature to verify in mock mode; just acknowledge.
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

let cached: BillingProvider | null = null;

export function billing(): BillingProvider {
  if (cached) return cached;
  const kind = process.env.BILLING_PROVIDER ?? "mock";
  switch (kind) {
    case "stripe":
      // TODO(real-billing): construct the Stripe-backed provider here. Use
      // STRIPE_SECRET_KEY for the API and STRIPE_WEBHOOK_SECRET to verify
      // signatures in handleWebhook before trusting the event.
      logger.warn("billing.provider_unwired", { requested: kind });
      cached = new MockBillingProvider();
      return cached;
    default:
      cached = new MockBillingProvider();
      return cached;
  }
}

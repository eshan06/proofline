/**
 * Plan catalog + entitlements. The seat limits here are enforced server-side
 * (see /api/members) so paid tiers actually differ from Free — without this,
 * "plan gating" is cosmetic. Stripe price ids map to these plan names.
 */
export const PLAN_LIMITS = {
  Free: { seats: 2, label: "Free" },
  Growth: { seats: 10, label: "Growth" },
  Scale: { seats: 50, label: "Scale" },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/** Max seats for a plan name; falls back to Growth for unknown names. */
export function planSeatLimit(plan: string): number {
  return (PLAN_LIMITS as Record<string, { seats: number }>)[plan]?.seats ?? PLAN_LIMITS.Growth.seats;
}

/** Map a Stripe price id (env-configured) to a plan name. */
export function planForPrice(priceId: string | undefined): PlanName | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_SCALE) return "Scale";
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return "Growth";
  return null;
}

/** Subscription statuses that grant paid entitlements. */
export type SubStatus = "active" | "trialing" | "past_due" | "canceled";

/**
 * Whether a subscription status grants paid access. `past_due` and `canceled`
 * are explicitly NOT entitled — Stripe persists those when a card fails or a
 * plan is cancelled, and a delinquent workspace must not keep paid features for
 * the whole dunning window. Only `active` / `trialing` are entitled.
 */
export function isEntitled(status: string): boolean {
  return status === "active" || status === "trialing";
}

/**
 * The seat limit that actually applies given plan + status. A delinquent /
 * cancelled workspace is gated to the Free seat limit regardless of the plan
 * name still stored on the row, so it can't keep paid seats it isn't paying for.
 */
export function effectiveSeatLimit(plan: string, status: string): number {
  return isEntitled(status) ? planSeatLimit(plan) : planSeatLimit("Free");
}

import { NextResponse } from "next/server";
import { billing } from "@/server/billing";
import { logger } from "@/server/logger";

/**
 * Stripe webhook receiver. Reads the raw body (required for signature
 * verification), hands it to the billing provider, and returns 200 so Stripe
 * stops retrying. Unauthenticated by design — trust comes from the signature,
 * not a session.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  try {
    const result = await billing().handleWebhook(payload, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    logger.error("billing.webhook_invalid", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}

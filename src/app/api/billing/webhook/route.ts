import { NextResponse } from "next/server";
import { billing, WebhookSignatureError } from "@/server/billing";
import { readBodyCapped } from "@/server/api";
import { logger } from "@/server/logger";
import { secureToken } from "@/lib/utils";

// Cap the webhook body so a forged unauthenticated request can't stream an
// unbounded payload into memory before the signature is even checked.
const MAX_WEBHOOK_BYTES = 1_000_000;

/**
 * Stripe webhook receiver. Reads the raw body (required for signature
 * verification), hands it to the billing provider, and returns 200 so Stripe
 * stops retrying. Unauthenticated by design — trust comes from the signature,
 * not a session.
 *
 * Error handling distinguishes two cases so Stripe retries the right ones:
 *  - bad/missing signature → 400, logged at warn, NOT alerted (untrusted caller).
 *  - internal failure after a valid signature (e.g. DB write) → 500 + reportError
 *    so it pages AND Stripe redelivers (idempotency makes the retry safe).
 */
export async function POST(req: Request) {
  // Streamed, byte-capped read: an absent/lying Content-Length can't buffer an
  // unbounded body before the cap applies.
  let payload: string;
  try {
    payload = await readBodyCapped(req, MAX_WEBHOOK_BYTES);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const signature = req.headers.get("stripe-signature");
  try {
    const result = await billing().handleWebhook(payload, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      logger.warn("billing.webhook_invalid_signature", { error: err.message });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    // Post-verification internal failure: alert + 500 so Stripe retries.
    const errorId = secureToken(4);
    logger.reportError("billing.webhook_failed", err, { errorId });
    return NextResponse.json({ error: "Internal error", errorId }, { status: 500 });
  }
}

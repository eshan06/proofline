import { ensureDemoSession } from "@/server/load-workspace";
import { clientKey, rateLimit, LIMITS } from "@/server/rate-limit";

/**
 * /demo — creates an unauthenticated sandbox session (server-seeded mock
 * workspace, no persistence, rate-limited AI) and enters the app at the hero
 * inbox. The regular sign-in flow stays separate.
 *
 * Minting is IP-rate-limited: each demo session carries its own AI budget, so
 * without this an attacker could clear the cookie and re-hit /demo to farm
 * fresh budgets indefinitely.
 */
export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, "demo"), LIMITS.auth);
  if (!rl.allowed) {
    return new Response(`Too many demo sessions — try again in ${rl.retryAfterSec}s.`, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }
  await ensureDemoSession();
}

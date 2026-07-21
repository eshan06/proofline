import { z } from "zod";
import { handleApi, parseBody, enforceRateLimit, enforceRateLimitKey } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { sendEmailSafe, passwordResetEmail } from "@/server/email";

const schema = z.object({ email: z.string().email() });

/**
 * Request a password reset. Always returns 200 regardless of whether the email
 * is registered — never reveal account existence. A real reset link is emailed
 * only when the account exists.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "forgot", LIMITS.auth);
    const body = await parseBody(req, schema);
    // Per-account throttle (keyed by email) so reset-email bombing a specific
    // address can't be done by rotating source IPs past the per-IP limiter.
    await enforceRateLimitKey(`forgot:acct:${body.email.toLowerCase()}`, LIMITS.auth);
    const r = repo();
    const user = await r.findUserByEmail(body.email);
    if (user) {
      const token = await r.createPasswordReset(user.id);
      sendEmailSafe(passwordResetEmail(user.email, token), "password_reset");
    }
    return { ok: true };
  });
}

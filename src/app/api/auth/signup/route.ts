import { z } from "zod";
import { handleApi, parseBody, enforceRateLimit, enforceRateLimitKey } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { hashPassword } from "@/server/auth/password";
import { sendEmailSafe, welcomeEmail, verifyEmail } from "@/server/email";

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/**
 * Create an account. Enumeration-safe: the response is identical whether or not
 * the email is already registered (no 409 oracle — symmetric with the
 * login/forgot flows). An existing email is silently ignored (the real owner
 * isn't observable to the prober). Signup intentionally does NOT auto-start a
 * session, precisely so the existing-vs-new cases can't be told apart; the
 * client switches to sign-in afterwards. Trade-off: one extra sign-in step on
 * the happy path in exchange for closing the enumeration oracle.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "signup", LIMITS.auth);
    const body = await parseBody(req, signupSchema);
    // Per-account throttle (keyed by email) so the oracle can't be probed by
    // rotating IPs to dodge the per-IP limiter.
    await enforceRateLimitKey(`signup:acct:${body.email.toLowerCase()}`, LIMITS.auth);
    const r = repo();
    const existing = await r.findUserByEmail(body.email);
    if (!existing) {
      const passwordHash = await hashPassword(body.password);
      const { user } = await r.createUserWithWorkspace({
        email: body.email,
        name: body.name,
        passwordHash,
      });
      sendEmailSafe(welcomeEmail(user.email, user.name), "welcome");
      const verifyToken = await r.createEmailVerification(user.id);
      sendEmailSafe(verifyEmail(user.email, verifyToken), "verify");
    }
    // Always the same generic response — reveals nothing about account existence.
    return { ok: true };
  });
}

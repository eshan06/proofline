import { z } from "zod";
import { handleApi, parseBody, ApiError, enforceRateLimit } from "@/server/api";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { verifyPassword, dummyVerify } from "@/server/auth/password";
import { startRegularSession } from "@/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "login", LIMITS.auth);
    const body = await parseBody(req, loginSchema);

    // Per-account throttle: bounds brute force against a single email even when
    // the attacker rotates IPs (the per-IP limit above can't catch that).
    const acct = await rateLimit(`login:acct:${body.email.toLowerCase()}`, LIMITS.auth);
    if (!acct.allowed) {
      throw new ApiError(429, `Too many attempts for this account — try again in ${acct.retryAfterSec}s.`);
    }

    const r = repo();
    const user = await r.findUserByEmail(body.email);
    // Equalize timing on the no-such-user path so response time can't be used
    // to enumerate registered emails, then fail with the same generic message.
    if (!user || !user.passwordHash) {
      await dummyVerify(body.password);
      throw new ApiError(401, "Incorrect email or password.");
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Incorrect email or password.");
    }
    const workspaceId = await r.primaryWorkspaceForUser(user.id);
    if (!workspaceId) throw new ApiError(403, "This account has no workspace.");
    await startRegularSession(user.id, workspaceId);
    return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
  });
}

import { z } from "zod";
import { handleApi, parseBody, ApiError, enforceRateLimit } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { hashPassword } from "@/server/auth/password";

const schema = z.object({ token: z.string().min(1), password: z.string().min(8, "Password must be at least 8 characters").max(200) });

/**
 * Complete a password reset. Consumes the one-time token, sets the new password,
 * and invalidates all existing sessions so a leaked session can't survive a reset.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "reset", LIMITS.auth);
    const body = await parseBody(req, schema);
    const r = repo();
    const userId = await r.consumePasswordReset(body.token);
    if (!userId) throw new ApiError(400, "This reset link is invalid or has expired.");
    await r.setPassword(userId, await hashPassword(body.password));
    await r.deleteUserSessions(userId);
    return { ok: true };
  });
}

import { handleApi, requireSession, ApiError, enforceRateLimit } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { sendEmailSafe, verifyEmail } from "@/server/email";

/**
 * Re-send a verification email for the current signed-in user. Rate-limited
 * to prevent abuse. No-ops silently when the account is already verified so
 * the client does not need to special-case it.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "resend-verify", LIMITS.auth);
    const session = await requireSession();
    if (!session.userId) throw new ApiError(403, "Demo sessions do not have an email address.");

    const user = await repo().getUser(session.userId);
    if (!user) throw new ApiError(404, "User not found.");
    if (user.emailVerified) return { ok: true, alreadyVerified: true };

    const token = await repo().createEmailVerification(session.userId);
    sendEmailSafe(verifyEmail(user.email, token), "resend-verify");
    return { ok: true };
  });
}

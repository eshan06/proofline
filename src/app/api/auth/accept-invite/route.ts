import { z } from "zod";
import { handleApi, parseBody, ApiError, enforceRateLimit } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { repo } from "@/server/repository";
import { hashPassword } from "@/server/auth/password";
import { startRegularSession, currentSession } from "@/server/session";
import { verifyInviteToken } from "@/server/invite-token";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  // Optional — supplied when the invitee is creating a new account.
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    await enforceRateLimit(req, "accept-invite", LIMITS.auth);
    const body = await parseBody(req, acceptInviteSchema);

    // Verify the HMAC-signed token — returns payload or null if invalid/expired.
    const payload = verifyInviteToken(body.token);
    if (!payload) {
      throw new ApiError(400, "This invite link is invalid or has expired. Ask your admin to send a new one.");
    }

    const r = repo();

    // If the caller already has an active session they can accept without a password.
    // But if no session, a password is required to set up the account.
    const session = await currentSession();
    const isLoggedIn = !!session?.userId;

    if (!isLoggedIn && !body.password) {
      throw new ApiError(400, "Please set a password to activate your account.");
    }

    const passwordHash = body.password ? await hashPassword(body.password) : undefined;

    const { userId } = await r.acceptInvite({
      workspaceId: payload.workspaceId,
      email: payload.email,
      role: payload.role,
      name: body.name,
      passwordHash,
    });

    // Start (or replace) the session for the newly-activated user.
    await startRegularSession(userId, payload.workspaceId);

    return { ok: true };
  });
}

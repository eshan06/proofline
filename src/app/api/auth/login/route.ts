import { z } from "zod";
import { handleApi, parseBody, ApiError } from "@/server/api";
import { repo } from "@/server/repository";
import { verifyPassword } from "@/server/auth/password";
import { startRegularSession } from "@/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const body = await parseBody(req, loginSchema);
    const r = repo();
    const user = await r.findUserByEmail(body.email);
    // Constant-ish failure path: don't reveal whether the email exists.
    if (!user || !user.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Incorrect email or password.");
    }
    const workspaceId = await r.primaryWorkspaceForUser(user.id);
    if (!workspaceId) throw new ApiError(403, "This account has no workspace.");
    await startRegularSession(user.id, workspaceId);
    return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
  });
}

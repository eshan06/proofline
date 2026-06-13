import { z } from "zod";
import { handleApi, parseBody, ApiError } from "@/server/api";
import { repo } from "@/server/repository";
import { hashPassword } from "@/server/auth/password";
import { startRegularSession } from "@/server/session";

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const body = await parseBody(req, signupSchema);
    const r = repo();
    const existing = await r.findUserByEmail(body.email);
    if (existing) throw new ApiError(409, "An account with that email already exists.");

    const passwordHash = await hashPassword(body.password);
    const { user, workspaceId } = await r.createUserWithWorkspace({
      email: body.email,
      name: body.name,
      passwordHash,
    });
    await startRegularSession(user.id, workspaceId);
    return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
  });
}

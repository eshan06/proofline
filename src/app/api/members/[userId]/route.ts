import { memberRolePatchSchema } from "@/lib/schemas";
import { actorName, ApiError, handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const { userId } = await params;
    if (!userId) throw new ApiError(400, "Missing userId");

    const body = await parseBody(req, memberRolePatchSchema);
    const r = repo();

    // The last-active-Admin invariant is enforced atomically in the repository
    // (count + write under a row lock → LastAdminError/409), closing the TOCTOU
    // where two concurrent demotions could both pass a read-then-write check.
    const member = await r.updateMemberRoleGuarded(session.workspaceId, userId, body.role);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Changed ${member.name}'s role to ${body.role}`,
      type: "Team",
    });
    return member;
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const { userId } = await params;
    if (!userId) throw new ApiError(400, "Missing userId");

    // Prevent self-removal.
    if (session.userId && session.userId === userId) {
      throw new ApiError(400, "You cannot remove yourself from the workspace.");
    }

    const r = repo();
    // Last-active-Admin invariant enforced atomically in the repo (LastAdminError/409).
    const { name } = await r.removeMemberGuarded(session.workspaceId, userId);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Removed ${name} from the workspace`,
      type: "Team",
    });
    return { ok: true };
  });
}

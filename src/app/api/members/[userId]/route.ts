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

    const member = await r.updateMemberRole(session.workspaceId, userId, body.role);
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

    // Guard: do not allow removing the last Admin.
    const workspace = await r.getWorkspace(session.workspaceId);
    const adminCount = workspace.members.filter((m) => m.role === "Admin").length;
    const targetMember = workspace.members.find((m) => m.userId === userId);
    if (targetMember?.role === "Admin" && adminCount <= 1) {
      throw new ApiError(400, "Cannot remove the last Admin from the workspace.");
    }

    const memberName = targetMember?.name ?? userId;
    await r.removeMember(session.workspaceId, userId);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Removed ${memberName} from the workspace`,
      type: "Team",
    });
    return { ok: true };
  });
}

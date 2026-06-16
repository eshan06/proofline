import { memberRolePatchSchema, type Member } from "@/lib/schemas";
import { actorName, ApiError, handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";

/** Members who can actually administer the workspace right now (excludes pending invites). */
function activeAdminCount(members: Member[]): number {
  return members.filter((m) => m.role === "Admin" && m.status === "Active").length;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const { userId } = await params;
    if (!userId) throw new ApiError(400, "Missing userId");

    const body = await parseBody(req, memberRolePatchSchema);
    const r = repo();

    // Guard: don't let the workspace lose its last active Admin by demotion.
    if (body.role !== "Admin") {
      const workspace = await r.getWorkspace(session.workspaceId);
      const target = workspace.members.find((m) => m.userId === userId);
      if (target?.role === "Admin" && target.status === "Active" && activeAdminCount(workspace.members) <= 1) {
        throw new ApiError(400, "Cannot demote the last Admin — promote another member to Admin first.");
      }
    }

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

    // Guard: do not allow removing the last *active* Admin. Pending (Invited)
    // admins can't manage the workspace yet, so they don't satisfy the invariant.
    const workspace = await r.getWorkspace(session.workspaceId);
    const targetMember = workspace.members.find((m) => m.userId === userId);
    if (
      targetMember?.role === "Admin" &&
      targetMember.status === "Active" &&
      activeAdminCount(workspace.members) <= 1
    ) {
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

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

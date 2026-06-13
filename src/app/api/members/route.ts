import { inviteMemberSchema } from "@/lib/schemas";
import { actorName, handleApi, parseBody, requireSession } from "@/server/api";
import { repo } from "@/server/repository";
import { email, inviteEmail } from "@/server/email";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, inviteMemberSchema);
    const r = repo();
    const member = await r.inviteMember(session.workspaceId, body.email, body.role);
    const ws = await r.getWorkspace(session.workspaceId);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Invited ${body.email} as ${body.role}`,
      type: "Team",
    });
    void email().send(inviteEmail(body.email, ws.name, body.role)).catch(() => {});
    return member;
  });
}

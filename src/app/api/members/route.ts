import { inviteMemberSchema } from "@/lib/schemas";
import { actorName, handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";
import { sendEmailSafe, inviteEmail } from "@/server/email";
import { effectiveSeatLimit } from "@/server/billing/plans";
import { createInviteToken } from "@/server/invite-token";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const body = await parseBody(req, inviteMemberSchema);
    const r = repo();

    // Seat-limit enforcement — paid tiers actually differ from Free, and a
    // delinquent (past_due/canceled) workspace is gated to the Free limit. The
    // count + insert happen atomically in the repo (SeatLimitError → 402) so
    // concurrent invites can't overrun the cap.
    const sub = await r.getSubscription(session.workspaceId);
    const limit = effectiveSeatLimit(sub.plan, sub.status);
    const member = await r.inviteMemberGuarded(session.workspaceId, body.email, body.role, limit);
    const ws = await r.getWorkspace(session.workspaceId);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Invited ${body.email} as ${body.role}`,
      type: "Team",
    });
    const inviteToken = createInviteToken(session.workspaceId, body.email, body.role);
    sendEmailSafe(inviteEmail(body.email, ws.name, body.role, inviteToken), "invite");
    return member;
  });
}

import { inviteMemberSchema } from "@/lib/schemas";
import { actorName, ApiError, handleApi, parseBody, requireSession } from "@/server/api";
import { repo } from "@/server/repository";
import { sendEmailSafe, inviteEmail } from "@/server/email";
import { planSeatLimit } from "@/server/billing/plans";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, inviteMemberSchema);
    const r = repo();

    // Seat-limit enforcement — paid tiers actually differ from Free.
    const [sub, used] = await Promise.all([r.getSubscription(session.workspaceId), r.countMembers(session.workspaceId)]);
    const limit = planSeatLimit(sub.plan);
    if (used >= limit) {
      throw new ApiError(402, `Your ${sub.plan} plan includes ${limit} seats. Upgrade to invite more teammates.`);
    }

    const member = await r.inviteMember(session.workspaceId, body.email, body.role);
    const ws = await r.getWorkspace(session.workspaceId);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Invited ${body.email} as ${body.role}`,
      type: "Team",
    });
    sendEmailSafe(inviteEmail(body.email, ws.name, body.role), "invite");
    return member;
  });
}

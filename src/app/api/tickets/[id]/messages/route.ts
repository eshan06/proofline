import { postMessageSchema } from "@/lib/schemas";
import { actorName, handleApi, parseBody, requireRole, requireSession, trackEvent } from "@/server/api";
import { repo } from "@/server/repository";
import { dispatchEmailReply } from "@/server/email/dispatch";
import { dispatchSlackReply } from "@/server/slack/dispatch";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin", "Agent"]);
    const { id } = await ctx.params;
    const body = await parseBody(req, postMessageSchema);
    const r = repo();
    const actor = await actorName(session);
    if (body.kind === "note") {
      return r.addNote(session.workspaceId, id, body.text, actor);
    }
    const ticket = await r.addReply(session.workspaceId, id, body.text, body.viaAI ?? false, actor);
    // Channel-backed tickets relay the reply back to the customer (Gmail / Slack).
    // A no-op when the channel is dormant; never throws (delivery is best-effort).
    if (ticket.channel === "email") {
      await dispatchEmailReply(session.workspaceId, ticket, body.text);
    } else if (ticket.channel === "slack") {
      await dispatchSlackReply(session.workspaceId, ticket, body.text);
    }
    if (await r.completeDemoStep(session.id, "send")) {
      trackEvent(session, "demo_step_completed", { step: "send" });
    }
    return ticket;
  });
}

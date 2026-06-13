import { postMessageSchema } from "@/lib/schemas";
import { actorName, handleApi, parseBody, requireSession, trackEvent } from "@/server/api";
import { repo } from "@/server/repository";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await parseBody(req, postMessageSchema);
    const r = repo();
    const actor = await actorName(session);
    if (body.kind === "note") {
      return r.addNote(session.workspaceId, id, body.text, actor);
    }
    const ticket = await r.addReply(session.workspaceId, id, body.text, body.viaAI ?? false, actor);
    if (await r.completeDemoStep(session.id, "send")) {
      trackEvent(session, "demo_step_completed", { step: "send" });
    }
    return ticket;
  });
}

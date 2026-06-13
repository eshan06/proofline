import { postMessageSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, trackEvent } from "@/server/api";
import { addNote, addReply, completeDemoStep } from "@/server/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await parseBody(req, postMessageSchema);
    if (body.kind === "note") {
      return addNote(session, id, body.text);
    }
    const ticket = addReply(session, id, body.text, body.viaAI ?? false);
    if (completeDemoStep(session, "send")) {
      trackEvent(session, "demo_step_completed", { step: "send" });
    }
    return ticket;
  });
}

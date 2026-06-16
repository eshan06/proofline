import { z } from "zod";
import { actorName, handleApi, parseBody, requireRole, requireSession } from "@/server/api";
import { repo } from "@/server/repository";

const postNoteSchema = z.object({
  text: z.string().min(1, "Note text is required").max(4000),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin", "Agent"]);
    const { id } = await ctx.params;
    const body = await parseBody(req, postNoteSchema);
    const actor = await actorName(session);
    await repo().appendCustomerNote(session.workspaceId, id, { author: actor, text: body.text });
    return { ok: true };
  });
}

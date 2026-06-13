import { ticketPatchSchema } from "@/lib/schemas";
import { actorName, handleApi, parseBody, requireSession } from "@/server/api";
import { repo } from "@/server/repository";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const patch = await parseBody(req, ticketPatchSchema);
    return repo().patchTicket(session.workspaceId, id, patch, await actorName(session));
  });
}

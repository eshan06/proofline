import { ticketPatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";
import { patchTicket } from "@/server/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const patch = await parseBody(req, ticketPatchSchema);
    return patchTicket(session, id, patch);
  });
}

import { automationPatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireRole, requireSession } from "@/server/api";
import { repo } from "@/server/repository";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const { id } = await ctx.params;
    const body = await parseBody(req, automationPatchSchema);
    return repo().setAutomationEnabled(session.workspaceId, id, body.enabled);
  });
}

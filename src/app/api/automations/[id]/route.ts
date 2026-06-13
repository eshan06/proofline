import { automationPatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";
import { setAutomationEnabled } from "@/server/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await parseBody(req, automationPatchSchema);
    return setAutomationEnabled(session, id, body.enabled);
  });
}

import { copilotPatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const patch = await parseBody(req, copilotPatchSchema);
    Object.assign(session.workspace.copilot, patch);
    return session.workspace.copilot;
  });
}

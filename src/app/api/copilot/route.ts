import { copilotPatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const patch = await parseBody(req, copilotPatchSchema);
    return repo().patchCopilot(session.workspaceId, patch);
  });
}

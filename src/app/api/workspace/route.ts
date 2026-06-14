import { workspacePatchSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";
import { attachSession } from "@/server/load-workspace";

export async function GET() {
  return handleApi(async () => {
    const session = await requireSession();
    const ws = await repo().getWorkspace(session.workspaceId);
    return attachSession(ws, session);
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const body = await parseBody(req, workspacePatchSchema);
    await repo().renameWorkspace(session.workspaceId, body.name);
    return { ok: true, name: body.name };
  });
}

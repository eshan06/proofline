import { handleApi, requireSession } from "@/server/api";
import { repo } from "@/server/repository";
import { attachSession } from "@/server/load-workspace";

export async function GET() {
  return handleApi(async () => {
    const session = await requireSession();
    const ws = await repo().getWorkspace(session.workspaceId);
    return attachSession(ws, session);
  });
}

import { handleApi, requireSession } from "@/server/api";
import { workspacePayload } from "@/server/store";

export async function GET() {
  return handleApi(async () => {
    const session = await requireSession();
    return workspacePayload(session);
  });
}

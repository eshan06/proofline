import { createAutomationSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";
import { repo } from "@/server/repository";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, createAutomationSchema);
    return repo().addAutomation(session.workspaceId, body);
  });
}

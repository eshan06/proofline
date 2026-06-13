import { createAutomationSchema } from "@/lib/schemas";
import { handleApi, parseBody, requireSession } from "@/server/api";
import { addAutomation } from "@/server/store";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, createAutomationSchema);
    return addAutomation(session, body);
  });
}

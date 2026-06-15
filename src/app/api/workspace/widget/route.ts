import { z } from "zod";
import { handleApi, parseBody, requireSession, requireRole } from "@/server/api";
import { repo } from "@/server/repository";

const schema = z.object({
  allowedOrigins: z.array(z.string().url("Each entry must be a valid URL origin")).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const body = await parseBody(req, schema);
    await repo().patchWidgetConfig(session.workspaceId, body);
    return { ok: true };
  });
}

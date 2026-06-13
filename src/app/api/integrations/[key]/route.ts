import { integrationKeySchema, integrationPatchSchema } from "@/lib/schemas";
import { ApiError, handleApi, parseBody, requireSession, trackEvent } from "@/server/api";
import { completeDemoStep } from "@/server/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { key } = await ctx.params;
    const parsedKey = integrationKeySchema.safeParse(key);
    if (!parsedKey.success) throw new ApiError(404, `Unknown integration ${key}`);
    const body = await parseBody(req, integrationPatchSchema);

    const integration = session.workspace.integrations.find((i) => i.key === parsedKey.data);
    if (!integration) throw new ApiError(404, `Unknown integration ${key}`);
    integration.connected = body.connected;

    if (body.connected && completeDemoStep(session, "connect")) {
      trackEvent(session, "demo_step_completed", { step: "connect" });
    }
    return integration;
  });
}

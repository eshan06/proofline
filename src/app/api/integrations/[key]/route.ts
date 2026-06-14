import { integrationKeySchema, integrationPatchSchema } from "@/lib/schemas";
import { ApiError, actorName, handleApi, parseBody, requireSession, requireRole, trackEvent } from "@/server/api";
import { repo } from "@/server/repository";

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin"]);
    const { key } = await ctx.params;
    const parsedKey = integrationKeySchema.safeParse(key);
    if (!parsedKey.success) throw new ApiError(404, `Unknown integration ${key}`);
    const body = await parseBody(req, integrationPatchSchema);
    const r = repo();

    const integration = await r.patchIntegration(session.workspaceId, parsedKey.data, body.connected);
    // Disconnecting Gmail/Slack forgets the stored OAuth account / bot token.
    if (parsedKey.data === "gmail" && !body.connected) {
      await r.clearGmailAccount(session.workspaceId);
    } else if (parsedKey.data === "slack" && !body.connected) {
      await r.clearSlackAccount(session.workspaceId);
    }
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `${body.connected ? "Connected" : "Disconnected"} ${integration.name}`,
      type: "Integrations",
    });

    if (body.connected && (await r.completeDemoStep(session.id, "connect"))) {
      trackEvent(session, "demo_step_completed", { step: "connect" });
    }
    return integration;
  });
}

import { ApiError, handleApi, requireRole, requireSession, actorName } from "@/server/api";
import { repo } from "@/server/repository";

/**
 * Delete a knowledge-base document. The FK cascade on kb_chunks removes the
 * document's embedded vectors too, so a doc with wrong/retracted content (or one
 * named in a GDPR erasure request scoped to the KB) can be purged from retrieval
 * without nuking the whole workspace. Workspace-scoped + Admin/Agent only.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin", "Agent"]);
    const { id } = await ctx.params;
    if (!id) throw new ApiError(400, "Missing document id");

    const r = repo();
    await r.deleteKbDoc(session.workspaceId, id);
    await r.appendAudit(session.workspaceId, {
      user: await actorName(session),
      action: `Deleted knowledge-base document ${id}`,
      type: "AI",
    });
    return { ok: true };
  });
}

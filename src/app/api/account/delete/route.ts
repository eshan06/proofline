import { handleApi, requireSession, ApiError } from "@/server/api";
import { repo } from "@/server/repository";
import { endSession } from "@/server/session";

/**
 * Permanently delete the workspace (cascades all its data) and, if the acting
 * user belongs to no other workspace, the user account too — then end the
 * session. Admin-only for real sessions. Irreversible.
 */
export async function POST() {
  return handleApi(async () => {
    const session = await requireSession();
    const r = repo();
    if (session.userId) {
      const role = await r.membershipRole(session.userId, session.workspaceId);
      if (role !== "Admin") throw new ApiError(403, "Only an admin can delete the workspace.");
    }
    const userId = session.userId;
    await r.deleteWorkspace(session.workspaceId);
    if (userId) await r.deleteUserIfOrphaned(userId);
    await endSession();
    return { ok: true };
  });
}

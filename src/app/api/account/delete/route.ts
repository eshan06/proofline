import { handleApi, requireSession, ApiError } from "@/server/api";
import { repo } from "@/server/repository";
import { billing } from "@/server/billing";
import { endSession } from "@/server/session";
import { logger } from "@/server/logger";

/**
 * Permanently delete the workspace (cascades all its data) and, if the acting
 * user belongs to no other workspace, the user account too — then end the
 * session. Admin-only for real sessions. Irreversible.
 *
 * Before erasing local data we cancel the Stripe subscription and delete the
 * Stripe customer, so a deleted customer is not billed again and their PII is
 * removed at the sub-processor (GDPR). This runs first because deleteWorkspace
 * destroys the stored Stripe ids; it is best-effort (logged, non-fatal) so a
 * Stripe outage can't block the user's right to delete their account.
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

    // Cancel billing + erase sub-processor PII before destroying the local ids.
    try {
      const sub = await r.getSubscription(session.workspaceId);
      if (sub.stripeSubscriptionId || sub.stripeCustomerId) {
        const b = billing();
        await b.cancelSubscription(sub.stripeSubscriptionId);
        await b.deleteCustomer(sub.stripeCustomerId);
      }
    } catch (err) {
      // Never block account deletion on a billing failure — log for follow-up.
      logger.reportError("account.delete_billing_cleanup_failed", err, { workspaceId: session.workspaceId });
    }

    await r.deleteWorkspace(session.workspaceId);
    if (userId) await r.deleteUserIfOrphaned(userId);
    await endSession();
    return { ok: true };
  });
}

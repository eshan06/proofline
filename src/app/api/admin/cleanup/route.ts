import { timingSafeEqual } from "node:crypto";
import { ApiError, handleApi } from "@/server/api";
import { repo } from "@/server/repository";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Scheduled maintenance: purge expired sessions and reap abandoned demo
 * workspaces (and their seeded pgvector embeddings). This is cron-only — it
 * spans every workspace, so it is authenticated by the CLEANUP_SECRET header
 * rather than a user session. Point a scheduler (Cloud Scheduler / cron / a
 * GitHub Action) at it, e.g. hourly:
 *
 *   POST /api/admin/cleanup   with header  x-cleanup-secret: $CLEANUP_SECRET
 *
 * Without CLEANUP_SECRET set the endpoint is inert (401), so a misconfigured
 * deploy can't have it triggered by anyone.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    const secret = process.env.CLEANUP_SECRET;
    const provided = req.headers.get("x-cleanup-secret");
    if (!secret || !provided || !constantTimeEquals(provided, secret)) {
      throw new ApiError(401, "Unauthorized.");
    }
    const result = await repo().cleanupExpired();
    logger.info("admin.cleanup", result);
    return result;
  });
}

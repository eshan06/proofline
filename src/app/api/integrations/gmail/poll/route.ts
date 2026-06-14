import { timingSafeEqual } from "node:crypto";
import { ApiError, handleApi, requireRole, requireSession } from "@/server/api";
import { repo } from "@/server/repository";
import { gmail } from "@/server/email/gmail";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Pull new inbound email into tickets. Two callers:
 *  - an admin clicking "Sync inbound" (session-authenticated; polls their workspace), or
 *  - a scheduler hitting it with the GMAIL_POLL_SECRET header + ?workspaceId=…
 *    (so production can cron this without a user session).
 *
 * For an always-on inbound, point a Gmail push (Pub/Sub) at this endpoint or run
 * it on a schedule. Ingestion is idempotent (deduped by Message-ID), so polling
 * the same window twice is safe.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    const secret = process.env.GMAIL_POLL_SECRET;
    const provided = req.headers.get("x-gmail-poll-secret");

    let workspaceId: string;
    if (secret && provided && constantTimeEquals(provided, secret)) {
      const qs = new URL(req.url).searchParams.get("workspaceId");
      if (!qs) throw new ApiError(400, "workspaceId query param is required for scheduled polls.");
      workspaceId = qs;
    } else {
      const session = await requireSession();
      await requireRole(session, ["Admin"]);
      workspaceId = session.workspaceId;
    }

    const g = gmail();
    if (!g.enabled) return { disabled: true, polled: 0, created: 0, appended: 0 };

    const account = await repo().getGmailAccount(workspaceId);
    if (!account) return { connected: false, polled: 0, created: 0, appended: 0 };

    const inbound = await g.listInbound({ refreshToken: account.refreshToken });
    let created = 0;
    let appended = 0;
    for (const email of inbound) {
      const res = await repo().ingestInboundEmail(workspaceId, email);
      if (res.created) created += 1;
      else if (!res.duplicate) appended += 1;
    }
    logger.info("gmail.polled", { workspaceId, polled: inbound.length, created, appended });
    return { polled: inbound.length, created, appended };
  });
}

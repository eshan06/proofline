import { playgroundRequestSchema } from "@/lib/schemas";
import { ApiError, handleApi, parseBody, requireRole, requireSession, enforceRateLimit } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { getDraftProvider } from "@/server/ai";
import { runAutomations } from "@/server/automations/engine";
import { repo } from "@/server/repository";

export async function POST(req: Request) {
  return handleApi(async () => {
    // Authorize before consuming the AI rate-limit budget, so a denied caller
    // (e.g. a read-only Viewer) doesn't burn the shared bucket. Matches the
    // draft route's ordering.
    const session = await requireSession();
    await requireRole(session, ["Admin", "Agent"]);
    await enforceRateLimit(req, "ai", LIMITS.ai);
    const body = await parseBody(req, playgroundRequestSchema);
    const r = repo();
    if (!(await r.consumeAiCall(session.id))) {
      throw new ApiError(429, "Demo AI limit reached — sign up to keep drafting.");
    }
    const [kbDocs, copilot] = await Promise.all([
      r.getKbDocs(session.workspaceId),
      r.getCopilot(session.workspaceId),
    ]);
    const result = await getDraftProvider(session.workspaceId).answer(body.question, kbDocs, {
      threshold: copilot.threshold / 100,
      neverSay: copilot.neverSay,
    });

    // A low-confidence playground answer trips the safety net, just like a live
    // draft — automations are real, not display data.
    if (result.conf != null && result.conf < 0.65) {
      const slackTicket = await r.findTicket(session.workspaceId, "TKT-1038");
      if (slackTicket) {
        const automations = await r.getAutomations(session.workspaceId);
        for (const res of runAutomations(automations, { kind: "draft.generated", ticket: slackTicket, confidence: result.conf })) {
          if (res.fired && res.logLine) {
            await r.recordAutomationRun(session.workspaceId, res.automation.id, { time: "just now", text: res.logLine, ok: true });
          }
        }
      }
    }

    return result;
  });
}

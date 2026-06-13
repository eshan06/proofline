import { playgroundRequestSchema } from "@/lib/schemas";
import { ApiError, handleApi, parseBody, requireSession } from "@/server/api";
import { draftProvider } from "@/server/ai";
import { runAutomations } from "@/server/automations/engine";
import { consumeAiCall, findTicket, recordAutomationRun } from "@/server/store";

export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    const body = await parseBody(req, playgroundRequestSchema);
    if (!consumeAiCall(session)) {
      throw new ApiError(429, "Demo AI limit reached — sign up to keep drafting.");
    }
    const result = await draftProvider.answer(body.question, session.workspace.kbDocs, {
      threshold: session.workspace.copilot.threshold / 100,
    });

    // A low-confidence playground answer trips the safety net, just like a
    // live draft would — automations are real, not display data.
    if (result.conf != null && result.conf < 0.65) {
      const slackTicket = findTicket(session, "TKT-1038");
      if (slackTicket) {
        for (const r of runAutomations(session.workspace.automations, {
          kind: "draft.generated",
          ticket: slackTicket,
          confidence: result.conf,
        })) {
          if (r.fired && r.logLine) {
            recordAutomationRun(session, r.automation.id, {
              time: "just now",
              text: r.logLine,
              ok: true,
            });
          }
        }
      }
    }

    return result;
  });
}

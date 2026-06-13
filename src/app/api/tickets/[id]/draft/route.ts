import { draftActionSchema } from "@/lib/schemas";
import { ApiError, handleApi, parseBody, requireSession } from "@/server/api";
import { draftProvider } from "@/server/ai/mock-provider";
import { runAutomations } from "@/server/automations/engine";
import { consumeAiCall, findTicket, NotFoundError, recordAutomationRun, setDraft } from "@/server/store";
import { seedCustomers } from "@/data/workspace";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await parseBody(req, draftActionSchema);
    const ticket = findTicket(session, id);
    if (!ticket) throw new NotFoundError(`Unknown ticket ${id}`);
    if (!ticket.draft) {
      throw new ApiError(409, "No grounded draft exists for this ticket.");
    }

    if (body.action === "edit") {
      return setDraft(session, id, { ...ticket.draft, text: body.text });
    }

    if (!consumeAiCall(session)) {
      throw new ApiError(429, "Demo AI limit reached — sign up to keep drafting.");
    }

    const result =
      body.action === "regenerate"
        ? await draftProvider.regenerate(ticket, session.workspace.kbDocs, {
            threshold: session.workspace.copilot.threshold / 100,
          })
        : await draftProvider.rewrite(ticket, body.tone);

    if (!result.draft) {
      throw new ApiError(409, result.failureReason);
    }

    const updated = setDraft(session, id, result.draft);

    // The low-confidence safety net watches every draft generation.
    const customerPlan = seedCustomers.find((c) => c.name === ticket.customer.name)?.plan;
    for (const r of runAutomations(session.workspace.automations, {
      kind: "draft.generated",
      ticket: updated,
      confidence: result.draft.confidence,
      customerPlan,
    })) {
      if (r.fired && r.logLine) {
        recordAutomationRun(session, r.automation.id, { time: "just now", text: r.logLine, ok: true });
      }
    }

    return updated;
  });
}

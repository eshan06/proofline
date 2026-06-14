import { draftActionSchema } from "@/lib/schemas";
import { ApiError, handleApi, parseBody, requireSession, enforceRateLimit } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { getDraftProvider } from "@/server/ai";
import { runAutomations } from "@/server/automations/engine";
import { repo, NotFoundError } from "@/server/repository";
import { seedCustomers } from "@/data/workspace";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await parseBody(req, draftActionSchema);
    const r = repo();
    const ticket = await r.findTicket(session.workspaceId, id);
    if (!ticket) throw new NotFoundError(`Unknown ticket ${id}`);
    if (!ticket.draft) {
      throw new ApiError(409, "No grounded draft exists for this ticket.");
    }

    if (body.action === "edit") {
      return r.setDraft(session.workspaceId, id, { ...ticket.draft, text: body.text });
    }

    await enforceRateLimit(req, "ai", LIMITS.ai);
    if (!(await r.consumeAiCall(session.id))) {
      throw new ApiError(429, "Demo AI limit reached — sign up to keep drafting.");
    }

    const [kbDocs, copilot] = await Promise.all([
      r.getKbDocs(session.workspaceId),
      r.getCopilot(session.workspaceId),
    ]);
    const provider = getDraftProvider(session.workspaceId);
    const result =
      body.action === "regenerate"
        ? await provider.regenerate(ticket, kbDocs, { threshold: copilot.threshold / 100 })
        : await provider.rewrite(ticket, body.tone);

    if (!result.draft) {
      throw new ApiError(409, result.failureReason);
    }

    const updated = await r.setDraft(session.workspaceId, id, result.draft);

    // The low-confidence safety net watches every draft generation.
    const customerPlan = seedCustomers.find((c) => c.name === ticket.customer.name)?.plan;
    const automations = await r.getAutomations(session.workspaceId);
    let fired = false;
    for (const res of runAutomations(automations, {
      kind: "draft.generated",
      ticket: updated, // automations mutate this in place (tags/status/stage/assignee)
      confidence: result.draft.confidence,
      customerPlan,
    })) {
      if (res.fired && res.logLine) {
        await r.recordAutomationRun(session.workspaceId, res.automation.id, { time: "just now", text: res.logLine, ok: true });
        fired = true;
      }
    }
    // Persist only the automation-driven field mutations (escalate/tag/reassign)
    // under a row lock — writing the whole (stale) ticket could clobber a reply
    // that arrived during the slow AI call. setDraft above already saved the draft.
    if (fired) {
      await r.saveTicketFields(session.workspaceId, id, {
        tags: updated.tags,
        status: updated.status,
        stage: updated.stage,
        assignee: updated.assignee,
        priority: updated.priority,
      });
    }

    return updated;
  });
}

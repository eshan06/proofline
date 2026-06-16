import type { AIDraft, DraftVariant, KbDoc, PlaygroundResult, Ticket, Tone } from "@/lib/schemas";
import type { DraftProvider, DraftProviderOptions, DraftResult } from "./provider";
import { retrieve, scoreConfidence, toCitations, filterGrounded, findNeverSayViolation } from "./rag";
import { llm } from "./llm";

/**
 * Real RAG-backed provider. Active when a database is present (so pgvector
 * retrieval is available). Implements the same DraftProvider interface as the
 * fixture mock, including the refusal contract: when retrieval finds no
 * grounded source above threshold, it returns no draft + a failure reason —
 * the AI never guesses. It also withholds any draft that trips a "never say"
 * policy (the route passes copilot.neverSay).
 *
 * The confidence threshold is intentionally NOT a server-side refusal: the
 * product has no auto-send (a human sends every reply), so a below-threshold
 * draft is surfaced and flagged "held for review" in the UI rather than hidden,
 * and the low-confidence automation still fires on it. Refusing here would both
 * suppress that automation and break the playground's "below your threshold"
 * affordance, so the threshold gates the *client* display, not the draft.
 *
 * `workspaceId` is bound per request (route handlers know the tenant); a small
 * factory closes over it.
 */
export class RagDraftProvider implements DraftProvider {
  constructor(private workspaceId: string) {}

  private customerQuestion(ticket: Ticket): string {
    const firstCustomer = ticket.messages.find((m) => m.kind === "customer");
    return firstCustomer?.text ?? ticket.subject;
  }

  /** Shared retrieval + drafting pass with the "never say" guardrail. */
  private async draft(ticket: Ticket, tone: Tone | undefined, opts: DraftProviderOptions): Promise<DraftResult> {
    const question = this.customerQuestion(ticket);
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null) {
      return { draft: null, failureReason: "No grounded source found for this question — routing to a human." };
    }

    const chunks = filterGrounded(retrieved);
    const text = await llm().draftReply({ question, customerName: ticket.customer.name, contexts: chunks, tone });

    const banned = findNeverSayViolation(text, opts.neverSay);
    if (banned) {
      return {
        draft: null,
        failureReason: `Draft withheld — it referenced a “never say” policy (“${banned}”). Routing to a human.`,
      };
    }

    const citations = toCitations(chunks);
    const variant: DraftVariant = tone ?? "regen";
    const draft: AIDraft = {
      text,
      confidence,
      confMeta: `Grounded in ${citations.length} source${citations.length === 1 ? "" : "s"} · top similarity ${chunks[0]!.similarity.toFixed(2)}`,
      citations,
      reasoning:
        "Retrieved the most similar passages from the knowledge base via vector search, then drafted a reply grounded only in those passages. Confidence reflects the top similarity and how many distinct documents agreed.",
      actions: ticket.draft?.actions ?? ["Escalate to a human", "Add a tag"],
      variant,
      alternates: {
        base: text,
        regen: text,
        concise: text,
        empathetic: text,
      },
    };
    return { draft };
  }

  async regenerate(ticket: Ticket, _kb: KbDoc[], opts: DraftProviderOptions): Promise<DraftResult> {
    return this.draft(ticket, undefined, opts);
  }

  async rewrite(ticket: Ticket, tone: Tone, opts: DraftProviderOptions): Promise<DraftResult> {
    // Restyle in a new tone. "Never say" still applies so a restyle can't
    // surface a banned phrase.
    return this.draft(ticket, tone, opts);
  }

  async answer(question: string, _kb: KbDoc[], opts: DraftProviderOptions): Promise<PlaygroundResult> {
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null) {
      // No grounded source → the refusal path (the playground shows it). The
      // confidence-threshold "held for review" affordance is computed client
      // side from the returned confidence, so a low-but-grounded answer is
      // returned normally rather than hidden here.
      return { conf: null, text: "", cites: [] };
    }
    const chunks = filterGrounded(retrieved);
    const text = await llm().draftReply({ question, contexts: chunks });
    if (findNeverSayViolation(text, opts.neverSay)) {
      return { conf: null, text: "", cites: [] };
    }
    const cites = toCitations(chunks).map((c) => `${c.title} → ${c.path}`);
    return { conf: confidence, text, cites };
  }
}

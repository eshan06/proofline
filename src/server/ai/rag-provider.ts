import type { AIDraft, DraftVariant, KbDoc, PlaygroundResult, Ticket, Tone } from "@/lib/schemas";
import type { DraftProvider, DraftProviderOptions, DraftResult } from "./provider";
import { retrieve, scoreConfidence, toCitations, filterGrounded, findNeverSayViolation } from "./rag";
import { llm } from "./llm";

/**
 * Real RAG-backed provider. Active when a database is present (so pgvector
 * retrieval is available). Implements the same DraftProvider interface as the
 * fixture mock, including the refusal contract: when retrieval finds no
 * grounded source above threshold, it returns no draft + a failure reason —
 * the AI never guesses.
 *
 * It also enforces the workspace's Copilot guardrails on the live drafting
 * path: a draft whose confidence is below the configured threshold is held for
 * human review, and a draft that trips a "never say" policy is withheld. (The
 * route passes copilot.threshold/100 and copilot.neverSay.)
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

  /**
   * Shared retrieval + drafting pass with guardrails.
   * `gateThreshold` is true for a fresh regenerate (the customer's confidence
   * bar applies) and false for a tone rewrite of an already-accepted draft
   * (restyling shouldn't suddenly refuse), but "never say" applies to both.
   */
  private async draft(
    ticket: Ticket,
    tone: Tone | undefined,
    opts: DraftProviderOptions,
    gateThreshold: boolean,
  ): Promise<DraftResult> {
    const question = this.customerQuestion(ticket);
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null) {
      return { draft: null, failureReason: "No grounded source found for this question — routing to a human." };
    }
    if (gateThreshold && confidence < opts.threshold) {
      return {
        draft: null,
        failureReason: `Draft confidence ${Math.round(confidence * 100)}% is below your ${Math.round(
          opts.threshold * 100,
        )}% bar — held for human review.`,
      };
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
    return this.draft(ticket, undefined, opts, true);
  }

  async rewrite(ticket: Ticket, tone: Tone, opts: DraftProviderOptions): Promise<DraftResult> {
    // Restyle in a new tone. The threshold gate is skipped (the agent already
    // accepted this grounded ticket); "never say" still applies so a restyle
    // can't surface a banned phrase.
    return this.draft(ticket, tone, opts, false);
  }

  async answer(question: string, _kb: KbDoc[], opts: DraftProviderOptions): Promise<PlaygroundResult> {
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null || confidence < opts.threshold) {
      // No grounded source, or below the confidence bar → the refusal path.
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

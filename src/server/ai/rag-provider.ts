import type { AIDraft, KbDoc, PlaygroundResult, Ticket, Tone } from "@/lib/schemas";
import type { DraftProvider, DraftProviderOptions, DraftResult } from "./provider";
import { retrieve, scoreConfidence, toCitations, filterGrounded } from "./rag";
import { llm } from "./llm";

/**
 * Real RAG-backed provider. Active when a database is present (so pgvector
 * retrieval is available). Implements the same DraftProvider interface as the
 * fixture mock, including the refusal contract: when retrieval finds no
 * grounded source above threshold, it returns no draft + a failure reason —
 * the AI never guesses.
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

  async regenerate(ticket: Ticket, _kb: KbDoc[], _opts: DraftProviderOptions): Promise<DraftResult> {
    const question = this.customerQuestion(ticket);
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null) {
      return { draft: null, failureReason: "No grounded source found for this question — routing to a human." };
    }
    const chunks = filterGrounded(retrieved);
    const text = await llm().draftReply({ question, customerName: ticket.customer.name, contexts: chunks });
    const citations = toCitations(chunks);
    const draft: AIDraft = {
      text,
      confidence,
      confMeta: `Grounded in ${citations.length} source${citations.length === 1 ? "" : "s"} · top similarity ${chunks[0]!.similarity.toFixed(2)}`,
      citations,
      reasoning:
        "Retrieved the most similar passages from the knowledge base via vector search, then drafted a reply grounded only in those passages. Confidence reflects the top similarity and how many distinct documents agreed.",
      actions: ticket.draft?.actions ?? ["Escalate to a human", "Add a tag"],
      variant: "regen",
      alternates: {
        base: text,
        regen: text,
        concise: text,
        empathetic: text,
      },
    };
    return { draft };
  }

  async rewrite(ticket: Ticket, tone: Tone): Promise<DraftResult> {
    // Tone rewriting reuses the current grounded draft; a real LLM would
    // re-style it. Here we re-retrieve and re-draft, tagging the variant.
    const res = await this.regenerate(ticket, [], { threshold: 0.7 });
    if (!res.draft) return res;
    return { draft: { ...res.draft, variant: tone } };
  }

  async answer(question: string, _kb: KbDoc[], _opts: DraftProviderOptions): Promise<PlaygroundResult> {
    const retrieved = await retrieve(this.workspaceId, question, 4);
    const confidence = scoreConfidence(retrieved);
    if (confidence == null) {
      return { conf: null, text: "", cites: [] };
    }
    const chunks = filterGrounded(retrieved);
    const text = await llm().draftReply({ question, contexts: chunks });
    const cites = toCitations(chunks).map((c) => `${c.title} → ${c.path}`);
    return { conf: confidence, text, cites };
  }
}

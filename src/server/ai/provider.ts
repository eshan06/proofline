import type { AIDraft, KbDoc, PlaygroundResult, Ticket, Tone } from "@/lib/schemas";

/**
 * The single seam between the product and the AI pipeline.
 *
 * A production implementation runs the full RAG pass behind each method:
 * ingestion → chunking → embedding → retrieval → drafting → citation
 * extraction → confidence scoring. The UI must never know which provider is
 * active — both providers return the identical shape, including the refusal
 * path: when no grounded source exists the result carries `draft: null` plus a
 * human-readable `failureReason`. The AI never silently guesses.
 */

export type DraftResult =
  | { draft: AIDraft; failureReason?: undefined }
  | { draft: null; failureReason: string };

export interface DraftProviderOptions {
  /** Confidence threshold (0–1) below which drafts are flagged/held. */
  threshold: number;
}

export interface DraftProvider {
  /** Regenerate the draft for a ticket (full retrieval + drafting pass). */
  regenerate(ticket: Ticket, kb: KbDoc[], opts: DraftProviderOptions): Promise<DraftResult>;
  /** Rewrite the current draft in a different tone (no re-retrieval). */
  rewrite(ticket: Ticket, tone: Tone): Promise<DraftResult>;
  /** Answer a free-form question against the knowledge base (playground / chat widget). */
  answer(question: string, kb: KbDoc[], opts: DraftProviderOptions): Promise<PlaygroundResult>;
}

/** Latency contract from the design handoff — lives with the provider, not the UI. */
export const MOCK_LATENCY = {
  regenerate: 1100,
  tone: 750,
  playground: 1400,
  kbIndexing: 2200,
} as const;

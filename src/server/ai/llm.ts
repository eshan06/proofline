import type { RetrievedChunk } from "./rag";

/**
 * The generation half of the pipeline. A real deployment sets LLM_PROVIDER and
 * a key; the TemplateLLM composes a grounded reply from the retrieved context
 * with no API — lower fluency, but genuinely drawn from the cited sources (it
 * never invents facts beyond the context, preserving the "shows its work"
 * contract). Swap behind this interface without touching the RAG layer.
 */
export interface LLMProvider {
  /** Draft a support reply grounded ONLY in the provided context chunks. */
  draftReply(input: { question: string; customerName?: string; contexts: RetrievedChunk[] }): Promise<string>;
}

export class TemplateLLM implements LLMProvider {
  async draftReply({ customerName, contexts }: { question: string; customerName?: string; contexts: RetrievedChunk[] }): Promise<string> {
    const name = customerName?.split(" ")[0];
    const greeting = name ? `Hi ${name} — ` : "Hi — ";
    const top = contexts[0];
    if (!top) {
      return `${greeting}thanks for reaching out. Let me look into this and follow up shortly.`;
    }
    // Ground the body in the highest-similarity passage; add the second source
    // as supporting detail when it adds a distinct doc.
    const body = firstSentences(top.content, 2);
    const support = contexts.find((c) => c.docId !== top.docId);
    const supportLine = support ? ` ${firstSentences(support.content, 1)}` : "";
    return `${greeting}thanks for the details. ${body}${supportLine}\n\nIf anything still looks off, reply here and we'll jump right back on it.`;
  }
}

function firstSentences(text: string, n: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, n).join(" ").trim();
}

let cached: LLMProvider | null = null;

export function llm(): LLMProvider {
  if (cached) return cached;
  const kind = process.env.LLM_PROVIDER ?? "template";
  switch (kind) {
    case "anthropic":
    case "openai":
      // TODO(real-llm): construct the API-backed drafter here. It must be
      // instructed to answer ONLY from the provided context and to abstain when
      // the context is insufficient (return an empty/again-flagged draft).
      console.warn(`[llm] LLM_PROVIDER="${kind}" not wired yet; using TemplateLLM.`);
      cached = new TemplateLLM();
      return cached;
    default:
      cached = new TemplateLLM();
      return cached;
  }
}

import type { RetrievedChunk } from "./rag";
import { logger } from "@/server/logger";

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

/**
 * Real LLM drafter via OpenAI's chat completions API (no SDK — a single fetch,
 * nothing extra to bundle). Active when LLM_PROVIDER=openai + OPENAI_API_KEY.
 * It is only ever invoked with grounded context (the RAG layer refuses before
 * drafting when nothing clears the grounding bar) and is instructed to use ONLY
 * that context — preserving the "shows its work" contract. On any API error it
 * degrades gracefully to the extractive TemplateLLM rather than failing the request.
 */
export class OpenAILLM implements LLMProvider {
  private fallback = new TemplateLLM();
  constructor(
    private apiKey: string,
    private model: string = process.env.AI_MODEL || "gpt-4o-mini",
  ) {}

  async draftReply(input: { question: string; customerName?: string; contexts: RetrievedChunk[] }): Promise<string> {
    if (!input.contexts.length) return this.fallback.draftReply(input);
    const sources = input.contexts
      .map((c, i) => `[${i + 1}] ${c.docTitle}${c.path ? ` — ${c.path}` : ""}:\n${c.content}`)
      .join("\n\n");
    const system =
      "You are a customer-support agent. Write a concise, warm reply that answers the customer using ONLY the facts in the provided sources. " +
      "Never invent policies, numbers, dates, or commitments that aren't in the sources. If the sources don't fully answer the question, " +
      "address what they do cover and offer to follow up. Do not mention the word 'sources' or any citation numbers in your reply.";
    const user = `${input.customerName ? `Customer name: ${input.customerName}\n` : ""}Customer question:\n${input.question}\n\nSources:\n${sources}`;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          max_tokens: 400,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        logger.warn("llm.openai_http_error", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 200) });
        return this.fallback.draftReply(input);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || this.fallback.draftReply(input);
    } catch (err) {
      logger.warn("llm.openai_exception", { error: err instanceof Error ? err.message : String(err) });
      return this.fallback.draftReply(input);
    }
  }
}

let cached: LLMProvider | null = null;

export function llm(): LLMProvider {
  if (cached) return cached;
  const kind = process.env.LLM_PROVIDER ?? "template";
  switch (kind) {
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        logger.warn("llm.openai_key_missing", { fallback: "TemplateLLM" });
        cached = new TemplateLLM();
        return cached;
      }
      cached = new OpenAILLM(key);
      return cached;
    }
    case "anthropic":
      // TODO(anthropic): construct the Anthropic-backed drafter (same contract:
      // answer only from context, abstain when insufficient).
      logger.warn("llm.anthropic_not_wired", { fallback: "TemplateLLM" });
      cached = new TemplateLLM();
      return cached;
    default:
      cached = new TemplateLLM();
      return cached;
  }
}

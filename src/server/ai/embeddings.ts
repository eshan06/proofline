import { EMBEDDING_DIM } from "@/server/db/schema";
import { logger } from "@/server/logger";

/**
 * Embedding provider. The UI/RAG layer depends only on this interface; the
 * active implementation is chosen by env. A real deployment sets
 * EMBEDDINGS_PROVIDER=openai|voyage and a key; with neither, the LocalEmbedder
 * produces deterministic hashed TF vectors — genuinely functional lexical
 * retrieval (cosine similarity reflects real token overlap), no network/key.
 */
export interface EmbeddingProvider {
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Hashed bag-of-words embedder with sublinear TF weighting + L2 normalization.
 * Not semantic, but a real vector embedding: similar text → high cosine sim.
 * Deterministic, dependency-free, dimension = EMBEDDING_DIM.
 */
export class LocalEmbedder implements EmbeddingProvider {
  readonly dim = EMBEDDING_DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    const counts = new Map<string, number>();
    for (const tok of tokenize(text)) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    for (const [tok, count] of counts) {
      const tf = 1 + Math.log(count);
      // Two hashed buckets per token reduce collisions; signed to spread mass.
      const h1 = hash(tok) % this.dim;
      const h2 = hash(`${tok}#2`) % this.dim;
      vec[h1]! += tf;
      vec[h2]! += tf * 0.5;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Real semantic embeddings via OpenAI (text-embedding-3-small). Crucially it
 * requests `dimensions: EMBEDDING_DIM`, so the returned vectors fit the existing
 * pgvector column — switching providers needs a KB re-index (the lexical and
 * semantic vector spaces differ) but NOT a schema/dimension migration. Errors
 * throw rather than silently falling back to lexical vectors, which would mix
 * vector spaces and quietly wreck retrieval.
 */
export class OpenAIEmbedder implements EmbeddingProvider {
  readonly dim = EMBEDDING_DIM;
  constructor(private apiKey: string, private model: string = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small") {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dim }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }
}

let cached: EmbeddingProvider | null = null;

export function embedder(): EmbeddingProvider {
  if (cached) return cached;
  const kind = process.env.EMBEDDINGS_PROVIDER ?? "local";
  switch (kind) {
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        logger.warn("embeddings.openai_key_missing", { fallback: "LocalEmbedder" });
        cached = new LocalEmbedder();
        return cached;
      }
      cached = new OpenAIEmbedder(key);
      return cached;
    }
    case "voyage":
      // TODO(voyage): same one-fetch shape against the Voyage embeddings API.
      logger.warn("embeddings.voyage_not_wired", { fallback: "LocalEmbedder" });
      cached = new LocalEmbedder();
      return cached;
    default:
      cached = new LocalEmbedder();
      return cached;
  }
}

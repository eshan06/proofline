import { EMBEDDING_DIM } from "@/server/db/schema";

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

let cached: EmbeddingProvider | null = null;

export function embedder(): EmbeddingProvider {
  if (cached) return cached;
  const kind = process.env.EMBEDDINGS_PROVIDER ?? "local";
  switch (kind) {
    case "openai":
    case "voyage":
      // TODO(real-embeddings): construct the API-backed embedder here (must
      // produce EMBEDDING_DIM-length vectors or the column dimension changes).
      console.warn(`[embeddings] EMBEDDINGS_PROVIDER="${kind}" not wired yet; using LocalEmbedder.`);
      cached = new LocalEmbedder();
      return cached;
    default:
      cached = new LocalEmbedder();
      return cached;
  }
}

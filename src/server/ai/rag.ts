import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { uid } from "@/lib/utils";
import { embedder } from "./embeddings";
import { KB_CORPUS } from "@/data/kb-corpus";
import type { Citation } from "@/lib/schemas";

/**
 * The retrieval half of the RAG pipeline, on pgvector.
 *
 *   ingestion → chunking → embedding → store        (ingestDocument)
 *   query → embed → cosine kNN → citations + score   (retrieve)
 *
 * Drafting (the LLM call) is a separate concern (see llm.ts); this module is
 * what makes "grounded, cited, confidence-scored" real rather than fixtures.
 */

/** Split text into overlapping word-window chunks. */
export function chunkText(text: string, windowWords = 60, overlap = 15): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= windowWords) return [words.join(" ")];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += windowWords - overlap) {
    chunks.push(words.slice(i, i + windowWords).join(" "));
    if (i + windowWords >= words.length) break;
  }
  return chunks;
}

export interface RetrievedChunk {
  docId: string;
  docTitle: string;
  path: string;
  content: string;
  similarity: number; // cosine similarity in [0,1]
}

/** Ingest a document's sections into kb_chunks (chunk → embed → store). */
export async function ingestDocument(input: {
  workspaceId: string;
  docId: string;
  docTitle: string;
  sections: { path: string; text: string }[];
}): Promise<number> {
  const db = getDb();
  const emb = embedder();

  const rows: { id: string; docId: string; workspaceId: string; docTitle: string; path: string; content: string; embedding: number[] }[] = [];
  for (const section of input.sections) {
    const chunks = chunkText(section.text);
    const vectors = await emb.embed(chunks);
    chunks.forEach((content, i) => {
      rows.push({
        id: uid("ch"),
        docId: input.docId,
        workspaceId: input.workspaceId,
        docTitle: input.docTitle,
        path: section.path,
        content,
        embedding: vectors[i]!,
      });
    });
  }
  if (rows.length) await db.insert(schema.kbChunks).values(rows);
  return rows.length;
}

/** Ingest the full seed corpus for a freshly-created workspace. */
export async function ingestSeedCorpus(workspaceId: string): Promise<number> {
  let total = 0;
  for (const [docId, doc] of Object.entries(KB_CORPUS)) {
    total += await ingestDocument({
      workspaceId,
      docId: `${workspaceId}_${docId}`,
      docTitle: doc.title,
      sections: doc.sections,
    });
  }
  return total;
}

/** Embed the query and return the top-k most similar chunks via pgvector. */
export async function retrieve(workspaceId: string, query: string, k = 4): Promise<RetrievedChunk[]> {
  const db = getDb();
  const [qvec] = await embedder().embed([query]);
  const vectorLiteral = `[${qvec!.join(",")}]`;

  // Cosine distance operator <=>; similarity = 1 - distance.
  const rows = await db
    .select({
      docId: schema.kbChunks.docId,
      docTitle: schema.kbChunks.docTitle,
      path: schema.kbChunks.path,
      content: schema.kbChunks.content,
      distance: sql<number>`${schema.kbChunks.embedding} <=> ${vectorLiteral}::vector`,
    })
    .from(schema.kbChunks)
    .where(and(eq(schema.kbChunks.workspaceId, workspaceId), sql`${schema.kbChunks.embedding} IS NOT NULL`))
    .orderBy(sql`${schema.kbChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(k);

  return rows.map((r) => ({
    docId: r.docId,
    docTitle: r.docTitle,
    path: r.path,
    content: r.content,
    similarity: Math.max(0, Math.min(1, 1 - Number(r.distance))),
  }));
}

/**
 * Confidence from retrieval quality: anchored on the top similarity, nudged by
 * multi-source agreement. Mirrors the design's "top similarity" + "grounded in
 * N sources" framing. Returns null when nothing is grounded (the refusal path).
 */
/**
 * The similarity bar a chunk must clear to count as a grounded source. Tuned
 * for the LocalEmbedder's lexical magnitudes; a real semantic embedder would
 * sit higher. Below this ⇒ refuse (the AI never guesses).
 */
export const GROUNDING_THRESHOLD = 0.2;

/** Keep only chunks that clear the grounding bar. */
export function filterGrounded(chunks: RetrievedChunk[], min = GROUNDING_THRESHOLD): RetrievedChunk[] {
  return chunks.filter((c) => c.similarity >= min);
}

export function scoreConfidence(chunks: RetrievedChunk[], minSimilarity = GROUNDING_THRESHOLD): number | null {
  // Only chunks that clear the grounding bar count. No grounded chunk ⇒ refuse.
  const grounded = chunks.filter((c) => c.similarity >= minSimilarity);
  if (grounded.length === 0) return null;
  const top = grounded[0]!.similarity;
  const distinctDocs = new Set(grounded.map((c) => c.docId)).size;
  const coverageBonus = Math.min(0.1, (distinctDocs - 1) * 0.05);
  // Map raw similarity into a presentable confidence band.
  return Math.max(0.45, Math.min(0.98, 0.5 + top * 0.5 + coverageBonus));
}

/** Build display citations from retrieved chunks, de-duplicated by doc+path. */
export function toCitations(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Set<string>();
  const cites: Citation[] = [];
  for (const c of chunks) {
    const key = `${c.docTitle}::${c.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cites.push({
      title: c.docTitle,
      path: c.path,
      snippet: c.content.length > 220 ? `${c.content.slice(0, 217)}…` : c.content,
      uses: Math.round(c.similarity * 100),
    });
  }
  return cites;
}

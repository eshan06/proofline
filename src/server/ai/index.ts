import type { DraftProvider } from "./provider";
import { mockDraftProvider } from "./mock-provider";
import { RagDraftProvider } from "./rag-provider";
import { hasDatabase } from "@/server/db/client";

/**
 * Draft-provider selection.
 *
 * - With a database, the real RAG provider runs pgvector retrieval +
 *   (templated or LLM) drafting, scoped to the caller's workspace.
 * - Without a database, the deterministic fixture mock keeps the demo and
 *   tests working with zero setup.
 *
 * Either way the route handlers depend only on the DraftProvider interface and
 * the refusal contract (no grounded source ⇒ draft: null + failureReason).
 */
export function getDraftProvider(workspaceId: string): DraftProvider {
  return hasDatabase() ? new RagDraftProvider(workspaceId) : mockDraftProvider;
}

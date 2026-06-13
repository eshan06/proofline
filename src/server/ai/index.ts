import type { DraftProvider } from "./provider";
import { mockDraftProvider } from "./mock-provider";

/**
 * Provider selection. The UI and route handlers depend only on the
 * DraftProvider interface, so swapping to a real LLM-backed RAG pipeline is an
 * env-var change here — no UI churn.
 *
 *   AI_PROVIDER=mock      (default) fixture-backed, deterministic, no network
 *   AI_PROVIDER=anthropic real provider (wire up in the marked branch)
 *   AI_PROVIDER=openai    real provider (wire up in the marked branch)
 *
 * Real providers should implement DraftProvider (generateDraft/rewrite/answer)
 * as a full pass: ingestion → chunking → embedding → retrieval → drafting →
 * citation extraction → confidence scoring, preserving the refusal contract
 * (no grounded source ⇒ draft: null + failureReason).
 */
function selectProvider(): DraftProvider {
  const kind = process.env.AI_PROVIDER ?? "mock";
  switch (kind) {
    case "anthropic":
    case "openai":
      // TODO(real-provider): construct the LLM-backed provider here. Until one
      // is wired, fall back to the mock rather than crashing the app, and warn.
      console.warn(
        `[ai] AI_PROVIDER="${kind}" requested but no real provider is wired yet; using the mock provider.`,
      );
      return mockDraftProvider;
    case "mock":
    default:
      return mockDraftProvider;
  }
}

/** The active provider used by route handlers. */
export const draftProvider: DraftProvider = selectProvider();

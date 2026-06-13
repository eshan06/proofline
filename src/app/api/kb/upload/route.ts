import { handleApi, requireSession, trackEvent } from "@/server/api";
import { MOCK_LATENCY } from "@/server/ai/provider";
import { addKbDoc, completeDemoStep, getSession, updateKbDoc } from "@/server/store";

/**
 * Mock upload: a new document lands in "processing" immediately and flips to
 * "indexed · 26 chunks" after the indexing latency (2.2s), matching the
 * design's KB upload flow. The flip happens server-side; the client polls via
 * its workspace query refetch.
 */
export async function POST() {
  return handleApi(async () => {
    const session = await requireSession();
    const doc = addKbDoc(session, {
      name: "Refund-policy-v3.pdf",
      source: "Upload",
      status: "processing",
      chunks: "…",
      cited: "0",
      synced: "just now",
    });

    if (completeDemoStep(session, "upload")) {
      trackEvent(session, "demo_step_completed", { step: "upload" });
    }

    const sessionId = session.id;
    const docId = doc.id;
    setTimeout(() => {
      const live = getSession(sessionId);
      if (!live) return;
      try {
        updateKbDoc(live, docId, { status: "indexed", chunks: "26" });
      } catch {
        /* session reseeded mid-flight — nothing to update */
      }
    }, MOCK_LATENCY.kbIndexing);

    return doc;
  });
}

import { handleApi, requireSession, trackEvent } from "@/server/api";
import { MOCK_LATENCY } from "@/server/ai/provider";
import { repo } from "@/server/repository";

/**
 * Mock upload: a new document lands in "processing" immediately and flips to
 * "indexed · 26 chunks" after the indexing latency (2.2s). The flip happens
 * server-side (workspace-scoped); the client polls via its workspace refetch.
 */
export async function POST() {
  return handleApi(async () => {
    const session = await requireSession();
    const r = repo();
    const doc = await r.addKbDoc(session.workspaceId, {
      name: "Refund-policy-v3.pdf",
      source: "Upload",
      status: "processing",
      chunks: "…",
      cited: "0",
      synced: "just now",
    });

    if (await r.completeDemoStep(session.id, "upload")) {
      trackEvent(session, "demo_step_completed", { step: "upload" });
    }

    const { workspaceId } = session;
    const docId = doc.id;
    setTimeout(() => {
      void r.updateKbDoc(workspaceId, docId, { status: "indexed", chunks: "26" }).catch(() => {});
    }, MOCK_LATENCY.kbIndexing);

    return doc;
  });
}

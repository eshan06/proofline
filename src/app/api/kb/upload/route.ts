import { ApiError, handleApi, requireRole, requireSession, trackEvent, enforceRateLimitKey } from "@/server/api";
import { LIMITS } from "@/server/rate-limit";
import { MOCK_LATENCY } from "@/server/ai/provider";
import { repo } from "@/server/repository";
import { hasDatabase } from "@/server/db/client";
import { chunkText, ingestDocument } from "@/server/ai/rag";
import { logger } from "@/server/logger";

/** Cap on extracted text length (post-decompression), bounding embed cost/memory. */
const MAX_EXTRACT_CHARS = 1_000_000;

/**
 * Knowledge-base upload. Two paths share this endpoint:
 *
 *  • Real upload (multipart/form-data with a `file`): the file's text is
 *    extracted, a doc is created, and — when a database is configured — the
 *    text is chunked, embedded, and stored in pgvector via `ingestDocument`, so
 *    the content is genuinely retrievable by the copilot. (In the zero-setup
 *    in-memory backend there is no vector store, so we record the doc + real
 *    chunk count but retrieval stays on the fixture corpus.)
 *
 *  • Canned demo path (no file): preserves the guided demo / `?upload=1` flow —
 *    a "Refund-policy-v3.pdf" doc lands in "processing" and flips to indexed.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    const session = await requireSession();
    await requireRole(session, ["Admin", "Agent"]);
    // Gate the heavy parse+embed work per workspace (no IP component — the cap
    // is on the tenant's aggregate load) so one seat can't pin CPU.
    await enforceRateLimitKey(`upload:${session.workspaceId}`, LIMITS.upload);
    const r = repo();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "No file provided.");
      const MAX_BYTES = 10 * 1024 * 1024;
      if (file.size > MAX_BYTES) throw new ApiError(413, "File too large — the limit is 10 MB.");
      const name = (file.name || "Untitled.txt").slice(0, 160);
      let text = await extractText(file, name);
      if (!text.trim()) throw new ApiError(400, "That file appears to be empty.");
      // Cap post-decompression text so a small archive that expands to huge text
      // (a decompression bomb) can't drive unbounded chunking/embedding.
      if (text.length > MAX_EXTRACT_CHARS) {
        logger.warn("kb.extract_truncated", { name, originalChars: text.length });
        text = text.slice(0, MAX_EXTRACT_CHARS);
      }

      const doc = await r.addKbDoc(session.workspaceId, {
        name,
        source: "Upload",
        status: "processing",
        chunks: "…",
        cited: "0",
        synced: "just now",
      });

      try {
        const chunkCount = hasDatabase()
          ? await ingestDocument({
              workspaceId: session.workspaceId,
              docId: `${session.workspaceId}_${doc.id}`,
              docTitle: name,
              sections: [{ path: name, text }],
            })
          : chunkText(text).length;
        const updated = await r.updateKbDoc(session.workspaceId, doc.id, {
          status: "indexed",
          chunks: String(chunkCount),
        });
        if (await r.completeDemoStep(session.id, "upload")) {
          trackEvent(session, "demo_step_completed", { step: "upload" });
        }
        logger.event("kb.document_ingested", { workspaceId: session.workspaceId, name, chunks: chunkCount });
        return updated;
      } catch (err) {
        logger.error("kb.ingest_failed", { name, error: err instanceof Error ? err.message : String(err) });
        return r.updateKbDoc(session.workspaceId, doc.id, { status: "failed", chunks: "0" });
      }
    }

    // Canned demo path (no file): mirrors the original mock so the guided demo
    // and `?upload=1` quick action keep working with zero input.
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

const TEXT_EXT = /\.(txt|text|md|markdown|csv|tsv|json|log|rst)$/i;
const HTML_EXT = /\.(html?|xml)$/i;

/**
 * Extract plain text from an uploaded file. Text and Markdown are read
 * directly; HTML has its tags stripped. Binary formats (PDF/DOCX) require a
 * parser we don't bundle yet — surfaced as a clear 415 rather than ingesting
 * garbage.
 */
async function extractText(file: File, name: string): Promise<string> {
  const type = file.type.toLowerCase();
  if (type.startsWith("text/") || TEXT_EXT.test(name) || type === "application/json") {
    return file.text();
  }
  if (type === "text/html" || HTML_EXT.test(name)) {
    const raw = await file.text();
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    const buf = new Uint8Array(await file.arrayBuffer());
    // Sniff the magic bytes (%PDF) so a mislabeled file can't be steered into the
    // PDF parser by extension/MIME alone.
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
      throw new ApiError(415, "That file isn't a valid PDF.");
    }
    try {
      // Lazy-load the parser so it never bloats the main server bundle.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      return (await parser.getText()).text;
    } catch {
      throw new ApiError(422, "Couldn't extract text from that PDF — it may be scanned (image-only) or corrupt.");
    }
  }
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(name)) {
    const buf = Buffer.from(await file.arrayBuffer());
    // DOCX is a zip — sniff the local-file-header magic (PK\x03\x04).
    if (!(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)) {
      throw new ApiError(415, "That file isn't a valid .docx document.");
    }
    try {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer: buf })).value;
    } catch {
      throw new ApiError(422, "Couldn't read that Word document.");
    }
  }
  throw new ApiError(
    415,
    "Unsupported file type. Upload a .txt, .md, .csv, .json, .html, .pdf, or .docx file (legacy .doc isn't supported).",
  );
}

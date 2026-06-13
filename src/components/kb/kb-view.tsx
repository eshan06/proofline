"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { useWorkspace, WORKSPACE_KEY } from "@/hooks/use-workspace";
import { api } from "@/lib/api-client";
import { toast } from "@/stores/toasts";
import type { KbDoc } from "@/lib/schemas";

const GRID = "grid-cols-[1fr_110px_120px_70px_70px_110px]";

const connectors = [
  { glyph: "N", fg: "#E6EAF2", label: "Notion", meta: "5 docs syncing", btn: "Connected", btnFg: "#3DD68C", toastMsg: "Notion sync is healthy — next sync in 18m" },
  { glyph: "G", fg: "#9DB7FF", label: "Google Docs", meta: "Not connected", btn: "Connect", btnFg: "#C6CCDA", toastMsg: "Google Docs OAuth flow — connect your account" },
  { glyph: "H", fg: "#C4B0F8", label: "Help Center", meta: "1 collection", btn: "Connected", btnFg: "#3DD68C", toastMsg: "Help Center sync is healthy" },
];

function statusStyle(status: KbDoc["status"]) {
  if (status === "indexed") return { fg: "#3DD68C", label: "Indexed" };
  if (status === "processing") return { fg: "#F5B74E", label: "Processing" };
  return { fg: "#F36C6C", label: "Failed" };
}

export function KbView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: ws } = useWorkspace();
  const docs = useMemo(() => ws?.kbDocs ?? [], [ws?.kbDocs]);
  const uploadingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Canned demo upload (guided demo / ?upload=1 / palette) — no real file.
  const upload = async () => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    toast("Uploading “Refund-policy-v3.pdf”…");
    try {
      await api.uploadKbDoc();
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
    } finally {
      uploadingRef.current = false;
    }
  };

  // Real upload: parse + index the selected file's text into the knowledge base.
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    toast(`Uploading “${file.name}”…`);
    try {
      const doc = (await api.uploadKbDoc(file)) as KbDoc;
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      if (doc.status === "indexed") toast(`Indexed “${doc.name}” — ${doc.chunks} chunks`);
      else if (doc.status === "failed") toast(`Couldn't index “${doc.name}”`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed");
    }
  };

  // ?upload=1 (home quick action / palette / demo checklist) triggers the flow once.
  useEffect(() => {
    if (searchParams.get("upload") === "1") {
      void upload();
      router.replace("/kb");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While any doc is processing, poll so the server-side index flip (2.2s) shows.
  const anyProcessing = docs.some((d) => d.status === "processing");
  useEffect(() => {
    if (!anyProcessing) return;
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
    }, 600);
    return () => clearInterval(id);
  }, [anyProcessing, queryClient]);

  // Toast once when the upload completes.
  const prevProcessing = useRef(false);
  useEffect(() => {
    if (prevProcessing.current && !anyProcessing) {
      const v3 = docs.find((d) => d.name === "Refund-policy-v3.pdf");
      if (v3?.status === "indexed") toast("Indexed “Refund-policy-v3.pdf” — 26 chunks");
    }
    prevProcessing.current = anyProcessing;
  }, [anyProcessing, docs]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[980px] px-8 pb-10 pt-[26px]">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Knowledge Base</div>
            <div className="text-[12px] text-muted">Everything the AI is allowed to cite. 7 sources · 161 chunks indexed</div>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => toast("Add URL — paste a public docs link to crawl")}
            className="rounded-[7px] border border-white/9 bg-white/5 px-[13px] py-[7px] text-[12px] font-medium text-ink-2 hover:bg-white/9"
          >
            Add URL
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.text,.md,.markdown,.csv,.tsv,.json,.log,.rst,.html,.htm,.xml,text/*,application/json"
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-[7px] border-0 bg-accent px-[13px] py-[7px] text-[12px] font-semibold text-white hover:bg-accent-hover"
            style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
          >
            <Plus size={13} strokeWidth={1.4} />
            <span>Upload docs</span>
          </button>
        </div>

        {/* connectors */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {connectors.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 rounded-[10px] border border-white/7 bg-card px-3.5 py-3">
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/8 bg-white/5 font-mono text-[12px] font-semibold"
                style={{ color: c.fg }}
              >
                {c.glyph}
              </div>
              <div className="flex flex-col gap-px">
                <span className="text-[12.5px] font-semibold text-ink">{c.label}</span>
                <span className="text-[10.5px] text-muted">{c.meta}</span>
              </div>
              <button
                type="button"
                onClick={() => toast(c.toastMsg)}
                className="ml-auto rounded-[6px] border border-white/10 bg-transparent px-2.5 py-1 text-[11px] font-medium hover:border-accent/50"
                style={{ color: c.btnFg }}
              >
                {c.btn}
              </button>
            </div>
          ))}
        </div>

        {/* doc table */}
        <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
          <div className={`grid ${GRID} gap-2.5 border-b border-white/7 px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted`}>
            <span>Document</span>
            <span>Source</span>
            <span>Status</span>
            <span className="text-right">Chunks</span>
            <span className="text-right">Cited</span>
            <span className="text-right">Last synced</span>
          </div>
          {docs.map((d) => {
            const st = statusStyle(d.status);
            return (
              <div key={d.id} className={`grid ${GRID} cursor-pointer items-center gap-2.5 border-b border-white/[0.04] px-4 py-[11px] hover:bg-white/[0.025]`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText size={13} strokeWidth={1.4} className="text-muted" />
                  <span className="truncate text-[12.5px] font-medium text-[#D6DCE8]">{d.name}</span>
                </div>
                <span className="text-[11.5px] text-ink-4">{d.source}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: st.fg }}>
                  {d.status === "processing" ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                      style={{ borderColor: "rgba(245,183,78,0.25)", borderTopColor: st.fg, animation: "plSpin 0.8s linear infinite" }}
                    />
                  ) : (
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: st.fg }} />
                  )}
                  <span>{st.label}</span>
                </span>
                <span className="text-right font-mono text-[11px] text-ink-4">{d.chunks}</span>
                <span className="text-right font-mono text-[11px] text-ink-4">{d.cited}</span>
                <span className="text-right font-mono text-[10.5px] text-muted">{d.synced}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-faint">
          <AlertTriangle size={13} strokeWidth={1.4} className="text-danger" />
          <span>
            1 source failed to index — “SSO configuration guide.pdf” exceeds the 50 MB limit. The AI
            cannot answer SSO questions until this is fixed.
          </span>
        </div>
      </div>
    </div>
  );
}

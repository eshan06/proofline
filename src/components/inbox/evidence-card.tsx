"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "@/stores/toasts";
import type { Citation } from "@/lib/schemas";

/** Expandable citation card — number badge, doc title, path, quoted snippet. */
export function EvidenceCard({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen((o) => !o)}
      className="cursor-pointer rounded-[9px] border bg-white/[0.025] px-3 py-[9px] hover:border-accent/45"
      style={{ borderColor: open ? "rgba(77,124,254,0.4)" : "rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-accent/15 font-mono text-[9.5px] text-accent-soft">
          {index + 1}
        </span>
        <span className="text-[12px] font-semibold text-[#D6DCE8]">{citation.title}</span>
        <span
          className="ml-auto text-[9px] text-muted transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </div>
      <div className="ml-6 mt-1 font-mono text-[10px] text-muted">{citation.path}</div>
      {open ? (
        <div className="ml-6 mb-0.5 mt-[9px] flex flex-col gap-[7px]">
          <div className="rounded-[7px] border border-white/6 bg-black/30 px-[11px] py-2 text-[11.5px] italic leading-[1.55] text-ink-3">
            “{citation.snippet}”
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted">Cited {citation.uses}× this month</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast(`Opening “${citation.title}” in the knowledge base`);
              }}
              className="ml-auto flex items-center gap-1 border-0 bg-transparent text-[11px] text-accent"
            >
              Open doc <ExternalLink size={11} strokeWidth={1.4} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

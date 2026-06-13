"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";

const MARK = "linear-gradient(transparent 62%, rgba(77,124,254,0.28) 62%)";
const MARK_HOVER = "linear-gradient(transparent 62%, rgba(77,124,254,0.5) 62%)";

/**
 * The interactive proof card from the hero. Clicking a highlighted phrase or
 * its source row toggles the cited quote; Approve & send / Edit drive the
 * sent + editing states and swap the floating receipt pill.
 */
export function HeroProofCard() {
  const [sel, setSel] = useState(0);
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    "Confirmed — invoice #INV-2235 duplicates #INV-2231. I've issued a full refund to your original card — it'll appear within 5–10 business days.",
  );
  const [hover, setHover] = useState(0);

  const toggle = (n: number) => setSel((s) => (s === n ? 0 : n));

  return (
    <div className="relative" style={{ animation: "plUp 0.7s 0.18s ease both" }}>
      <div
        className="pointer-events-none absolute rounded-[16px]"
        style={{ inset: -1, background: "linear-gradient(150deg, rgba(77,124,254,0.4), rgba(77,124,254,0) 45%)" }}
      />
      <div
        className="relative overflow-hidden rounded-[15px] border border-white/9"
        style={{ background: "linear-gradient(180deg, rgba(19,24,38,0.96), rgba(12,15,23,0.96))", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-white/6 px-[15px] py-[11px]">
          <Sparkles size={14} strokeWidth={1.4} className="text-accent" />
          <span className="text-[11.5px] font-semibold text-ink-2">Proofline draft</span>
          <span className="font-mono text-[10px] text-faint">· TKT-1031</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] text-success">
            <span className="h-[5px] w-[5px] rounded-full bg-success" />0.94 conf
          </span>
        </div>

        <div className="flex flex-col gap-3 px-4 py-[15px]">
          {/* customer bubble */}
          <div className="flex gap-[9px]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold" style={{ background: "hsl(30 45% 22%)", color: "hsl(30 78% 72%)" }}>PR</span>
            <div className="rounded-[3px_10px_10px_10px] border border-white/6 bg-panel px-[11px] py-2 text-[12px] leading-[1.5] text-ink-3">
              I was charged twice for our March invoice — can you refund the duplicate?
            </div>
          </div>

          {/* AI answer */}
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[96px] w-full resize-none rounded-[10px] border border-accent/45 bg-black/30 px-[13px] py-[11px] text-[12.5px] leading-[1.65] text-ink"
              style={{ boxShadow: "0 0 0 3px rgba(77,124,254,0.12)" }}
            />
          ) : (
            <div className="rounded-[10px] border border-accent/22 bg-accent/5 px-[13px] py-3 text-[12.5px] leading-[1.7] text-[#D6DCE8]">
              Confirmed — invoice #INV-2235{" "}
              <span
                onClick={() => toggle(1)}
                onMouseEnter={() => setHover(1)}
                onMouseLeave={() => setHover(0)}
                className="relative cursor-pointer rounded-[2px] px-px"
                style={{ background: hover === 1 ? MARK_HOVER : MARK }}
              >
                duplicates #INV-2231
                <sup className="align-super font-mono text-[0.66em] font-semibold text-accent-soft-2">1</sup>
              </span>
              . I&apos;ve issued a{" "}
              <span
                onClick={() => toggle(2)}
                onMouseEnter={() => setHover(2)}
                onMouseLeave={() => setHover(0)}
                className="relative cursor-pointer rounded-[2px] px-px"
                style={{ background: hover === 2 ? MARK_HOVER : MARK }}
              >
                full refund to your original card
                <sup className="align-super font-mono text-[0.66em] font-semibold text-accent-soft-2">2</sup>
              </span>{" "}
              — it&apos;ll appear within 5–10 business days.
            </div>
          )}

          {/* sources */}
          <div className="flex flex-col gap-2 border-t border-dashed border-white/10 pt-[11px]">
            <span className="font-mono text-[9.5px] tracking-[0.1em] text-muted">SOURCES · tap to inspect</span>
            <SourceRow n={1} title="Refund policy" path="→ Duplicate charges" score="0.93" open={sel === 1} onClick={() => toggle(1)} quote="Duplicate charges are refunded in full to the original payment method within 5–10 business days. A credit note is generated automatically." />
            <SourceRow n={2} title="Billing operations" path="→ Retried payment jobs" score="0.90" open={sel === 2} onClick={() => toggle(2)} quote="A known race in the retry worker can produce duplicate invoices. Refund the newer invoice and link both refs in the resolution." />
          </div>

          {/* actions / sent */}
          {sent ? (
            <div className="flex items-center justify-center gap-1.5 rounded-[7px] border border-success/35 bg-success/12 py-2 text-[11.5px] font-semibold text-success" style={{ animation: "plUp 0.3s ease both" }}>
              <Check size={13} strokeWidth={1.5} />Sent to Priya Raman · just now
            </div>
          ) : (
            <div className="flex gap-[7px]">
              <button type="button" onClick={() => { setSent(true); setEditing(false); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] border-0 bg-accent py-2 text-[11.5px] font-semibold text-white hover:bg-accent-hover">
                <Check size={13} strokeWidth={1.5} />Approve &amp; send
              </button>
              <button type="button" onClick={() => setEditing((e) => !e)} className="flex items-center rounded-[7px] border border-white/10 bg-white/5 px-3.5 py-2 text-[11.5px] text-ink-2 hover:border-accent/50 hover:text-accent-soft">
                {editing ? "Done" : "Edit"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* floating receipt pill */}
      {sent ? (
        <div className="absolute flex items-center gap-1.5 rounded-full border border-success/35 bg-toast px-3 py-[5px]" style={{ bottom: -16, left: 22, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", animation: "plUp 0.3s ease both" }}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/16 text-success"><Check size={11} strokeWidth={1.5} /></span>
          <span className="text-[11px] text-ink-2">Approved by <span className="font-semibold text-ink">you</span> · sent just now</span>
        </div>
      ) : (
        <div className="absolute flex items-center gap-1.5 rounded-full border border-white/10 bg-toast px-3 py-[5px]" style={{ bottom: -16, left: 22, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[11px] text-ink-2">Drafted in 1.2s · awaiting your approval</span>
        </div>
      )}
    </div>
  );
}

function SourceRow({ n, title, path, score, open, onClick, quote }: { n: number; title: string; path: string; score: string; open: boolean; onClick: () => void; quote: string }) {
  return (
    <div onClick={onClick} className="flex cursor-pointer flex-col gap-[7px]">
      <div className="flex items-center gap-[9px]">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-accent/15 font-mono text-[9.5px] font-semibold text-accent-soft">{n}</span>
        <span className="text-[11.5px] font-medium text-ink-2">{title}</span>
        <span className="font-mono text-[10px] text-muted">{path}</span>
        <span className="ml-auto font-mono text-[9.5px] text-faint">{score}</span>
      </div>
      {open ? (
        <div className="ml-[25px] rounded-[0_7px_7px_0] border-l-2 border-accent/50 bg-black/25 px-[11px] py-[7px] text-[11px] italic leading-[1.55] text-ink-3" style={{ animation: "plUp 0.25s ease both" }}>
          “{quote}”
        </div>
      ) : null}
    </div>
  );
}

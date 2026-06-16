"use client";

import { useState } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { EvidenceCard } from "./evidence-card";
import { useInboxStore } from "@/stores/inbox";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "@/stores/toasts";
import { api } from "@/lib/api-client";
import {
  useDraftAction,
  useEscalateTicket,
} from "@/hooks/use-ticket-actions";
import { confidenceColor, confidencePercent, isLowConfidence } from "@/lib/confidence";
import type { Ticket } from "@/lib/schemas";

function PanelHeader() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/7 px-4 py-[13px]">
      <Sparkles size={15} strokeWidth={1.4} className="text-accent" />
      <span className="text-[12.5px] font-semibold text-ink">AI Copilot</span>
      <span className="flex-1" />
      <span className="rounded-[5px] border border-white/8 px-[7px] py-0.5 font-mono text-[10px] text-muted">
        proofline-r1
      </span>
    </div>
  );
}

/** The error state — shown when a ticket has no grounded draft (TKT-1024). */
function ErrorState({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-danger/30 bg-danger/[0.06] px-3.5 py-[13px]">
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle size={14} strokeWidth={1.4} />
        <span className="text-[12.5px] font-semibold">AI draft unavailable</span>
      </div>
      <div className="text-[12px] leading-[1.55] text-ink-2">{ticket.aiFailureReason}</div>
      <div className="mt-0.5 flex gap-2">
        <button
          type="button"
          onClick={() =>
            api.retryKbDoc("kb-8").catch((err: Error) => toast(err.message))
          }
          className="rounded-md border border-danger/30 bg-danger/12 px-2.5 py-[5px] text-[11.5px] font-medium text-danger-soft hover:bg-danger/20"
        >
          Retry sync
        </button>
        <a
          href="/kb"
          className="rounded-md border border-white/10 px-2.5 py-[5px] text-[11.5px] text-ink-4 no-underline hover:text-ink"
        >
          Open Knowledge Base
        </a>
      </div>
    </div>
  );
}

export function CopilotPanel({ ticket, isDemo }: { ticket: Ticket; isDemo: boolean }) {
  const draftMode = useInboxStore((s) => s.draftModes[ticket.id] ?? "idle");
  const setDraftMode = useInboxStore((s) => s.setDraftMode);
  const setComposer = useInboxStore((s) => s.setComposer);
  const composer = useInboxStore((s) => s.composers[ticket.id] ?? "");
  const [editText, setEditText] = useState("");

  const draftAction = useDraftAction();
  const escalate = useEscalateTicket();
  const { data: ws } = useWorkspace();

  const draft = ticket.draft;
  // The workspace's confidence threshold (40–95) flags a draft as "held for
  // review" when its confidence falls below the bar. There is no auto-send, so
  // this is an advisory flag on a human-sent draft, not a hard block.
  const threshold = ws?.copilot?.threshold ?? 0;
  const heldForReview = draft != null && draft.confidence < threshold / 100;
  const regenerating = draftMode === "regen";
  const editing = draftMode === "edit";
  const accepted = draftMode === "accepted";

  const accept = () => {
    if (!draft) return;
    setComposer(ticket.id, draft.text);
    setDraftMode(ticket.id, "accepted");
    toast("Draft inserted into composer");
    if (isDemo) void api.completeDemoStep("draft").catch(() => {});
  };

  const toggleEdit = () => {
    if (!draft) return;
    if (editing) {
      setDraftMode(ticket.id, "idle");
      draftAction.mutate({ id: ticket.id, action: "edit", text: editText });
    } else {
      setEditText(draft.text);
      setDraftMode(ticket.id, "edit");
    }
  };

  const regen = () => {
    setDraftMode(ticket.id, "regen");
    draftAction.mutate(
      { id: ticket.id, action: "regenerate" },
      { onSettled: () => setDraftMode(ticket.id, "idle") },
    );
  };

  const tone = (t: "concise" | "empathetic") => {
    setDraftMode(ticket.id, "regen");
    draftAction.mutate(
      { id: ticket.id, action: "tone", tone: t },
      { onSettled: () => setDraftMode(ticket.id, "idle") },
    );
  };

  const runAction = (label: string) => {
    if (label === "Insert refund macro") {
      const macro =
        "I’ve processed a full refund to your original payment method — you’ll see it within 5–10 business days, along with an emailed credit note.";
      setComposer(ticket.id, composer ? `${composer}\n\n${macro}` : macro);
      toast("Refund macro inserted");
    } else if (label.startsWith("Escalate")) {
      escalate.mutate({ id: ticket.id });
    } else {
      toast(`“${label}” applied`);
    }
  };

  const buttonsDisabled = regenerating;

  return (
    <div
      className="flex min-h-0 w-[336px] shrink-0 flex-col border-l border-white/7"
      style={{ background: "linear-gradient(180deg, rgba(77,124,254,0.04), rgba(0,0,0,0) 140px), #0C0F17" }}
    >
      <PanelHeader />

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-5 pt-3.5">
        {!draft ? (
          <ErrorState ticket={ticket} />
        ) : (
          <>
            {/* confidence block */}
            <div className="flex flex-col gap-[7px]">
              <div className="flex items-baseline gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Confidence</span>
                <span className="flex-1" />
                <span className="font-mono text-[15px] font-semibold" style={{ color: confidenceColor(draft.confidence) }}>
                  {confidencePercent(draft.confidence)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: confidencePercent(draft.confidence),
                    background: `linear-gradient(90deg, ${confidenceColor(draft.confidence)}aa, ${confidenceColor(draft.confidence)})`,
                    boxShadow: `0 0 10px ${confidenceColor(draft.confidence)}66`,
                    transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
              <div className="text-[11px] text-muted">{draft.confMeta}</div>
            </div>

            {/* held-for-review: below the workspace confidence threshold */}
            {heldForReview ? (
              <div className="flex gap-[9px] rounded-[9px] border border-warning/40 bg-warning/[0.08] px-3 py-2.5">
                <AlertTriangle size={14} strokeWidth={1.4} className="mt-px shrink-0 text-warning" />
                <span className="text-[11.5px] leading-[1.5] text-warning-soft">
                  Held for review — {confidencePercent(draft.confidence)} is below your {threshold}% confidence
                  threshold. Read it over carefully before sending.
                </span>
              </div>
            ) : isLowConfidence(draft.confidence) ? (
              <div className="flex gap-[9px] rounded-[9px] border border-warning/30 bg-warning/[0.06] px-3 py-2.5">
                <AlertTriangle size={14} strokeWidth={1.4} className="mt-px shrink-0 text-warning" />
                <span className="text-[11.5px] leading-[1.5] text-warning-soft">
                  Low confidence — the AI found limited supporting evidence. Review carefully before sending.
                </span>
              </div>
            ) : null}

            {/* suggested reply card */}
            <div className="relative overflow-hidden rounded-[11px] border border-accent/25 bg-accent/[0.06]">
              <div className="flex items-center gap-[7px] border-b border-accent/15 px-[13px] py-[9px]">
                <span className="text-[11px] font-semibold text-accent-soft">Suggested reply</span>
                <span className="flex-1" />
                {accepted ? (
                  <span className="rounded-full bg-success/12 px-2 py-[1.5px] text-[10px] font-semibold text-success">
                    Inserted ✓
                  </span>
                ) : null}
              </div>
              {editing ? (
                <div className="p-[9px]">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[150px] w-full resize-y rounded-[8px] border border-accent/35 bg-black/25 px-[11px] py-[9px] text-[12.5px] leading-[1.6] text-ink"
                  />
                </div>
              ) : (
                <div className="whitespace-pre-wrap px-[13px] py-[11px] text-[12.5px] leading-[1.62] text-[#D6DCE8]">
                  {draft.text}
                </div>
              )}
              {regenerating ? (
                <div
                  className="absolute inset-0 flex items-center justify-center gap-2.5 backdrop-blur-[2px]"
                  style={{ background: "rgba(10,13,20,0.82)" }}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border-2 border-accent/25"
                    style={{ borderTopColor: "#4D7CFE", animation: "plSpin 0.7s linear infinite" }}
                  />
                  <span className="text-[12px] text-accent-soft" style={{ animation: "plPulse 1.2s ease infinite" }}>
                    Regenerating draft…
                  </span>
                </div>
              ) : null}
            </div>

            {/* actions */}
            <div
              className="flex flex-col gap-[7px]"
              style={buttonsDisabled ? { opacity: 0.45, pointerEvents: "none" } : undefined}
            >
              <div className="flex gap-[7px]">
                <button
                  type="button"
                  onClick={accept}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] border-0 bg-accent px-0 py-[7.5px] text-[12px] font-semibold text-white hover:bg-accent-hover"
                  style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
                >
                  <Check size={13} strokeWidth={1.4} />
                  <span>Accept draft</span>
                </button>
                <button
                  type="button"
                  onClick={toggleEdit}
                  className="rounded-[7px] border border-white/10 bg-white/5 px-3 py-[7.5px] text-[12px] font-medium text-ink-2 hover:bg-white/9"
                >
                  {editing ? "Done" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={regen}
                  title="Regenerate"
                  className="rounded-[7px] border border-white/10 bg-white/5 px-[11px] py-[7.5px] text-[13px] text-ink-2 hover:bg-white/9"
                >
                  ↻
                </button>
              </div>
              <div className="flex gap-[7px]">
                <button
                  type="button"
                  onClick={() => tone("concise")}
                  className="flex-1 rounded-full border border-white/9 bg-transparent py-[5px] text-[11.5px] text-ink-4 hover:border-accent/50 hover:text-accent-soft"
                >
                  Make more concise
                </button>
                <button
                  type="button"
                  onClick={() => tone("empathetic")}
                  className="flex-1 rounded-full border border-white/9 bg-transparent py-[5px] text-[11.5px] text-ink-4 hover:border-accent/50 hover:text-accent-soft"
                >
                  More empathetic
                </button>
              </div>
            </div>

            {/* evidence */}
            <div className="flex flex-col gap-[7px]">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Evidence · {draft.citations.length} sources
              </div>
              {draft.citations.map((c, i) => (
                <EvidenceCard key={c.title} citation={c} index={i} />
              ))}
            </div>

            {/* why this answer */}
            <ReasoningAccordion reasoning={draft.reasoning} />

            {/* suggested actions */}
            <div className="flex flex-col gap-[7px]">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Suggested actions</div>
              <div className="flex flex-wrap gap-1.5">
                {draft.actions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => runAction(label)}
                    className="rounded-full border border-white/9 bg-white/4 px-[11px] py-[4.5px] text-[11.5px] text-ink-3 hover:border-accent/55 hover:bg-accent/[0.08] hover:text-accent-soft"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReasoningAccordion({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[9px] border border-white/7">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-white/[0.025] px-3 py-[9px] text-left text-[12px] font-medium text-ink-2 hover:bg-white/5"
      >
        <span>Why this answer?</span>
        <span
          className="ml-auto text-[9px] text-muted transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-white/6 px-3 py-2.5 text-[11.5px] leading-[1.6] text-ink-4">{reasoning}</div>
      ) : null}
    </div>
  );
}

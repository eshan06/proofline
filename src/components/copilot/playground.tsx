"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "@/stores/toasts";
import { playgroundSamples } from "@/data/workspace";
import { confidenceColor, confidencePercent } from "@/lib/confidence";
import type { PlaygroundResult } from "@/lib/schemas";

type State = "idle" | "loading" | "done";

export function Playground({ threshold, sources }: { threshold: number; sources: number }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  const run = async () => {
    if (!question.trim()) {
      toast("Type a customer question first");
      return;
    }
    setState("loading");
    setResult(null);
    try {
      const res = await api.playground(question);
      setResult(res);
      setState("done");
    } catch {
      setState("idle");
      toast("Playground request failed — try again");
    }
  };

  const conf = result?.conf ?? null;
  const belowThreshold = conf != null && conf < threshold / 100;
  const refused = result != null && result.conf == null;

  return (
    <div
      className="sticky top-3.5 flex flex-col gap-3 rounded-[12px] border border-accent/25 p-4 px-[17px] py-4"
      style={{ background: "linear-gradient(170deg, rgba(77,124,254,0.07), rgba(77,124,254,0.012)), #0F141E" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.4} className="text-accent" />
        <span className="text-[13px] font-semibold text-ink">Test playground</span>
        <span className="ml-auto font-mono text-[9.5px] text-muted">proofline-r1</span>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type a fake customer question…"
        className="pl-focus min-h-[64px] w-full resize-none rounded-[9px] border border-white/9 bg-black/25 px-3 py-[9px] text-[12.5px] leading-[1.55] text-ink"
      />

      <div className="flex flex-wrap gap-1.5">
        {playgroundSamples.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuestion(q)}
            className="rounded-full border border-white/8 bg-white/4 px-2.5 py-[3px] text-left text-[10.5px] text-ink-4 hover:border-accent/50 hover:text-accent-soft"
          >
            {q}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={run}
        className="flex items-center justify-center gap-1.5 rounded-[8px] border-0 bg-accent py-2 text-[12.5px] font-semibold text-white hover:bg-accent-hover"
        style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
      >
        Generate draft
      </button>

      {state === "loading" ? (
        <div className="flex items-center gap-2.5 px-1 py-3.5">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-accent/25" style={{ borderTopColor: "#4D7CFE", animation: "plSpin 0.7s linear infinite" }} />
          <span className="text-[12px] text-accent-soft" style={{ animation: "plPulse 1.2s ease infinite" }}>Searching {sources} source{sources === 1 ? "" : "s"}…</span>
        </div>
      ) : null}

      {state === "done" && result ? (
        <div className="flex flex-col gap-[11px]" style={{ animation: "plFade 0.25s ease" }}>
          {refused ? (
            <div className="flex gap-[9px] rounded-[9px] border border-danger/30 bg-danger/[0.06] px-[13px] py-[11px]">
              <AlertTriangle size={14} strokeWidth={1.4} className="mt-px shrink-0 text-danger" />
              <span className="text-[11.5px] leading-[1.55] text-[#E8C2C2]">
                No grounded source found — “SSO configuration guide.pdf” failed to index, so the
                copilot refuses to guess. It would route this ticket to a human.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-[6px]">
              <div className="flex items-baseline">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Confidence</span>
                <span className="ml-auto font-mono text-[14px] font-semibold" style={{ color: confidenceColor(conf!) }}>
                  {confidencePercent(conf!)}
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-white/7">
                <div
                  className="h-full rounded-full"
                  style={{ width: confidencePercent(conf!), background: confidenceColor(conf!), boxShadow: `0 0 9px ${confidenceColor(conf!)}66`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }}
                />
              </div>
              {belowThreshold ? (
                <div className="mt-[3px] flex gap-2 rounded-[8px] border border-warning/30 bg-warning/[0.06] px-[11px] py-2">
                  <AlertTriangle size={14} strokeWidth={1.4} className="mt-px shrink-0 text-warning" />
                  <span className="text-[11px] leading-[1.5] text-warning-soft">
                    Below your {threshold}% threshold — this draft would be held for review.
                  </span>
                </div>
              ) : null}
              <div className="mt-[3px] rounded-[9px] border border-accent/25 bg-black/25 px-3 py-2.5 text-[12px] leading-[1.6] text-[#D6DCE8]">
                {result.text}
              </div>
              <div className="mt-0.5 flex flex-col gap-[5px]">
                {result.cites.map((c, i) => (
                  <div key={i} className="flex items-center gap-[7px] text-[11px] text-ink-4">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] bg-accent/15 font-mono text-[9px] text-accent-soft">{i + 1}</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

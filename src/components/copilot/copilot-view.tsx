"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Playground } from "./playground";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePatchCopilot } from "@/hooks/use-copilot";
import type { CopilotSettings } from "@/lib/schemas";

const TONES: CopilotSettings["tone"][] = ["Friendly", "Concise", "Formal", "Technical"];

const RISKS: { key: CopilotSettings["risk"]; label: string; desc: string }[] = [
  { key: "conservative", label: "Conservative", desc: "Only drafts with strong multi-source evidence. Everything else is flagged for a human." },
  { key: "balanced", label: "Balanced", desc: "Drafts whenever grounded sources exist; low confidence is flagged for review." },
  { key: "autonomous", label: "Autonomous", desc: "Auto-sends replies above your confidence threshold. Humans audit after the fact." },
];

const ALLOWED = ["Link help-center docs", "Issue refunds ≤ $250", "Apply account credits", "Tag & route tickets"];
const BLOCKED = ["Delete customer data", "Change subscription plans", "Promise legal outcomes", "Share internal runbooks"];

export function CopilotView() {
  const { data: ws } = useWorkspace();
  const patch = usePatchCopilot();
  const copilot = ws?.copilot;
  const [nsInput, setNsInput] = useState("");

  if (!copilot) return <div className="flex-1" />;

  const setTone = (tone: CopilotSettings["tone"]) =>
    patch.mutate({ patch: { tone }, toast: `Tone set to ${tone.toLowerCase()}` });

  const setRisk = (risk: CopilotSettings["risk"]) =>
    patch.mutate({
      patch: { risk },
      toast: risk === "autonomous" ? "Autonomous mode still requires approval for refunds & account changes" : undefined,
    });

  const setThreshold = (threshold: number) => patch.mutate({ patch: { threshold } });

  const toggleApproval = (key: keyof CopilotSettings["approvals"]) =>
    patch.mutate({ patch: { approvals: { ...copilot.approvals, [key]: !copilot.approvals[key] } } });

  const removeNever = (i: number) =>
    patch.mutate({ patch: { neverSay: copilot.neverSay.filter((_, j) => j !== i) } });

  const addNever = () => {
    const v = nsInput.trim();
    if (!v) return;
    patch.mutate({ patch: { neverSay: [...copilot.neverSay, v] } });
    setNsInput("");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1080px] px-8 pb-10 pt-[26px]">
        <div className="flex flex-col gap-[3px]">
          <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">AI Copilot</div>
          <div className="text-[12px] text-muted">How Proofline drafts, cites, and escalates on your behalf</div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_380px] items-start gap-3.5">
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* Tone */}
            <Card title="Tone">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => {
                  const sel = copilot.tone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className="rounded-full border px-3.5 py-[5px] text-[12px] font-medium hover:border-accent/55"
                      style={chipStyle(sel)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Risk mode */}
            <Card title="Risk mode">
              <div className="grid grid-cols-3 gap-[9px]">
                {RISKS.map((r) => {
                  const sel = copilot.risk === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRisk(r.key)}
                      className="relative flex cursor-pointer flex-col gap-1.5 rounded-[10px] border px-[13px] py-3 text-left hover:border-accent/55"
                      style={{ borderColor: sel ? "rgba(77,124,254,0.5)" : "rgba(255,255,255,0.07)", background: sel ? "rgba(77,124,254,0.07)" : "#0F141E" }}
                    >
                      {sel ? <span className="absolute right-[11px] top-[11px] h-[7px] w-[7px] rounded-full bg-accent" style={{ boxShadow: "0 0 7px rgba(77,124,254,0.8)" }} /> : null}
                      <span className="text-[12.5px] font-semibold text-ink">{r.label}</span>
                      <span className="text-[11px] leading-[1.5] text-ink-4">{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Confidence threshold */}
            <Card>
              <div className="flex items-baseline">
                <span className="text-[13px] font-semibold text-ink">Confidence threshold</span>
                <span className="ml-auto font-mono text-[15px] font-semibold text-accent">{copilot.threshold}%</span>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                step={5}
                value={copilot.threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-3 w-full cursor-pointer"
                style={{ accentColor: "#4D7CFE" }}
              />
              <div className="mt-2.5 text-[11.5px] text-muted">
                Drafts below {copilot.threshold}% confidence are flagged and held for human review.
              </div>
            </Card>

            {/* Require approval */}
            <Card title="Require human approval">
              {([
                ["Low-confidence drafts", "low"],
                ["Refunds & credits", "refund"],
                ["All outbound replies", "all"],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <span className="flex-1 text-[12.5px] text-ink-2">{label}</span>
                  <ToggleSwitch on={copilot.approvals[key]} onToggle={() => toggleApproval(key)} label={label} />
                </div>
              ))}
            </Card>

            {/* Never say */}
            <Card title="“Never say” policies">
              <div className="flex flex-wrap gap-1.5">
                {copilot.neverSay.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-[7px] rounded-full border border-danger/25 bg-danger/[0.06] py-[3.5px] pl-[11px] pr-[6px] text-[11.5px] text-danger-soft"
                  >
                    <span>{t}</span>
                    <span
                      role="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => removeNever(i)}
                      className="flex h-[15px] w-[15px] cursor-pointer items-center justify-center rounded-full bg-danger/12 text-[10px] leading-none hover:bg-danger/30"
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
              <input
                value={nsInput}
                onChange={(e) => setNsInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNever(); }}
                placeholder="Add a policy and press Enter…"
                className="pl-focus rounded-[7px] border border-white/9 bg-white/[0.035] px-[11px] py-[7px] text-[12px] text-ink"
              />
            </Card>

            {/* Allowed / Blocked */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-[9px] rounded-[11px] border border-white/7 bg-card px-[17px] py-[15px]">
                <div className="text-[12.5px] font-semibold text-success">Allowed actions</div>
                {ALLOWED.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-[12px] text-ink-3">
                    <Check size={13} strokeWidth={1.8} className="text-success" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-[9px] rounded-[11px] border border-white/7 bg-card px-[17px] py-[15px]">
                <div className="text-[12.5px] font-semibold text-danger">Blocked actions</div>
                {BLOCKED.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-[12px] text-ink-3">
                    <span className="w-[13px] text-center text-[12px] text-danger">×</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Playground threshold={copilot.threshold} />
        </div>
      </div>
    </div>
  );
}

function chipStyle(sel: boolean) {
  return {
    borderColor: sel ? "rgba(77,124,254,0.5)" : "rgba(255,255,255,0.08)",
    background: sel ? "rgba(77,124,254,0.14)" : "rgba(255,255,255,0.03)",
    color: sel ? "#9DB7FF" : "#8A93A6",
  };
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
      {title ? <div className="text-[13px] font-semibold text-ink">{title}</div> : null}
      {children}
    </div>
  );
}

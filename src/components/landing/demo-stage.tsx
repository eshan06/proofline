"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";

/**
 * The landing page's auto-playing 4-act product demo.
 *
 * Isolated so its timer never re-renders the rest of the page: progress-segment
 * fills are written directly to DOM refs every frame, and React state only
 * changes on act transitions (4 per loop). Durations: 2.6s / 2.2s / 3.8s / 2.6s.
 */
const DURATIONS = [2600, 2200, 3800, 2600];
const STEP_LABELS = ["Ticket arrives", "AI searches docs", "Draft + evidence", "Human approves"];
const STATE_LABELS = ["INGESTING", "RETRIEVING", "AWAITING APPROVAL", "RESOLVED"];
const STATE_FGS = ["#9DB7FF", "#9DB7FF", "#F5B74E", "#3DD68C"];

export function DemoStage() {
  const [step, setStep] = useState(0);
  const fillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const t0 = useRef(0);
  const stepRef = useRef(0);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    t0.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const s = stepRef.current;
      const dur = DURATIONS[s]!;
      const el = now - t0.current;
      if (el >= dur) {
        t0.current = now;
        setStep((prev) => (prev + 1) % 4);
      } else {
        const p = Math.min(1, el / dur);
        fillRefs.current.forEach((f, i) => {
          if (!f) return;
          f.style.width = i < s ? "100%" : i === s ? `${(p * 100).toFixed(1)}%` : "0%";
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goStep = (i: number) => {
    t0.current = performance.now();
    setStep(i);
  };

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-white/10 bg-panel font-sans text-ink"
      style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(77,124,254,0.06), 0 -1px 40px rgba(77,124,254,0.07) inset" }}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-[7px] border-b border-white/7 bg-white/[0.015] px-4 py-[11px]">
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <span className="flex-1" />
        <span className="font-mono text-[10.5px] text-faint">app.proofline.com · Inbox</span>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-[10.5px]" style={{ color: STATE_FGS[step] }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_FGS[step], animation: "dsGlow 1.6s ease infinite" }} />
          <span className="font-mono">{STATE_LABELS[step]}</span>
        </span>
      </div>

      <div className="grid grid-cols-[1fr_330px]" style={{ minHeight: 408 }}>
        {/* conversation side */}
        <div className="flex flex-col gap-[13px] border-r border-white/7 px-6 py-5">
          <div className="flex items-center gap-[9px]">
            <span className="text-[13.5px] font-semibold text-ink">Cannot access upgraded plan after payment</span>
            <span className="font-mono text-[10px] text-muted">TKT-1042</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-danger/30 px-[9px] py-0.5 text-[10.5px] text-danger">
              <span className="h-[5px] w-[5px] rounded-full bg-danger" />Urgent
            </span>
          </div>

          <div className="flex max-w-[470px] gap-[9px]">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: "hsl(210 45% 20%)", color: "hsl(210 75% 72%)" }}>AC</span>
            <div className="rounded-[4px_11px_11px_11px] border border-white/7 bg-bubble px-3 py-[9px] text-[12px] leading-[1.55] text-[#D6DCE8]">
              I upgraded to Growth 20 minutes ago and was charged, but the dashboard still says Free. We have onboarding tomorrow — can you fix this ASAP?
            </div>
          </div>

          {/* s1: auto-tags (always after ticket) */}
          <div className="ml-[35px] flex items-center gap-[7px]" style={{ animation: "dsTick 0.4s ease both" }}>
            <span className="font-mono text-[10px] text-muted">auto-tagged</span>
            <span className="rounded-full border border-accent/25 bg-accent/10 px-[9px] py-[1.5px] text-[10.5px] text-accent-soft" style={{ animation: "dsPop 0.35s 0.1s ease both" }}>billing</span>
            <span className="rounded-full border border-danger/25 bg-danger/[0.08] px-[9px] py-[1.5px] text-[10.5px] text-danger-soft" style={{ animation: "dsPop 0.35s 0.25s ease both" }}>urgent</span>
            <span className="font-mono text-[10px] text-muted" style={{ animation: "dsPop 0.35s 0.4s ease both" }}>→ routed to Billing</span>
          </div>

          {/* s2: searching */}
          {step === 1 ? (
            <div className="ml-[35px] flex items-center gap-[9px]" style={{ animation: "dsTick 0.4s ease both" }}>
              <Sparkles size={14} className="text-accent" />
              <span className="text-[11.5px] text-accent-soft">Searching 7 knowledge sources</span>
              <span className="flex gap-[3px]">
                {[0, 0.15, 0.3].map((d) => (
                  <span key={d} className="h-1 w-1 rounded-full bg-accent" style={{ animation: `dsDot 1s ${d}s ease infinite` }} />
                ))}
              </span>
            </div>
          ) : null}

          {/* s3: draft */}
          {step >= 2 ? (
            <div className="ml-[35px] max-w-[470px] overflow-hidden rounded-[11px] border border-accent/30 bg-accent/[0.06]" style={{ animation: "dsTick 0.45s ease both" }}>
              <div className="flex items-center gap-[7px] border-b border-accent/15 px-3 py-2">
                <Sparkles size={14} className="text-accent" />
                <span className="text-[11px] font-semibold text-accent-soft">AI draft — awaiting your approval</span>
                <span className="ml-auto font-mono text-[10px] text-success">0.92 conf</span>
              </div>
              <div className="px-3 py-2.5 text-[12px] leading-[1.6] text-[#D6DCE8]">
                Hi Ava — your payment went through; the upgrade just hasn&apos;t synced yet. I&apos;ve manually refreshed your subscription, so Growth features will appear after a reload.{" "}
                <span className="whitespace-nowrap rounded-[4px] bg-accent/18 px-1 text-[10.5px] text-accent-soft">Billing &amp; Plans ¹</span>{" "}
                <span className="whitespace-nowrap rounded-[4px] bg-accent/18 px-1 text-[10.5px] text-accent-soft">Sync runbook ²</span>
              </div>
            </div>
          ) : null}

          {/* s4: approved */}
          {step === 3 ? (
            <div className="ml-[35px] flex items-center gap-2" style={{ animation: "dsTick 0.4s ease both" }}>
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success/15 text-success"><Check size={12} strokeWidth={2.2} /></span>
              <span className="text-[11.5px] font-medium text-success">Approved by Eshan · sent in 38 seconds</span>
            </div>
          ) : null}
        </div>

        {/* evidence side */}
        <div className="flex flex-col gap-3 px-5 py-5" style={{ background: "linear-gradient(180deg, rgba(77,124,254,0.045), rgba(0,0,0,0) 130px)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-[12px] font-semibold text-ink">Evidence</span>
            <span className="ml-auto font-mono text-[9.5px] text-muted">proofline-r1</span>
          </div>
          {step >= 2 ? (
            <>
              <div className="flex flex-col gap-1.5" style={{ animation: "dsTick 0.4s ease both" }}>
                <div className="flex items-baseline">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Confidence</span>
                  <span className="ml-auto font-mono text-[14px] font-semibold text-success">92%</span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/7">
                  <div className="h-full rounded-full" style={{ width: "92%", background: "linear-gradient(90deg, #4D7CFE, #3DD68C)", boxShadow: "0 0 10px rgba(61,214,140,0.4)", animation: "dsBar 1s cubic-bezier(0.22, 1, 0.36, 1) both" }} />
                </div>
              </div>
              <EvidenceItem n={1} title="Billing & Plans" sim="0.93 sim" quote="Upgrades can take up to 30 minutes to propagate. Agents can force a refresh…" delay={0.15} highlight />
              <EvidenceItem n={2} title="Stripe sync runbook" sim="0.88 sim" quote="Manual resync is safe and idempotent…" delay={0.3} />
              <div className="mt-auto flex gap-[7px]" style={{ animation: "dsTick 0.4s 0.45s ease both" }}>
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] py-2 text-[11.5px] font-semibold text-white" style={{ background: step === 3 ? "#2BA56A" : "#4D7CFE", boxShadow: "0 2px 14px rgba(77,124,254,0.3)", transition: "background 0.3s" }}>
                  <Check size={12} strokeWidth={2.2} />{step === 3 ? "Approved ✓" : "Approve & send"}
                </span>
                <span className="flex items-center rounded-[7px] border border-white/10 bg-white/5 px-[13px] py-2 text-[11.5px] text-ink-2">Edit</span>
                <span className="flex items-center rounded-[7px] border border-white/10 bg-white/5 px-[11px] py-2 text-[12px] text-ink-2">↻</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* progress segments */}
      <div className="flex items-center gap-1.5 border-t border-white/6 px-4 py-3">
        {STEP_LABELS.map((label, i) => (
          <button key={label} type="button" onClick={() => goStep(i)} className="flex flex-1 cursor-pointer flex-col gap-1.5 border-0 bg-transparent px-0 py-0.5 text-left">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/8">
              <div ref={(el) => { fillRefs.current[i] = el; }} className="h-full rounded-full bg-accent" style={{ width: i < step ? "100%" : "0%" }} />
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: i === step ? "#9DB7FF" : "#444B5C" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EvidenceItem({ n, title, sim, quote, delay, highlight }: { n: number; title: string; sim: string; quote: string; delay: number; highlight?: boolean }) {
  return (
    <div
      className="rounded-[9px] border bg-white/[0.025] px-[11px] py-[9px]"
      style={{ borderColor: highlight ? "rgba(77,124,254,0.3)" : "rgba(255,255,255,0.08)", animation: `dsTick 0.4s ${delay}s ease both` }}
    >
      <div className="flex items-center gap-[7px]">
        <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[4px] bg-accent/15 font-mono text-[9px] text-accent-soft">{n}</span>
        <span className="text-[11.5px] font-semibold text-[#D6DCE8]">{title}</span>
        <span className="ml-auto font-mono text-[9px] text-muted">{sim}</span>
      </div>
      <div className="ml-[22px] mt-1.5 text-[10.5px] italic leading-[1.5] text-ink-4">“{quote}”</div>
    </div>
  );
}

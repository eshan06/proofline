"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "./scroll-reveal";

const STEPS = [
  { n: "1", title: "Connect channels", desc: "Drop in the chat widget, link Gmail and Slack. Five minutes, no code beyond a snippet." },
  { n: "2", title: "Upload your docs", desc: "Proofline indexes your help center, runbooks, and policies into citable chunks." },
  { n: "3", title: "Review AI drafts", desc: "Each reply arrives grounded with citations and a confidence score. You stay in control." },
  { n: "4", title: "Resolve faster", desc: "Approve in one click. Low-confidence drafts are flagged for a closer look — never auto-sent." },
];

export function HowItWorks() {
  return (
    <div className="border-y border-white/6" style={{ background: "#090C13" }}>
      <div className="mx-auto max-w-[1080px] px-7 py-[70px]">
        <Reveal className="mb-11 text-center">
          <span className="font-mono text-[11px] tracking-[0.12em] text-accent">HOW IT WORKS</span>
          <h2 className="mt-2.5 text-[30px] font-bold tracking-[-0.03em] text-ink">Four steps to a faster queue</h2>
        </Reveal>
        <div className="relative grid grid-cols-2 gap-y-8 md:grid-cols-4 md:gap-y-0">
          <div className="absolute left-[12.5%] right-[12.5%] top-[19px] hidden h-px md:block" style={{ background: "linear-gradient(90deg, rgba(77,124,254,0), rgba(77,124,254,0.4), rgba(77,124,254,0.4), rgba(77,124,254,0))" }} />
          <div className="absolute top-[16.5px] hidden h-1.5 w-1.5 rounded-full md:block" style={{ background: "#7DA2FF", boxShadow: "0 0 12px rgba(77,124,254,0.9)", animation: "plTravelX 9s ease-in-out infinite" }} />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80} className="relative flex flex-col items-center gap-3 px-4 text-center">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-accent/40 bg-panel font-mono text-[13px] font-semibold text-accent-soft-2" style={{ boxShadow: "0 0 20px rgba(77,124,254,0.15)" }}>{s.n}</div>
              <div className="text-[14px] font-semibold text-ink">{s.title}</div>
              <div className="text-[12px] leading-[1.55] text-ink-4">{s.desc}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

const PLANS = [
  { name: "Free", price: "$0", per: "forever", btn: "Start free", popular: false, feats: ["1 channel · 3 seats", "100 AI drafts / month", "25 indexed documents", "Community support"] },
  { name: "Growth", price: "$49", per: "per seat / month", btn: "Start 14-day trial", popular: true, feats: ["All channels · unlimited seats", "Unlimited AI drafts with citations", "Automations & smart routing", "SLA tracking + analytics", "Notion & Google Docs sync"] },
  { name: "Scale", price: "Custom", per: "annual", btn: "Talk to sales", popular: false, feats: ["SAML SSO & SCIM", "Audit logs & data residency", "Custom AI policies", "Dedicated support engineer"] },
];

export function Pricing() {
  return (
    <div id="pricing" className="mx-auto max-w-[1080px] px-7 py-20" style={{ scrollMarginTop: 70 }}>
      <Reveal className="mb-10 text-center">
        <span className="font-mono text-[11px] tracking-[0.12em] text-accent">PRICING</span>
        <h2 className="mt-2.5 text-[30px] font-bold tracking-[-0.03em] text-ink">Start free. Scale when the queue does.</h2>
      </Reveal>
      <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-3">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 100}>
            <div
              className="relative flex h-full flex-col gap-3.5 rounded-[14px] border p-6 transition-transform duration-200 hover:-translate-y-1"
              style={{
                borderColor: p.popular ? "rgba(77,124,254,0.45)" : "rgba(255,255,255,0.08)",
                background: p.popular ? "linear-gradient(170deg, rgba(77,124,254,0.08), rgba(77,124,254,0.015)), #0C0F17" : "#0C0F17",
                ...(p.popular ? { animation: "plCardGlow 6s ease infinite" } : {}),
              }}
            >
              {p.popular ? (
                <span className="absolute left-1/2 top-[-10px] -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-[3px] text-[10px] font-semibold tracking-[0.08em] text-white" style={{ background: "linear-gradient(90deg, #4D7CFE, #8B5CF6, #4D7CFE)", backgroundSize: "200% 100%", animation: "plSweep 5.5s linear infinite" }}>MOST POPULAR</span>
              ) : null}
              <div className="text-[14px] font-semibold text-ink">{p.name}</div>
              <div className="flex items-baseline gap-[5px]">
                <span className="font-mono text-[34px] font-bold tracking-[-0.03em] text-ink">{p.price}</span>
                <span className="text-[12px] text-muted">{p.per}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {p.feats.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[12.5px] leading-[1.45] text-ink-3">
                    <Check size={12} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href={p.name === "Scale" ? "/signin" : "/signin"}
                className="rounded-[8px] py-[9px] text-center text-[13px] font-semibold no-underline hover:opacity-88"
                style={{
                  color: p.popular ? "#fff" : "#C6CCDA",
                  background: p.popular ? "#4D7CFE" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${p.popular ? "transparent" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {p.btn}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

const FLOAT_CHIPS = [
  { left: "9%", bottom: 30, text: "Billing & Plans ¹", color: "#9DB7FF", bg: "rgba(77,124,254,0.07)", bd: "rgba(77,124,254,0.22)", dur: 11, delay: -1 },
  { left: "22%", bottom: 10, text: "0.92 conf", color: "#3DD68C", bg: "rgba(61,214,140,0.06)", bd: "rgba(61,214,140,0.2)", dur: 13, delay: -7 },
  { left: "71%", bottom: 24, text: "Refund policy ²", color: "#9DB7FF", bg: "rgba(77,124,254,0.07)", bd: "rgba(77,124,254,0.22)", dur: 12, delay: -4 },
  { left: "84%", bottom: 6, text: "SLA met ✓", color: "#3DD68C", bg: "rgba(61,214,140,0.06)", bd: "rgba(61,214,140,0.2)", dur: 14, delay: -10 },
  { left: "47%", bottom: 0, text: "approved by Maya", color: "#C4B0F8", bg: "rgba(139,92,246,0.07)", bd: "rgba(139,92,246,0.22)", dur: 12.5, delay: -8.5 },
];

export function CtaFooter() {
  return (
    <div className="relative overflow-hidden border-t border-white/6">
      <div className="pointer-events-none absolute bottom-[-200px] left-1/2 h-[400px] w-[700px] -translate-x-1/2" style={{ background: "radial-gradient(ellipse at center, rgba(77,124,254,0.16), rgba(77,124,254,0) 65%)", animation: "plGlow 5s ease infinite" }} />
      <div className="pointer-events-none absolute inset-0">
        {FLOAT_CHIPS.map((c, i) => (
          <span key={i} className="absolute whitespace-nowrap rounded-full border px-2.5 py-[3px] font-mono text-[10px]" style={{ left: c.left, bottom: c.bottom, color: c.color, background: c.bg, borderColor: c.bd, animation: `plFloatChip ${c.dur}s linear infinite`, animationDelay: `${c.delay}s` }}>{c.text}</span>
        ))}
      </div>
      <div className="relative mx-auto flex max-w-[680px] flex-col items-center gap-5 px-7 py-[90px] text-center">
        <Reveal>
          <h2 className="text-[38px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
            Stop guessing.<br />Start answering with{" "}
            <span style={{ background: "linear-gradient(100deg, #7DA2FF 20%, #4D7CFE 40%, #8B5CF6 60%, #7DA2FF 80%)", backgroundSize: "250% 100%", animation: "plSweep 7s linear infinite", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>proof.</span>
          </h2>
        </Reveal>
        <Reveal delay={120} className="flex gap-3">
          <Link href="/signin" className="rounded-[9px] bg-accent px-6 py-[11px] text-[14px] font-semibold text-white no-underline transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accent-hover" style={{ boxShadow: "0 4px 28px rgba(77,124,254,0.45)" }}>Start free</Link>
          <Link href="/demo" className="rounded-[9px] border border-white/10 bg-white/5 px-[22px] py-[11px] text-[14px] font-medium text-ink-2 no-underline transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/9">View demo</Link>
        </Reveal>
      </div>
      <div className="relative mx-auto flex max-w-[1080px] items-center gap-2.5 border-t border-white/5 px-7 py-[22px] text-[12px] text-faint">
        <div className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px]" style={{ background: "linear-gradient(135deg, #4D7CFE, #3B5FD9)" }}>
          <Check size={10} strokeWidth={2.4} color="#fff" />
        </div>
        <span>Proofline © 2026</span>
        <span className="ml-auto flex gap-[18px]">
          <Link href="/privacy" className="no-underline hover:text-ink-4">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-ink-4">Terms</Link>
          <Link href="/security" className="no-underline hover:text-ink-4">Security</Link>
          <Link href="/status" className="no-underline hover:text-ink-4">Status</Link>
        </span>
      </div>
    </div>
  );
}

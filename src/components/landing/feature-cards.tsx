"use client";

import { useInView } from "./use-in-view";

/**
 * Six feature cards, each with a 124px micro-demo viewport. The demos animate
 * in ONCE when the card first enters view (keyed on `play` so the one-shot CSS
 * keyframes start fresh), then hold still — never infinite.
 */
export function FeatureCards() {
  const features: { title: string; desc: string; demo: (play: boolean) => React.ReactNode }[] = [
    { title: "Unified inbox", desc: "Website chat, email, and Slack flow into one queue with shared assignment, priorities, and SLAs.", demo: UnifiedInboxDemo },
    { title: "Replies with citations", desc: "Every AI draft links the exact doc passages it used — agents verify in seconds, not minutes.", demo: CitationsDemo },
    { title: "Smart routing & auto-tags", desc: "Tickets are classified, tagged, and routed to the right team the moment they arrive.", demo: RoutingDemo },
    { title: "Knowledge base sync", desc: "Connect Notion, Google Docs, or upload files. Proofline keeps its sources fresh automatically.", demo: KbSyncDemo },
    { title: "SLA tracking", desc: "Live countdowns on every conversation, with escalation rules before a breach ever happens.", demo: SlaDemo },
    { title: "Analytics", desc: "Acceptance rates, confidence distributions, and most-cited docs — see exactly where AI helps.", demo: AnalyticsDemo },
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <FeatureCard key={f.title} title={f.title} desc={f.desc} demo={f.demo} />
      ))}
    </div>
  );
}

function FeatureCard({ title, desc, demo }: { title: string; desc: string; demo: (play: boolean) => React.ReactNode }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="flex flex-col overflow-hidden rounded-[13px] border border-white/7 bg-panel transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-accent/40"
      style={{ transitionTimingFunction: "ease" }}
    >
      <div className="relative h-[124px] overflow-hidden border-b border-white/6 px-3.5 py-[13px]" style={{ background: "linear-gradient(180deg, rgba(77,124,254,0.05), rgba(0,0,0,0.22))" }}>
        {/* key on inView so the one-shot animations start exactly once, on reveal */}
        <div key={inView ? "play" : "idle"}>{demo(inView)}</div>
      </div>
      <div className="flex flex-col gap-[9px] px-5 pb-5 pt-4">
        <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{title}</div>
        <div className="text-[12.5px] leading-[1.6] text-ink-4">{desc}</div>
      </div>
    </div>
  );
}

const anim = (play: boolean, css: string): React.CSSProperties => (play ? { animation: css } : { opacity: 0 });

/* 1 — three channel rows slide in staggered */
function UnifiedInboxDemo(play: boolean) {
  const rows = [
    { dot: "#4D7CFE", w: 46, label: "web", delay: 0.05 },
    { dot: "#F5B74E", w: 58, label: "email", delay: 0.18 },
    { dot: "#8B5CF6", w: 40, label: "slack", delay: 0.31 },
  ];
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} className="mb-1.5 flex items-center gap-[7px] rounded-[7px] border border-white/6 bg-white/[0.035] px-[9px] py-1.5" style={anim(play, `plRowLoop 0.5s ${r.delay}s ease both`)}>
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.dot }} />
          <span className="h-[5px] rounded-full bg-white/16" style={{ width: r.w }} />
          <span className="h-[5px] flex-1 rounded-full bg-white/7" />
          <span className="font-mono text-[8.5px] text-muted">{r.label}</span>
        </div>
      ))}
      <span className="absolute bottom-[9px] right-3 font-mono text-[9px] text-faint">3 channels → 1 queue</span>
    </>
  );
}

/* 2 — skeleton draft + two citation chips pop in */
function CitationsDemo(play: boolean) {
  const shimmer = "linear-gradient(90deg, rgba(255,255,255,0.07) 25%, rgba(157,183,255,0.28) 50%, rgba(255,255,255,0.07) 75%)";
  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-[8px] border border-accent/22 bg-bubble px-[11px] py-[9px]">
        {[100, 82, 58].map((w) => (
          <span key={w} className="h-[5px] rounded-full" style={{ width: `${w}%`, background: shimmer, backgroundSize: "200% 100%", backgroundPosition: "60% 0" }} />
        ))}
      </div>
      <div className="mt-[9px] flex items-center gap-1.5">
        <span className="rounded-[5px] border border-accent/30 bg-accent/14 px-[7px] py-0.5 font-mono text-[9.5px] text-accent-soft" style={anim(play, "plPopLoop 0.45s 0.35s ease both")}>Billing &amp; Plans ¹</span>
        <span className="rounded-[5px] border border-accent/30 bg-accent/14 px-[7px] py-0.5 font-mono text-[9.5px] text-accent-soft" style={anim(play, "plPopLoop 0.45s 0.48s ease both")}>Runbook ²</span>
        <span className="ml-auto font-mono text-[9.5px] text-success">0.92 conf</span>
      </div>
    </>
  );
}

/* 3 — avatar row, auto-tag chips pop, routed chip */
function RoutingDemo(play: boolean) {
  return (
    <>
      <div className="flex items-center gap-[7px] rounded-[7px] border border-white/6 bg-white/[0.035] px-[9px] py-1.5">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-semibold" style={{ background: "hsl(210 45% 20%)", color: "hsl(210 75% 72%)" }}>AC</span>
        <span className="h-[5px] w-[72px] rounded-full bg-white/16" />
        <span className="h-[5px] flex-1 rounded-full bg-white/7" />
      </div>
      <div className="ml-2 mt-[11px] flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-muted">auto-tag</span>
        <span className="rounded-full border border-accent/30 bg-accent/12 px-2 py-[1.5px] text-[9.5px] text-accent-soft" style={anim(play, "plPopLoop 0.45s 0.2s ease both")}>billing</span>
        <span className="rounded-full border border-danger/30 bg-danger/[0.08] px-2 py-[1.5px] text-[9.5px] text-danger-soft" style={anim(play, "plPopLoop 0.45s 0.33s ease both")}>urgent</span>
      </div>
      <div className="ml-2 mt-[9px] flex items-center gap-1.5" style={anim(play, "plPopLoop 0.45s 0.5s ease both")}>
        <span className="font-mono text-[9px] text-muted">→ routed to</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/30 bg-violet/10 py-[1.5px] pl-[3px] pr-2 text-[9.5px] text-violet-soft">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-violet/25 text-[6.5px] font-semibold">M</span>
          <span>Billing team</span>
        </span>
        <span className="font-mono text-[9px] text-success">in 0.4s</span>
      </div>
    </>
  );
}

/* 4 — chunking (amber) + indexed (green) rows + "+26 chunks citable" */
function KbSyncDemo(play: boolean) {
  return (
    <>
      <div className="mb-[7px] flex items-center gap-2 rounded-[7px] border border-white/6 bg-white/[0.035] px-[9px] py-[7px]">
        <span className="font-mono text-[9px] text-ink-4">refund-policy.pdf</span>
        <span className="flex-1" />
        <span className="h-[11px] w-[11px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(245,183,78,0.25)", background: "#F5B74E" }} />
        <span className="font-mono text-[8.5px] text-warning">chunking…</span>
      </div>
      <div className="flex items-center gap-2 rounded-[7px] border border-white/6 bg-white/[0.035] px-[9px] py-[7px]">
        <span className="font-mono text-[9px] text-ink-4">billing-and-plans.md</span>
        <span className="flex-1" />
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="font-mono text-[8.5px] text-success">indexed · 48</span>
      </div>
      <div className="ml-0.5 mt-[9px] flex items-center gap-1.5" style={anim(play, "plPopLoop 0.45s 0.5s ease both")}>
        <span className="rounded-[5px] border border-success/25 bg-success/[0.08] px-[7px] py-0.5 font-mono text-[9.5px] text-success">+26 chunks citable</span>
        <span className="font-mono text-[9px] text-faint">synced from Notion</span>
      </div>
    </>
  );
}

/* 5 — SLA bar drains green→amber once, then escalation chip fades in */
function SlaDemo(play: boolean) {
  return (
    <>
      <div className="flex items-baseline">
        <span className="text-[10.5px] text-ink-4">First response — TKT-1042</span>
        <span className="ml-auto font-mono text-[10.5px] text-ink-2">due 14m</span>
      </div>
      <div className="mt-[9px] h-[7px] overflow-hidden rounded-full bg-white/7">
        <div className="h-full rounded-full" style={play ? { animation: "plSlaDrain 1.7s 0.2s ease-out both" } : { width: "30%", background: "#F5B74E" }} />
      </div>
      <div className="mt-[11px] flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/[0.07] px-[9px] py-[2.5px] text-[9.5px] text-warning" style={anim(play, "plWarnPop 0.5s 1.7s ease both")}>
          <span className="h-[5px] w-[5px] rounded-full bg-warning" />
          <span>escalation armed → notify #support-oncall</span>
        </span>
      </div>
    </>
  );
}

/* 6 — 8 bars grow up staggered, last one green, "↑ 87%" badge */
function AnalyticsDemo(play: boolean) {
  const heights = [38, 52, 44, 60, 50, 66, 58, 72];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center">
        <span className="font-mono text-[9px] text-faint">draft acceptance · 7d</span>
        <span className="ml-auto rounded-[5px] border border-success/25 bg-success/[0.08] px-[7px] py-[1.5px] font-mono text-[9.5px] text-success">↑ 87%</span>
      </div>
      <div className="mt-2 flex flex-1 items-end gap-1.5">
        {heights.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-[3px]"
            style={{
              height: h,
              transformOrigin: "bottom",
              background: i === heights.length - 1 ? "linear-gradient(180deg, #3DD68C, rgba(61,214,140,0.3))" : "linear-gradient(180deg, #5E89FF, rgba(77,124,254,0.35))",
              ...(play ? { animation: `plWave 0.55s ${0.12 + i * 0.06}s ease-out both` } : {}),
            }}
          />
        ))}
      </div>
    </div>
  );
}

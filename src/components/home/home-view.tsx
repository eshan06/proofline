"use client";

import { useRouter } from "next/navigation";
import { BarChart3, LayoutGrid, Plus, Sparkles, Zap, AlertTriangle } from "lucide-react";
import { ChannelIcon } from "@/components/shared/channel-icon";
import {
  homeActivity,
  homeAttention,
  homeChannels,
  homeMetrics,
  homeVolume,
} from "@/data/home";

const today = "Saturday, June 13";

export function HomeView() {
  const router = useRouter();

  const quickActions = [
    { label: "Upload docs", icon: Plus, run: () => router.push("/kb?upload=1") },
    { label: "Connect channel", icon: LayoutGrid, run: () => router.push("/integrations") },
    { label: "New automation", icon: Zap, run: () => router.push("/automations") },
    {
      label: "Review low-confidence",
      icon: AlertTriangle,
      run: () => router.push("/inbox/TKT-1038?filter=Low+Confidence"),
    },
  ];

  const volMax = Math.max(...homeVolume.map(([a, h]) => a + h));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1060px] px-8 pb-10 pt-[26px]">
        {/* greeting + quick actions */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Good morning, Eshan</div>
            <div className="text-[12px] text-muted">{today} · 6 conversations need your attention</div>
          </div>
          <span className="flex-1" />
          <div className="flex flex-wrap gap-2">
            {quickActions.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={q.run}
                  className="flex items-center gap-1.5 rounded-[7px] border border-white/9 bg-white/4 px-[11px] py-1.5 text-[11.5px] font-medium text-ink-2 hover:border-accent/50 hover:text-ink"
                >
                  <Icon size={12} strokeWidth={1.4} className="text-accent" />
                  <span>{q.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* metric cards */}
        <div className="mt-5 grid grid-cols-5 gap-3">
          {homeMetrics.map((m) => (
            <div
              key={m.label}
              className="flex flex-col gap-2 rounded-[11px] border border-white/7 bg-card p-3.5 px-3.5 py-[13px] hover:border-white/14"
            >
              <div className="text-[11px] font-medium text-muted">{m.label}</div>
              <div className="flex items-baseline gap-[7px]">
                <span className="font-mono text-[21px] font-semibold tracking-[-0.02em]" style={{ color: m.valueColor }}>
                  {m.value}
                </span>
                <span className="text-[10.5px] font-medium" style={{ color: m.deltaColor }}>
                  {m.delta}
                </span>
              </div>
              <div className="flex h-[18px] items-end gap-[2.5px]">
                {m.bars.map((b, i) => (
                  <div key={i} className="w-1 rounded-[2px]" style={{ height: 4 + Math.round(b.ratio * 14), background: b.color }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* main grid */}
        <div className="mt-3.5 grid grid-cols-[1fr_340px] items-start gap-3.5">
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* volume chart */}
            <div className="rounded-[11px] border border-white/7 bg-card p-4 px-[18px] py-4">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[13px] font-semibold text-ink">Ticket volume</span>
                <span className="text-[11px] text-muted">last 14 days</span>
                <span className="ml-auto flex items-center gap-3 text-[10.5px] text-muted">
                  <span className="flex items-center gap-[5px]">
                    <span className="h-2 w-2 rounded-[2.5px] bg-accent" />
                    Resolved by AI draft
                  </span>
                  <span className="flex items-center gap-[5px]">
                    <span className="h-2 w-2 rounded-[2.5px] bg-white/18" />
                    Human only
                  </span>
                </span>
              </div>
              <div className="mt-4 flex h-[130px] items-end gap-[7px]">
                {homeVolume.map(([ai, human], i) => (
                  <div
                    key={i}
                    title={`${ai + human} tickets · ${ai} resolved via AI draft`}
                    className="flex h-full flex-1 cursor-default flex-col justify-end gap-0.5"
                  >
                    <div className="rounded-[3px_3px_2px_2px] bg-white/14" style={{ height: Math.round((human / volMax) * 130) }} />
                    <div
                      className="rounded-[2px_2px_3px_3px]"
                      style={{ height: Math.round((ai / volMax) * 130), background: "linear-gradient(180deg, #5E89FF, #4D7CFE)", boxShadow: "0 0 8px rgba(77,124,254,0.25)" }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9.5px] text-faint">
                <span>May 30</span><span>Jun 2</span><span>Jun 5</span><span>Jun 8</span><span>Jun 12</span>
              </div>
            </div>

            {/* needs attention */}
            <div className="overflow-hidden rounded-[11px] border border-white/7 bg-card">
              <div className="flex items-center border-b border-white/6 px-[18px] py-[13px]">
                <span className="text-[13px] font-semibold text-ink">Needs attention</span>
                <button
                  type="button"
                  onClick={() => router.push("/inbox")}
                  className="ml-auto border-0 bg-transparent text-[11.5px] text-accent"
                >
                  Open inbox →
                </button>
              </div>
              {homeAttention.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => router.push(`/inbox/${a.id}`)}
                  className="flex w-full cursor-pointer items-center gap-[11px] border-0 border-b border-white/[0.045] bg-transparent px-[18px] py-[11px] text-left hover:bg-white/3"
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: a.dot, boxShadow: `0 0 7px ${a.dot}` }} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[12.5px] font-medium text-[#D6DCE8]">{a.subject}</span>
                    <span className="text-[11px] text-muted">{a.who}</span>
                  </div>
                  <span className="shrink-0 rounded-full px-[9px] py-0.5 text-[10.5px] font-medium" style={{ color: a.chipFg, background: a.chipBg }}>
                    {a.chip}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">{a.time}</span>
                </button>
              ))}
            </div>
          </div>

          {/* right column */}
          <div className="flex flex-col gap-3.5">
            {/* AI performance */}
            <div
              className="flex flex-col gap-3 rounded-[11px] border border-accent/22 p-4 px-4 py-[15px]"
              style={{ background: "linear-gradient(160deg, rgba(77,124,254,0.1), rgba(77,124,254,0.02)), #0F141E" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-accent" />
                <span className="text-[12.5px] font-semibold text-ink">AI performance</span>
                <span className="ml-auto font-mono text-[10px] text-muted">7 days</span>
              </div>
              <div className="flex flex-col gap-[5px]">
                <div className="flex items-baseline">
                  <span className="text-[11.5px] text-ink-4">Draft acceptance</span>
                  <span className="ml-auto font-mono text-[13px] font-semibold text-success">87%</span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full" style={{ width: "87%", background: "linear-gradient(90deg, #4D7CFE, #3DD68C)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[9px]">
                <div className="rounded-[8px] bg-black/22 px-[11px] py-[9px]">
                  <div className="font-mono text-[15px] font-semibold text-ink">214</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">drafts generated</div>
                </div>
                <div className="rounded-[8px] bg-black/22 px-[11px] py-[9px]">
                  <div className="font-mono text-[15px] font-semibold text-ink">0.84</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">avg confidence</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/inbox/TKT-1038?filter=Low+Confidence")}
                className="rounded-[7px] border border-accent/30 bg-accent/12 py-[7px] text-[11.5px] font-medium text-accent-soft hover:bg-accent/20"
              >
                Review 2 low-confidence drafts
              </button>
            </div>

            {/* channel health */}
            <div className="flex flex-col gap-2.5 rounded-[11px] border border-white/7 bg-card p-4 px-4 py-3.5">
              <div className="text-[12.5px] font-semibold text-ink">Channel health</div>
              {homeChannels.map((ch) => (
                <div key={ch.label} className="flex items-center gap-[9px]">
                  <span className="flex w-[15px] justify-center text-ink-4">
                    <ChannelIcon channel={ch.channel} />
                  </span>
                  <span className="text-[12px] text-ink-2">{ch.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">{ch.meta}</span>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: ch.dot, boxShadow: `0 0 6px ${ch.dot}` }} />
                </div>
              ))}
            </div>

            {/* activity */}
            <div className="flex flex-col gap-[11px] rounded-[11px] border border-white/7 bg-card p-4 px-4 py-3.5">
              <div className="text-[12.5px] font-semibold text-ink">Activity</div>
              {homeActivity.map((a, i) => (
                <div key={i} className="flex gap-[9px]">
                  <div
                    className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold"
                    style={{ background: a.bg, color: a.fg }}
                  >
                    {a.init}
                  </div>
                  <div className="flex flex-col gap-px">
                    <span className="text-[11.5px] leading-[1.45] text-ink-3">{a.text}</span>
                    <span className="font-mono text-[9.5px] text-faint">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

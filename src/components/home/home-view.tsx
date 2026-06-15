"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Plus, Sparkles, Zap, AlertTriangle } from "lucide-react";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  dashboardMetrics,
  attentionTickets,
  channelMix,
  channelHealth,
  recentActivity,
  pct,
  conf2,
  type AttentionEntry,
  type ActivityEntry,
} from "@/lib/metrics";

const ATTENTION_CHIP: Record<AttentionEntry["reason"], { fg: string; bg: string; dot: string }> = {
  sla: { fg: "#F36C6C", bg: "rgba(243,108,108,0.1)", dot: "#F36C6C" },
  "low-confidence": { fg: "#F5B74E", bg: "rgba(245,183,78,0.1)", dot: "#F5B74E" },
  "no-draft": { fg: "#8A93A6", bg: "rgba(255,255,255,0.06)", dot: "#8A93A6" },
};
const ACTIVITY_TONE: Record<ActivityEntry["type"], { bg: string; fg: string }> = {
  AI: { bg: "rgba(77,124,254,0.15)", fg: "#9DB7FF" },
  Team: { bg: "rgba(139,92,246,0.15)", fg: "#C4B0F8" },
  Integrations: { bg: "rgba(245,183,78,0.15)", fg: "#F5B74E" },
  Security: { bg: "rgba(243,108,108,0.15)", fg: "#F36C6C" },
};

function attentionChip(a: AttentionEntry): string {
  if (a.reason === "sla") return `SLA ${a.slaMins}m`;
  if (a.reason === "low-confidence") return `AI ${Math.round((a.conf ?? 0) * 100)}%`;
  return "No AI draft";
}

export function HomeView() {
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";
  const { data: ws } = useWorkspace();
  const firstName = ws?.currentUser?.name.split(/\s+/)[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const tickets = ws?.tickets ?? [];
  const attnAll = attentionTickets(tickets, tickets.length);
  const attention = attnAll.length;

  const quickActions = [
    { label: "Upload docs", icon: Plus, run: () => router.push("/kb?upload=1") },
    { label: "Connect channel", icon: LayoutGrid, run: () => router.push("/integrations") },
    { label: "New automation", icon: Zap, run: () => router.push("/automations") },
    {
      label: "Open inbox",
      icon: AlertTriangle,
      run: () => router.push("/inbox"),
    },
  ];

  // New / empty workspace → onboarding, not someone else's fixture metrics.
  if (ws && tickets.length === 0) {
    const steps = [
      { n: 1, title: "Connect a channel", body: "Add the website chat widget, or wire up email — messages land here as tickets.", cta: "Integrations", run: () => router.push("/integrations") },
      { n: 2, title: "Upload your docs", body: "Give the AI sources to cite. It drafts replies grounded only in what you upload.", cta: "Knowledge base", run: () => router.push("/kb?upload=1") },
      { n: 3, title: "Reply with the copilot", body: "Open a ticket, generate a grounded draft, and send — with a confidence score every time.", cta: "Open inbox", run: () => router.push("/inbox") },
    ];
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
        <div className="mx-auto max-w-[760px] px-8 pb-10 pt-[56px]">
          {verified ? (
            <div className="mb-6 rounded-[10px] border border-success/30 bg-success/[0.06] px-4 py-3 text-[12.5px] text-success">
              Email verified — your account is fully set up.
            </div>
          ) : null}
          <div className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Welcome to Proofline, {firstName}</div>
          <p className="mt-2 text-[13px] text-muted">Your workspace is ready. Three steps to your first grounded AI reply:</p>
          <div className="mt-6 flex flex-col gap-3">
            {steps.map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={s.run}
                className="flex items-center gap-3.5 rounded-[12px] border border-white/8 bg-card px-[18px] py-4 text-left hover:border-accent/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[12px] font-semibold text-accent-soft">{s.n}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold text-ink">{s.title}</span>
                  <span className="text-[11.5px] text-muted">{s.body}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-medium text-accent">{s.cta} →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const m = dashboardMetrics(tickets);
  const mix = channelMix(tickets);
  const mixMax = Math.max(1, ...mix.map((c) => c.total));
  const channels = ws ? channelHealth(ws) : [];
  const activity = recentActivity(ws?.audit ?? []);
  const attn = attnAll.slice(0, 4);
  const lowConf = tickets.filter((t) => !t.archived && t.conf != null && t.conf < 0.7).length;

  const cards = [
    { label: "Open tickets", value: String(m.open), valueColor: "#E6EAF2", sub: m.urgent ? `${m.urgent} urgent` : "live", subColor: m.urgent ? "#F5B74E" : "#8A93A6" },
    { label: "SLA at risk", value: String(m.slaRisk), valueColor: m.slaRisk ? "#F36C6C" : "#E6EAF2", sub: "due ≤45m", subColor: "#8A93A6" },
    { label: "Resolved", value: String(m.resolved), valueColor: "#E6EAF2", sub: `${m.total} handled`, subColor: "#8A93A6" },
    { label: "AI acceptance", value: pct(m.acceptance), valueColor: "#3DD68C", sub: `${m.aiSent}/${m.drafted} sent`, subColor: "#8A93A6" },
    { label: "Avg confidence", value: conf2(m.avgConfidence), valueColor: "#E6EAF2", sub: `${m.drafted} drafts`, subColor: "#8A93A6" },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1060px] px-8 pb-10 pt-[26px]">
        {/* greeting + quick actions */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Good morning, {firstName}</div>
            <div className="text-[12px] text-muted">{today} · {attention} conversation{attention === 1 ? "" : "s"} need your attention</div>
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
          {cards.map((c) => (
            <div
              key={c.label}
              className="flex flex-col gap-2 rounded-[11px] border border-white/7 bg-card p-3.5 px-3.5 py-[13px] hover:border-white/14"
            >
              <div className="text-[11px] font-medium text-muted">{c.label}</div>
              <div className="flex items-baseline gap-[7px]">
                <span className="font-mono text-[21px] font-semibold tracking-[-0.02em]" style={{ color: c.valueColor }}>
                  {c.value}
                </span>
                <span className="text-[10.5px] font-medium" style={{ color: c.subColor }}>
                  {c.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* main grid */}
        <div className="mt-3.5 grid grid-cols-[1fr_340px] items-start gap-3.5">
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* volume by channel */}
            <div className="rounded-[11px] border border-white/7 bg-card p-4 px-[18px] py-4">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[13px] font-semibold text-ink">Ticket volume</span>
                <span className="text-[11px] text-muted">by channel</span>
                <span className="ml-auto flex items-center gap-3 text-[10.5px] text-muted">
                  <span className="flex items-center gap-[5px]">
                    <span className="h-2 w-2 rounded-[2.5px] bg-accent" />
                    AI-drafted
                  </span>
                  <span className="flex items-center gap-[5px]">
                    <span className="h-2 w-2 rounded-[2.5px] bg-white/18" />
                    Human only
                  </span>
                </span>
              </div>
              <div className="mt-4 flex h-[130px] items-end gap-5">
                {mix.map((c) => (
                  <div
                    key={c.channel}
                    title={`${c.total} ${c.label} ticket${c.total === 1 ? "" : "s"} · ${c.ai} AI-drafted`}
                    className="flex h-full flex-1 cursor-default flex-col justify-end gap-0.5"
                  >
                    <div className="rounded-[3px_3px_2px_2px] bg-white/14" style={{ height: Math.round((c.human / mixMax) * 120) }} />
                    <div
                      className="rounded-[2px_2px_3px_3px]"
                      style={{ height: Math.round((c.ai / mixMax) * 120), background: "linear-gradient(180deg, #5E89FF, #4D7CFE)", boxShadow: "0 0 8px rgba(77,124,254,0.25)" }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9.5px] text-faint">
                {mix.map((c) => (
                  <span key={c.channel} className="flex-1 text-center">{c.label}</span>
                ))}
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
              {attn.length === 0 ? (
                <div className="px-[18px] py-6 text-center text-[12px] text-muted">All caught up — nothing needs attention right now.</div>
              ) : (
                attn.map((a) => {
                  const chip = ATTENTION_CHIP[a.reason];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => router.push(`/inbox/${a.id}`)}
                      className="flex w-full cursor-pointer items-center gap-[11px] border-0 border-b border-white/[0.045] bg-transparent px-[18px] py-[11px] text-left hover:bg-white/3"
                    >
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: chip.dot, boxShadow: `0 0 7px ${chip.dot}` }} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] font-medium text-[#D6DCE8]">{a.subject}</span>
                        <span className="text-[11px] text-muted">{a.who}</span>
                      </div>
                      <span className="shrink-0 rounded-full px-[9px] py-0.5 text-[10.5px] font-medium" style={{ color: chip.fg, background: chip.bg }}>
                        {attentionChip(a)}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted">{a.time}</span>
                    </button>
                  );
                })
              )}
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
                <Sparkles size={15} strokeWidth={1.4} className="text-accent" />
                <span className="text-[12.5px] font-semibold text-ink">AI performance</span>
                <span className="ml-auto font-mono text-[10px] text-muted">all time</span>
              </div>
              <div className="flex flex-col gap-[5px]">
                <div className="flex items-baseline">
                  <span className="text-[11.5px] text-ink-4">Draft acceptance</span>
                  <span className="ml-auto font-mono text-[13px] font-semibold text-success">{pct(m.acceptance)}</span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full" style={{ width: pct(m.acceptance) === "—" ? "0%" : pct(m.acceptance), background: "linear-gradient(90deg, #4D7CFE, #3DD68C)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[9px]">
                <div className="rounded-[8px] bg-black/22 px-[11px] py-[9px]">
                  <div className="font-mono text-[15px] font-semibold text-ink">{m.drafted}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">drafts generated</div>
                </div>
                <div className="rounded-[8px] bg-black/22 px-[11px] py-[9px]">
                  <div className="font-mono text-[15px] font-semibold text-ink">{conf2(m.avgConfidence)}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">avg confidence</div>
                </div>
              </div>
              {lowConf > 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/inbox?filter=Low+Confidence")}
                  className="rounded-[7px] border border-accent/30 bg-accent/12 py-[7px] text-[11.5px] font-medium text-accent-soft hover:bg-accent/20"
                >
                  Review {lowConf} low-confidence draft{lowConf === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>

            {/* channel health */}
            <div className="flex flex-col gap-2.5 rounded-[11px] border border-white/7 bg-card p-4 px-4 py-3.5">
              <div className="text-[12.5px] font-semibold text-ink">Channel health</div>
              {channels.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-[9px]">
                  <span className="flex w-[15px] justify-center text-ink-4">
                    <ChannelIcon channel={ch.channel} />
                  </span>
                  <span className="text-[12px] text-ink-2">{ch.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">
                    {ch.live} live · {ch.connected ? "connected" : "not connected"}
                  </span>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: ch.connected ? "#3DD68C" : "#8A93A6", boxShadow: ch.connected ? "0 0 6px #3DD68C" : "none" }} />
                </div>
              ))}
            </div>

            {/* activity */}
            <div className="flex flex-col gap-[11px] rounded-[11px] border border-white/7 bg-card p-4 px-4 py-3.5">
              <div className="text-[12.5px] font-semibold text-ink">Activity</div>
              {activity.length === 0 ? (
                <div className="text-[11.5px] text-muted">No activity yet — actions you and the AI take will show up here.</div>
              ) : (
                activity.map((a, i) => {
                  const tone = ACTIVITY_TONE[a.type];
                  return (
                    <div key={i} className="flex gap-[9px]">
                      <div
                        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {a.init}
                      </div>
                      <div className="flex flex-col gap-px">
                        <span className="text-[11.5px] leading-[1.45] text-ink-3">{a.text}</span>
                        <span className="font-mono text-[9.5px] text-faint">{a.time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

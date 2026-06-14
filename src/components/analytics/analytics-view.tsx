"use client";

import { AgentAvatar } from "@/components/ui/avatar";
import { ChannelIcon } from "@/components/shared/channel-icon";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "@/stores/toasts";
import {
  dashboardMetrics,
  channelMix,
  confidenceDistribution,
  topTags,
  topCitedDocs,
  leaderboard,
  isResolved,
  pct,
  conf2,
} from "@/lib/metrics";

const DIST_LABELS = ["< 50%", "50–65%", "65–80%", "80–90%", "90%+"];
const DIST_COLORS = ["#F36C6C", "#F5B74E", "#F5B74E", "#3DD68C", "#3DD68C"];

export function AnalyticsView() {
  const { data: ws } = useWorkspace();
  const tickets = ws?.tickets ?? [];

  const m = dashboardMetrics(tickets);
  const mix = channelMix(tickets);
  const mixMax = Math.max(1, ...mix.map((c) => c.total));
  const dist = confidenceDistribution(tickets);
  const distMax = Math.max(1, ...dist);
  const tags = topTags(tickets);
  const tagMax = tags[0]?.[1] ?? 1;
  const docs = ws ? topCitedDocs(ws) : [];
  const docMax = docs[0]?.[1] ?? 1;
  const lead = leaderboard(tickets);

  const status = [
    { label: "Open", n: tickets.filter((t) => t.status === "open" && !isResolved(t)).length, color: "#5E89FF" },
    { label: "Waiting", n: tickets.filter((t) => t.status === "waiting").length, color: "#F5B74E" },
    { label: "Escalated", n: tickets.filter((t) => t.status === "escalated").length, color: "#F36C6C" },
    { label: "Resolved", n: tickets.filter(isResolved).length, color: "#3DD68C" },
  ];
  const statusMax = Math.max(1, ...status.map((s) => s.n));

  const cards = [
    { label: "Tickets handled", value: String(m.total), sub: `${m.open} open`, subColor: "#8A93A6", valueColor: "#E6EAF2" },
    { label: "Resolved", value: String(m.resolved), sub: m.total ? `${Math.round((m.resolved / m.total) * 100)}% of all` : "—", subColor: "#3DD68C", valueColor: "#E6EAF2" },
    { label: "AI acceptance", value: pct(m.acceptance), sub: `${m.aiSent}/${m.drafted} drafts sent`, subColor: "#8A93A6", valueColor: "#3DD68C" },
    { label: "SLA at risk", value: String(m.slaRisk), sub: "due ≤45m", subColor: m.slaRisk ? "#F36C6C" : "#8A93A6", valueColor: m.slaRisk ? "#F36C6C" : "#E6EAF2" },
  ];

  const exportReport = () => {
    const report = {
      workspace: ws?.name ?? "",
      generatedAt: new Date().toISOString(),
      metrics: m,
      ticketsByStatus: status.map((s) => ({ status: s.label, count: s.n })),
      channelMix: mix,
      confidenceDistribution: DIST_LABELS.map((label, i) => ({ band: label, count: dist[i] })),
      topTags: tags.map(([tag, count]) => ({ tag, count })),
      topCitedDocs: docs.map(([doc, citations]) => ({ doc, citations })),
      leaderboard: lead,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proofline-analytics.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Analytics exported as JSON");
  };

  if (ws && tickets.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
        <div className="mx-auto max-w-[760px] px-8 pb-10 pt-[56px] text-center">
          <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Analytics</div>
          <p className="mt-2 text-[13px] text-muted">
            Once tickets start flowing in, you’ll see support volume, AI acceptance, confidence,
            and per-agent performance here — all computed from your real conversations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1080px] px-8 pb-10 pt-[26px]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Analytics</div>
            <div className="text-[12px] text-muted">Support and AI performance · all-time, live workspace</div>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={exportReport}
            className="rounded-[7px] border border-white/9 bg-white/5 px-[13px] py-[7px] text-[12px] font-medium text-ink-2 hover:bg-white/9"
          >
            Export report
          </button>
        </div>

        {/* metric cards */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="flex flex-col gap-1.5 rounded-[11px] border border-white/7 bg-card px-[15px] py-[13px]">
              <span className="text-[11px] font-medium text-muted">{c.label}</span>
              <span className="font-mono text-[21px] font-semibold tracking-[-0.02em]" style={{ color: c.valueColor }}>{c.value}</span>
              <span className="text-[10.5px] font-medium" style={{ color: c.subColor }}>{c.sub}</span>
            </div>
          ))}
        </div>

        {/* volume by channel + status breakdown */}
        <div className="mt-3.5 grid grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[13px] font-semibold text-ink">Ticket volume by channel</span>
              <span className="ml-auto flex items-center gap-3 text-[10.5px] text-muted">
                <span className="flex items-center gap-[5px]"><span className="h-2 w-2 rounded-[2.5px] bg-accent" />AI-drafted</span>
                <span className="flex items-center gap-[5px]"><span className="h-2 w-2 rounded-[2.5px] bg-white/18" />Human only</span>
              </span>
            </div>
            <div className="mt-4 flex h-[160px] items-end gap-8">
              {mix.map((c) => (
                <div key={c.channel} title={`${c.total} ${c.label} · ${c.ai} AI-drafted`} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                  <div className="rounded-[3px_3px_2px_2px] bg-white/14" style={{ height: Math.max(2, Math.round((c.human / mixMax) * 145)), transition: "height 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
                  <div className="rounded-[2px_2px_3px_3px]" style={{ height: Math.max(c.ai ? 3 : 0, Math.round((c.ai / mixMax) * 145)), background: "linear-gradient(180deg, #5E89FF, #4D7CFE)", transition: "height 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-8 font-mono text-[9.5px] text-faint">
              {mix.map((c) => (
                <span key={c.channel} className="flex flex-1 items-center justify-center gap-[5px]">
                  <ChannelIcon channel={c.channel} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          <BarsCard title="Tickets by status">
            {status.map((s) => (
              <Bar key={s.label} label={s.label} width={`${Math.round((s.n / statusMax) * 100)}%`} color={s.color} value={String(s.n)} labelW={70} />
            ))}
          </BarsCard>
        </div>

        {/* dist / tags / docs */}
        <div className="mt-3.5 grid grid-cols-3 gap-3.5">
          <BarsCard title="AI confidence distribution">
            {dist.map((v, i) => (
              <Bar key={i} label={DIST_LABELS[i]!} width={`${Math.round((v / distMax) * 100)}%`} color={DIST_COLORS[i]!} value={String(v)} labelW={48} />
            ))}
          </BarsCard>
          <BarsCard title="Top tags">
            {tags.length === 0 ? <Empty /> : tags.map(([t, n]) => (
              <Bar key={t} label={t} width={`${Math.round((n / tagMax) * 100)}%`} color="rgba(77,124,254,0.7)" value={String(n)} labelW={92} />
            ))}
          </BarsCard>
          <BarsCard title="Most-cited docs">
            {docs.length === 0 ? <Empty /> : docs.map(([name, n]) => (
              <Bar key={name} label={name} width={`${Math.round((n / docMax) * 100)}%`} color="rgba(139,92,246,0.65)" value={String(n)} labelW={130} />
            ))}
          </BarsCard>
        </div>

        {/* leaderboard */}
        <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2.5 border-b border-white/7 px-[18px] py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span>Agent</span><span className="text-right">Resolved</span><span className="text-right">AI acceptance</span><span className="text-right">Avg confidence</span>
          </div>
          {lead.length === 0 ? (
            <div className="px-[18px] py-6 text-center text-[12px] text-muted">No tickets are assigned to agents yet.</div>
          ) : (
            lead.map((l) => (
              <div key={l.name} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-2.5 border-b border-white/[0.04] px-[18px] py-[11px]">
                <span className="flex items-center gap-[9px]">
                  <AgentAvatar name={l.name} size={24} />
                  <span className="text-[12.5px] font-medium text-ink">{l.name}</span>
                </span>
                <span className="text-right font-mono text-[12px] text-ink">{l.resolved}</span>
                <span className="text-right font-mono text-[12px] text-success">{pct(l.acceptance)}</span>
                <span className="text-right font-mono text-[12px] text-ink-4">{conf2(l.avgConfidence)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BarsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[11px] border border-white/7 bg-card px-[17px] py-[15px]">
      <span className="text-[12.5px] font-semibold text-ink">{title}</span>
      {children}
    </div>
  );
}

function Empty() {
  return <span className="text-[11px] text-muted">Not enough data yet.</span>;
}

function Bar({ label, width, color, value, labelW }: { label: string; width: string; color: string; value: string; labelW: number }) {
  return (
    <div className="flex items-center gap-[9px]">
      <span className="shrink-0 truncate text-[11px] text-ink-3" style={{ width: labelW }}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width, background: color, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
      </div>
      <span className="w-7 text-right font-mono text-[10px] text-muted">{value}</span>
    </div>
  );
}

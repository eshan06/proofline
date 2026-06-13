"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AgentAvatar } from "@/components/ui/avatar";
import { analyticsData } from "@/data/workspace";
import { toast } from "@/stores/toasts";
import { analyticsRangeKeySchema, type AnalyticsRangeKey, type AgentName } from "@/lib/schemas";

const RANGES: AnalyticsRangeKey[] = ["7d", "14d", "30d"];
const DIST_LABELS = ["< 50%", "50–65%", "65–80%", "80–90%", "90%+"];
const DIST_COLORS = ["#F36C6C", "#F5B74E", "#F5B74E", "#3DD68C", "#3DD68C"];

export function AnalyticsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = analyticsRangeKeySchema.safeParse(searchParams.get("range"));
  const range: AnalyticsRangeKey = parsed.success ? parsed.data : "7d";
  const A = analyticsData[range];

  const volMax = Math.max(...A.vol.map(([a, h]) => a + h));
  const distMax = Math.max(...A.dist);
  const tagMax = A.tags[0]![1];
  const docMax = A.docs[0]![1];

  // First-response SVG line+area.
  const f = A.frt;
  const fmin = Math.min(...f);
  const fmax = Math.max(...f);
  const px = (i: number) => 8 + i * (284 / (f.length - 1));
  const py = (v: number) => 78 - ((v - fmin) / (fmax - fmin || 1)) * 60;
  const pts = f.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `M${f.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L")} L${px(f.length - 1).toFixed(1)},86 L${px(0).toFixed(1)},86 Z`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1080px] px-8 pb-10 pt-[26px]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-[3px]">
            <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Analytics</div>
            <div className="text-[12px] text-muted">Support and AI performance · {A.l0} – {A.l1}</div>
          </div>
          <span className="flex-1" />
          <div className="flex gap-0.5 rounded-[8px] border border-white/8 bg-white/4 p-[3px]">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => router.push(`/analytics?range=${r}`)}
                className="rounded-[6px] px-[13px] py-[5px] font-mono text-[12px] font-medium"
                style={{ background: range === r ? "rgba(77,124,254,0.16)" : "transparent", color: range === r ? "#9DB7FF" : "#8A93A6" }}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => toast("Report exported as PDF")}
            className="rounded-[7px] border border-white/9 bg-white/5 px-[13px] py-[7px] text-[12px] font-medium text-ink-2 hover:bg-white/9"
          >
            Export report
          </button>
        </div>

        {/* metric cards */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {A.metrics.map((m) => (
            <div key={m[0]} className="flex flex-col gap-1.5 rounded-[11px] border border-white/7 bg-card px-[15px] py-[13px]">
              <span className="text-[11px] font-medium text-muted">{m[0]}</span>
              <span className="font-mono text-[21px] font-semibold tracking-[-0.02em] text-ink">{m[1]}</span>
              <span className="text-[10.5px] font-medium" style={{ color: m[3] }}>{m[2]}</span>
            </div>
          ))}
        </div>

        {/* volume + FRT */}
        <div className="mt-3.5 grid grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[13px] font-semibold text-ink">Ticket volume</span>
              <span className="ml-auto flex items-center gap-3 text-[10.5px] text-muted">
                <span className="flex items-center gap-[5px]"><span className="h-2 w-2 rounded-[2.5px] bg-accent" />AI-drafted</span>
                <span className="flex items-center gap-[5px]"><span className="h-2 w-2 rounded-[2.5px] bg-white/18" />Human only</span>
              </span>
            </div>
            <div className="mt-4 flex h-[160px] items-end gap-[5px]">
              {A.vol.map(([ai, human], i) => (
                <div key={i} title={`${ai + human} tickets · ${ai} via AI draft`} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                  <div className="rounded-[3px_3px_2px_2px] bg-white/14" style={{ height: Math.max(2, Math.round((human / volMax) * 150)), transition: "height 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
                  <div className="rounded-[2px_2px_3px_3px]" style={{ height: Math.max(3, Math.round((ai / volMax) * 150)), background: "linear-gradient(180deg, #5E89FF, #4D7CFE)", transition: "height 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9.5px] text-faint"><span>{A.l0}</span><span>{A.l1}</span></div>
          </div>

          <div className="flex flex-col rounded-[11px] border border-white/7 bg-card px-[18px] py-4">
            <div className="flex items-baseline">
              <span className="text-[13px] font-semibold text-ink">First response time</span>
              <span className="ml-auto font-mono text-[14px] font-semibold text-success">{f[f.length - 1]}m</span>
            </div>
            <svg viewBox="0 0 300 90" className="mt-3.5 h-auto w-full flex-1">
              <path d={area} fill="rgba(77,124,254,0.12)" />
              <polyline points={pts} fill="none" stroke="#4D7CFE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-faint"><span>{A.l0}</span><span>median minutes</span><span>{A.l1}</span></div>
          </div>
        </div>

        {/* dist / tags / docs */}
        <div className="mt-3.5 grid grid-cols-3 gap-3.5">
          <BarsCard title="AI confidence distribution">
            {A.dist.map((v, i) => (
              <Bar key={i} label={DIST_LABELS[i]!} width={`${Math.round((v / distMax) * 100)}%`} color={DIST_COLORS[i]!} value={String(v)} labelW={48} />
            ))}
          </BarsCard>
          <BarsCard title="Top tags">
            {A.tags.map(([t, n]) => (
              <Bar key={t} label={t} width={`${Math.round((n / tagMax) * 100)}%`} color="rgba(77,124,254,0.7)" value={String(n)} labelW={92} />
            ))}
          </BarsCard>
          <BarsCard title="Most-cited docs">
            {A.docs.map(([name, n]) => (
              <Bar key={name} label={name} width={`${Math.round((n / docMax) * 100)}%`} color="rgba(139,92,246,0.65)" value={String(n)} labelW={130} />
            ))}
          </BarsCard>
        </div>

        {/* leaderboard */}
        <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2.5 border-b border-white/7 px-[18px] py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span>Agent</span><span className="text-right">Resolved</span><span className="text-right">AI acceptance</span><span className="text-right">Median FRT</span>
          </div>
          {A.lead.map((l) => (
            <div key={l[0]} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-2.5 border-b border-white/[0.04] px-[18px] py-[11px]">
              <span className="flex items-center gap-[9px]">
                <AgentAvatar name={l[0] as AgentName} size={24} />
                <span className="text-[12.5px] font-medium text-ink">{l[0]}</span>
              </span>
              <span className="text-right font-mono text-[12px] text-ink">{l[1]}</span>
              <span className="text-right font-mono text-[12px] text-success">{l[2]}</span>
              <span className="text-right font-mono text-[12px] text-ink-4">{l[3]}</span>
            </div>
          ))}
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

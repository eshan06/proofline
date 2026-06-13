"use client";

import { useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToggleIntegration } from "@/hooks/use-integrations";
import { toast } from "@/stores/toasts";
import type { Integration, IntegrationKey } from "@/lib/schemas";

export function IntegrationsView() {
  const { data: ws } = useWorkspace();
  const integrations = ws?.integrations ?? [];
  const toggle = useToggleIntegration();
  const [openPanel, setOpenPanel] = useState<IntegrationKey | "">("webchat");

  const connectedCount = integrations.filter((i) => i.connected).length;

  const onToggle = (g: Integration) => {
    const next = !g.connected;
    toggle.mutate({ key: g.key, name: g.name, connected: next });
    if (next && g.configurable) setOpenPanel(g.key);
    else if (!next && openPanel === g.key) setOpenPanel("");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ animation: "plFade 0.22s ease" }}>
      <div className="mx-auto max-w-[1080px] px-8 pb-10 pt-[26px]">
        <div className="flex flex-col gap-[3px]">
          <div className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Integrations</div>
          <div className="text-[12px] text-muted">Channels in, context out — {connectedCount} of 10 connected</div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {integrations.map((g) => {
            const panelOpen = openPanel === g.key && g.connected;
            return (
              <div
                key={g.key}
                className="flex flex-col gap-2.5 rounded-[11px] border bg-card px-[15px] py-3.5 transition-colors hover:border-accent/40"
                style={{ borderColor: panelOpen ? "rgba(77,124,254,0.4)" : "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/8 bg-white/5 font-mono text-[11px] font-semibold" style={{ color: g.fg }}>
                    {g.glyph}
                  </div>
                  <div className="flex min-w-0 flex-col gap-px">
                    <span className="text-[13px] font-semibold text-ink">{g.name}</span>
                    <span className="truncate text-[10.5px] text-muted">{g.desc}</span>
                  </div>
                  <span className="ml-auto h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: g.connected ? "#3DD68C" : "#444B5C" }} />
                </div>
                <div className="flex items-center gap-[7px] text-[10.5px] text-muted">
                  <span className="truncate">{g.connected ? g.perms : "Not connected"}</span>
                  <span className="flex-1" />
                  <span className="shrink-0 font-mono">{g.connected ? g.last : "—"}</span>
                </div>
                <div className="flex gap-[7px]">
                  <button
                    type="button"
                    onClick={() => onToggle(g)}
                    className="flex-1 rounded-[7px] border px-0 py-1.5 text-[11.5px] font-medium hover:opacity-85"
                    style={{
                      background: g.connected ? "rgba(255,255,255,0.04)" : "#4D7CFE",
                      borderColor: g.connected ? "rgba(255,255,255,0.1)" : "transparent",
                      color: g.connected ? "#8A93A6" : "#fff",
                    }}
                  >
                    {g.connected ? "Disconnect" : "Connect"}
                  </button>
                  {g.connected && g.configurable ? (
                    <button
                      type="button"
                      onClick={() => setOpenPanel(g.key)}
                      className="rounded-[7px] border border-white/10 bg-white/4 px-[13px] py-1.5 text-[11.5px] font-medium text-ink-2 hover:border-accent/50 hover:text-accent-soft"
                    >
                      Configure
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {openPanel === "webchat" && integrations.find((i) => i.key === "webchat")?.connected ? (
          <WebchatPanel onClose={() => setOpenPanel("")} />
        ) : null}
        {openPanel === "gmail" && integrations.find((i) => i.key === "gmail")?.connected ? (
          <GmailPanel onClose={() => setOpenPanel("")} />
        ) : null}
        {openPanel === "slack" && integrations.find((i) => i.key === "slack")?.connected ? (
          <SlackPanel onClose={() => setOpenPanel("")} />
        ) : null}
      </div>
    </div>
  );
}

function PanelShell({ title, badge, badgeColor, badgeBg, onClose, children }: { title: string; badge: string; badgeColor: string; badgeBg: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-accent/30 bg-card" style={{ animation: "plFade 0.2s ease" }}>
      <div className="flex items-center gap-[9px] border-b border-white/6 px-[18px] py-[13px]">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="rounded-full px-[9px] py-0.5 text-[10.5px]" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>
        <button type="button" onClick={onClose} className="ml-auto border-0 bg-transparent text-[14px] text-muted hover:text-ink">×</button>
      </div>
      {children}
    </div>
  );
}

function WebchatPanel({ onClose }: { onClose: () => void }) {
  const [color, setColor] = useState("#4D7CFE");
  const swatches = ["#4D7CFE", "#8B5CF6", "#2DD4BF", "#F5B74E"];
  return (
    <PanelShell title="Website Chat setup" badge="Live" badgeColor="#3DD68C" badgeBg="rgba(61,214,140,0.1)" onClose={onClose}>
      <div className="grid grid-cols-[1.3fr_1fr] gap-[18px] px-[18px] py-4">
        <div className="flex min-w-0 flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-semibold text-ink-4">Embed snippet</span>
            <div className="relative overflow-x-auto rounded-[9px] border border-white/8 bg-black/35 px-3.5 py-3 font-mono text-[11px] leading-[1.7] text-ink-3">
              <span className="text-muted">&lt;script&gt;</span><br />
              &nbsp;&nbsp;window.prooflineId = <span className="text-accent-soft">&quot;acme_7f3k2&quot;</span>;<br />
              <span className="text-muted">&lt;/script&gt;</span><br />
              <span className="text-muted">&lt;script src=</span><span className="text-accent-soft">&quot;https://cdn.proofline.com/widget.js&quot;</span><span className="text-muted"> async&gt;&lt;/script&gt;</span>
              <button type="button" onClick={() => toast("Embed snippet copied to clipboard")} className="absolute right-[9px] top-[9px] rounded-[6px] border border-white/10 bg-white/6 px-2.5 py-[3px] text-[10.5px] text-ink-2 hover:bg-white/12">Copy</button>
            </div>
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-semibold text-ink-4">Brand color</span>
            <div className="flex gap-2">
              {swatches.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className="h-[26px] w-[26px] rounded-full" style={{ background: c, border: `2px solid ${color === c ? "#fff" : "transparent"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-semibold text-ink-4">Allowed domains</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-[3px] font-mono text-[10.5px] text-ink-3">acme.io</span>
              <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-[3px] font-mono text-[10.5px] text-ink-3">app.acme.io</span>
              <button type="button" onClick={() => toast("Add an allowed domain")} className="rounded-full border border-dashed border-white/15 px-2.5 py-[3px] font-mono text-[10.5px] text-muted hover:border-accent/40 hover:text-accent-soft">+ add</button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-[7px]">
          <span className="text-[11px] font-semibold text-ink-4">Live preview</span>
          <div className="flex flex-col gap-[9px] rounded-[11px] border border-white/7 bg-black/30 p-3.5">
            <div className="flex max-w-[85%] items-center gap-2 self-end rounded-[9px_9px_3px_9px] px-[11px] py-2" style={{ background: color, transition: "background 0.25s" }}>
              <span className="text-[11px] leading-[1.45] text-white">Hi! I can&apos;t access my upgraded plan</span>
            </div>
            <div className="flex max-w-[90%] flex-col gap-[5px] rounded-[9px_9px_9px_3px] border border-white/7 bg-white/4 px-[11px] py-2">
              <span className="text-[11px] leading-[1.5] text-[#D6DCE8]">Your payment went through — the upgrade just hasn&apos;t synced. Refreshing it now!</span>
              <span className="font-mono text-[9px]" style={{ color, transition: "color 0.25s" }}>Billing &amp; Plans ¹ · 92% confident</span>
            </div>
            <div className="mt-[3px] flex items-center gap-[7px]">
              <div className="flex h-[26px] flex-1 items-center rounded-full border border-white/8 bg-white/5 px-[11px] text-[10px] text-muted">Type a message…</div>
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] text-white" style={{ background: color, transition: "background 0.25s" }}>→</div>
            </div>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function GmailPanel({ onClose }: { onClose: () => void }) {
  const [opts, setOpts] = useState({ hist: true, labels: false, alias: true });
  const rows: [string, keyof typeof opts][] = [
    ["Import last 90 days of history", "hist"],
    ["Sync Gmail labels as tags", "labels"],
    ["Send replies from support@acme.io", "alias"],
  ];
  return (
    <PanelShell title="Gmail setup" badge="Sync delayed 4m" badgeColor="#F5B74E" badgeBg="rgba(245,183,78,0.08)" onClose={onClose}>
      <div className="flex flex-col gap-[13px] px-[18px] py-4">
        <div className="flex items-center gap-[11px] rounded-[10px] border border-white/7 bg-white/[0.025] px-3.5 py-[11px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-danger/12 text-[12px] font-semibold text-danger-soft">M</div>
          <div className="flex flex-col gap-px">
            <span className="text-[12.5px] font-medium text-ink">support@acme.io</span>
            <span className="text-[10.5px] text-muted">OAuth connected · scopes: read, send</span>
          </div>
          <button type="button" onClick={() => toast("Gmail sync queued — usually completes in under a minute")} className="ml-auto rounded-[7px] border border-white/10 bg-white/4 px-3 py-[5px] text-[11.5px] text-ink-2 hover:border-accent/50 hover:text-accent-soft">Sync now</button>
        </div>
        {rows.map(([label, key]) => (
          <div key={key} className="flex items-center gap-2.5">
            <span className="flex-1 text-[12.5px] text-ink-2">{label}</span>
            <ToggleSwitch on={opts[key]} onToggle={() => setOpts((o) => ({ ...o, [key]: !o[key] }))} label={label} />
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function SlackPanel({ onClose }: { onClose: () => void }) {
  const routes: [string, string][] = [
    ["#support", "Inbox · all messages"],
    ["#billing-alerts", "Billing team only"],
    ["#vip-customers", "High priority + VIP tag"],
  ];
  return (
    <PanelShell title="Slack setup" badge="2 workspaces" badgeColor="#3DD68C" badgeBg="rgba(61,214,140,0.1)" onClose={onClose}>
      <div className="flex flex-col gap-2.5 px-[18px] py-4">
        <span className="text-[11px] font-semibold text-ink-4">Channel routing</span>
        {routes.map(([ch, rule]) => (
          <div key={ch} className="flex items-center gap-2.5 rounded-[9px] border border-white/7 bg-white/[0.025] px-[13px] py-[9px]">
            <span className="font-mono text-[12px] text-violet-soft">{ch}</span>
            <span className="font-mono text-[10px] text-muted">→</span>
            <span className="text-[12px] text-ink-3">{rule}</span>
          </div>
        ))}
        <button type="button" onClick={() => toast("Channel routing editor")} className="self-start rounded-[8px] border border-dashed border-white/15 px-[13px] py-1.5 text-[11.5px] text-ink-4 hover:border-accent/40 hover:text-accent-soft">+ Add routing rule</button>
      </div>
    </PanelShell>
  );
}

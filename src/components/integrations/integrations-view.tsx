"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToggleIntegration } from "@/hooks/use-integrations";
import { toast } from "@/stores/toasts";
import type { Integration, IntegrationKey, WidgetConfig } from "@/lib/schemas";

/** OAuth-channel keys that connect via a redirect round-trip (not a boolean flip). */
const OAUTH_CHANNELS: { key: IntegrationKey; label: string }[] = [
  { key: "gmail", label: "Gmail" },
  { key: "slack", label: "Slack" },
];

function oauthResultMessage(label: string, result: string): string | null {
  switch (result) {
    case "connected": return `${label} connected.`;
    case "unconfigured": return `${label} isn't configured on this deployment yet.`;
    case "forbidden": return `Only admins can connect ${label}.`;
    case "denied": return `${label} connection was cancelled.`;
    case "error": return `Couldn't connect ${label} — please try again.`;
    default: return null;
  }
}

export function IntegrationsView() {
  const { data: ws } = useWorkspace();
  const integrations = ws?.integrations ?? [];
  const toggle = useToggleIntegration();
  const [openPanel, setOpenPanel] = useState<IntegrationKey | "">("webchat");

  // Surface the result of an OAuth round-trip (callback redirects with ?gmail=… /
  // ?slack=…), then strip the param so a refresh doesn't re-toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let matched = false;
    for (const { key, label } of OAUTH_CHANNELS) {
      const result = params.get(key);
      if (!result) continue;
      matched = true;
      const msg = oauthResultMessage(label, result);
      if (msg) toast(msg);
      if (result === "connected") setOpenPanel(key);
    }
    if (matched) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const connectedCount = integrations.filter((i) => i.connected).length;

  const onToggle = (g: Integration) => {
    // Gmail/Slack connect via a real OAuth round-trip, not a boolean flip.
    if (OAUTH_CHANNELS.some((c) => c.key === g.key) && !g.connected) {
      window.location.href = `/api/integrations/${g.key}/connect`;
      return;
    }
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
          <WebchatPanel widget={ws?.widget} onClose={() => setOpenPanel("")} />
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

function WebchatPanel({ widget, onClose }: { widget: WidgetConfig | undefined; onClose: () => void }) {
  const [color, setColor] = useState("#4D7CFE");
  const swatches = ["#4D7CFE", "#8B5CF6", "#2DD4BF", "#F5B74E"];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const siteKey = widget?.siteKey ?? "";
  const snippet = `<script src="${origin}/api/widget/embed?key=${siteKey}" async></script>`;
  const allowed = widget?.allowedOrigins ?? [];
  const copy = () => {
    navigator.clipboard?.writeText(snippet).then(
      () => toast("Embed snippet copied to clipboard"),
      () => toast("Copy failed — select and copy manually"),
    );
  };
  return (
    <PanelShell title="Website Chat setup" badge="Live" badgeColor="#3DD68C" badgeBg="rgba(61,214,140,0.1)" onClose={onClose}>
      <div className="grid grid-cols-[1.3fr_1fr] gap-[18px] px-[18px] py-4">
        <div className="flex min-w-0 flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <span className="text-[11px] font-semibold text-ink-4">Embed snippet</span>
            <p className="text-[10.5px] text-muted">Paste this before <span className="font-mono">&lt;/body&gt;</span> on your site. The chat launcher appears bottom-right; messages land in your inbox.</p>
            <div className="relative overflow-x-auto rounded-[9px] border border-white/8 bg-black/35 px-3.5 py-3 pr-16 font-mono text-[11px] leading-[1.7] text-ink-3">
              <span className="break-all">{snippet}</span>
              <button type="button" onClick={copy} className="absolute right-[9px] top-[9px] rounded-[6px] border border-white/10 bg-white/6 px-2.5 py-[3px] text-[10.5px] text-ink-2 hover:bg-white/12">Copy</button>
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
              {allowed.length ? (
                allowed.map((d) => (
                  <span key={d} className="rounded-full border border-white/8 bg-white/4 px-2.5 py-[3px] font-mono text-[10.5px] text-ink-3">{d}</span>
                ))
              ) : (
                <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-[3px] font-mono text-[10.5px] text-muted">Any origin — add domains to restrict</span>
              )}
              <button type="button" onClick={() => toast("Domain allowlist editing — coming soon")} className="rounded-full border border-dashed border-white/15 px-2.5 py-[3px] font-mono text-[10.5px] text-muted hover:border-accent/40 hover:text-accent-soft">+ add</button>
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
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/gmail/poll", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast(data.error ?? "Sync failed — try again.");
      else if (data.disabled) toast("Gmail isn't configured on this deployment yet.");
      else if (data.connected === false) toast("Reconnect Gmail to sync inbound mail.");
      else toast(`Synced — ${data.created} new ticket${data.created === 1 ? "" : "s"}, ${data.appended} updated.`);
    } catch {
      toast("Sync failed — try again.");
    } finally {
      setSyncing(false);
    }
  };
  return (
    <PanelShell title="Gmail setup" badge="Connected" badgeColor="#3DD68C" badgeBg="rgba(61,214,140,0.1)" onClose={onClose}>
      <div className="flex flex-col gap-[13px] px-[18px] py-4">
        <div className="flex items-center gap-[11px] rounded-[10px] border border-white/7 bg-white/[0.025] px-3.5 py-[11px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-success/12 text-[12px] font-semibold text-success">M</div>
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[12.5px] font-medium text-ink">Gmail connected</span>
            <span className="text-[10.5px] text-muted">Inbound email becomes tickets; replies send from your mailbox, threaded.</span>
          </div>
          <button type="button" disabled={syncing} onClick={sync} className="ml-auto shrink-0 rounded-[7px] border border-white/10 bg-white/4 px-3 py-[5px] text-[11.5px] text-ink-2 hover:border-accent/50 hover:text-accent-soft disabled:opacity-50">
            {syncing ? "Syncing…" : "Sync inbound"}
          </button>
        </div>
        <p className="text-[11px] leading-[1.6] text-muted">
          For always-on inbound, run the poll endpoint on a schedule (or point a
          Gmail push notification at it). Disconnecting forgets the stored OAuth token.
        </p>
      </div>
    </PanelShell>
  );
}

function SlackPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="Slack setup" badge="Connected" badgeColor="#3DD68C" badgeBg="rgba(61,214,140,0.1)" onClose={onClose}>
      <div className="flex flex-col gap-[13px] px-[18px] py-4">
        <div className="flex items-center gap-[11px] rounded-[10px] border border-white/7 bg-white/[0.025] px-3.5 py-[11px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full font-mono text-[13px] font-semibold" style={{ background: "rgba(139,92,246,0.15)", color: "#C4B0F8" }}>#</div>
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[12.5px] font-medium text-ink">Slack connected</span>
            <span className="text-[10.5px] text-muted">Messages in your channels become tickets; agent replies post back to the thread.</span>
          </div>
        </div>
        <p className="text-[11px] leading-[1.6] text-muted">
          Point your Slack app&apos;s Events API request URL at
          <span className="mx-1 rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">/api/integrations/slack/events</span>
          and subscribe to <span className="font-mono text-[10.5px] text-ink-3">message.channels</span>. Disconnecting forgets the stored bot token.
        </p>
      </div>
    </PanelShell>
  );
}

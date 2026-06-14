/**
 * Dashboard metrics — pure, truthful aggregates derived from a loaded
 * Workspace. Every value here is computed from the *current* ticket/KB/audit
 * data; nothing is fabricated.
 *
 * Deliberately omitted: time-series trends, period-over-period deltas, and
 * per-day volume/response-time charts. The workspace payload stores `time` as a
 * relative human label ("just now", "2m ago"), not a timestamp, so there is no
 * trustworthy history to chart. Surfacing a fake "+12% vs last week" would be
 * exactly the fixture problem this module replaces. When real event history
 * lands (an events table with timestamps), trend functions can be added here.
 */
import type { AgentName, AuditEvent, Channel, Ticket, Workspace } from "@/lib/schemas";
import { inboxTickets, isSlaRisk } from "@/lib/inbox-filter";

const AGENTS: AgentName[] = ["Eshan", "Maya", "Leo"];

/* ------------------------------------------------------------------ */
/*  Ticket predicates                                                  */
/* ------------------------------------------------------------------ */

/** A ticket considered resolved (closed conversation / resolved board stage). */
export const isResolved = (t: Ticket) => t.status === "closed" || t.stage === "resolved";
export const isUnresolved = (t: Ticket) => !isResolved(t);

/** An AI reply was actually sent on this ticket (the draft was accepted). */
export const aiReplySent = (t: Ticket) => t.messages.some((m) => m.kind === "agent" && m.viaAI === true);

/** The AI produced a draft for this ticket (still pending, or already sent). */
export const aiDrafted = (t: Ticket) => t.draft != null || aiReplySent(t);

/** Count of AI-authored replies actually sent across a ticket's transcript. */
const aiReplyCount = (t: Ticket) => t.messages.filter((m) => m.kind === "agent" && m.viaAI === true).length;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Headline metrics (Home + Analytics cards)                          */
/* ------------------------------------------------------------------ */

export interface DashboardMetrics {
  /** Live (non-archived) tickets still needing work. */
  open: number;
  /** Live unresolved tickets at urgent priority. */
  urgent: number;
  /** Live unresolved tickets whose first-response SLA is at risk. */
  slaRisk: number;
  /** Tickets that have been resolved (across all tickets, incl. archived). */
  resolved: number;
  /** All tickets in the workspace (the support volume handled). */
  total: number;
  /** Tickets the AI drafted for (sent or pending). */
  drafted: number;
  /** Tickets where an AI reply was actually sent. */
  aiSent: number;
  /** Total AI replies sent (counts multiple per ticket). */
  aiReplies: number;
  /** aiSent / drafted, 0..1 — null when the AI hasn't drafted anything yet. */
  acceptance: number | null;
  /** Mean AI confidence over tickets that have a score — null when none. */
  avgConfidence: number | null;
}

export function dashboardMetrics(tickets: Ticket[]): DashboardMetrics {
  const all = tickets;
  const live = inboxTickets(tickets);
  const liveUnresolved = live.filter(isUnresolved);

  const drafted = all.filter(aiDrafted);
  const sent = all.filter(aiReplySent);
  const confs = all.map((t) => t.conf).filter((c): c is number => c != null);

  return {
    open: liveUnresolved.length,
    urgent: liveUnresolved.filter((t) => t.priority === "urgent").length,
    slaRisk: liveUnresolved.filter(isSlaRisk).length,
    resolved: all.filter(isResolved).length,
    total: all.length,
    drafted: drafted.length,
    aiSent: sent.length,
    aiReplies: all.reduce((n, t) => n + aiReplyCount(t), 0),
    acceptance: drafted.length ? sent.length / drafted.length : null,
    avgConfidence: mean(confs),
  };
}

/* ------------------------------------------------------------------ */
/*  Channel health                                                     */
/* ------------------------------------------------------------------ */

export interface ChannelHealth {
  channel: Channel;
  label: string;
  /** Live tickets currently on this channel. */
  live: number;
  /** Whether the channel is wired up (widget enabled / integration connected). */
  connected: boolean;
}

const CHANNEL_LABELS: Record<Channel, string> = {
  web: "Website chat",
  email: "Email",
  slack: "Slack",
};

export function channelHealth(ws: Pick<Workspace, "tickets" | "integrations" | "widget">): ChannelHealth[] {
  const live = inboxTickets(ws.tickets);
  const connectedKey = (key: string) => ws.integrations.some((i) => i.key === key && i.connected);
  const connected: Record<Channel, boolean> = {
    web: ws.widget.enabled || connectedKey("webchat"),
    email: connectedKey("gmail"),
    slack: connectedKey("slack"),
  };
  return (["web", "email", "slack"] as Channel[]).map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    live: live.filter((t) => t.channel === channel).length,
    connected: connected[channel],
  }));
}

/** Live-ticket volume per channel, split by whether the AI drafted a reply. */
export interface ChannelMix {
  channel: Channel;
  label: string;
  ai: number;
  human: number;
  total: number;
}

export function channelMix(tickets: Ticket[]): ChannelMix[] {
  const live = inboxTickets(tickets);
  return (["web", "email", "slack"] as Channel[]).map((channel) => {
    const ts = live.filter((t) => t.channel === channel);
    const ai = ts.filter(aiDrafted).length;
    return { channel, label: CHANNEL_LABELS[channel], ai, human: ts.length - ai, total: ts.length };
  });
}

/* ------------------------------------------------------------------ */
/*  Activity feed (from the audit log)                                 */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  init: string;
  text: string;
  time: string;
  type: AuditEvent["type"];
}

/**
 * Most-recent audit events, mapped for the activity feed. Expects `audit`
 * newest-first — both repositories provide it that way (memory unshifts new
 * events; the Postgres query orders by createdAt desc). `time` is a relative
 * label and cannot be re-sorted here, so ordering must hold upstream.
 */
export function recentActivity(audit: AuditEvent[], limit = 6): ActivityEntry[] {
  return audit.slice(0, limit).map((e) => ({
    init: initialsOf(e.user),
    text: e.action,
    time: e.time,
    type: e.type,
  }));
}

/* ------------------------------------------------------------------ */
/*  Needs-attention tickets                                            */
/* ------------------------------------------------------------------ */

export type AttentionReason = "sla" | "low-confidence" | "no-draft";

export interface AttentionEntry {
  id: string;
  subject: string;
  who: string;
  reason: AttentionReason;
  /** Minutes to SLA breach when reason is "sla". */
  slaMins: number;
  /** Confidence when reason is "low-confidence". */
  conf: number | null;
  time: string;
}

const LOW_CONF = 0.7;

/**
 * Live, unresolved tickets that need a human, ranked: SLA-at-risk first
 * (soonest breach), then low-confidence drafts, then open tickets with no draft.
 */
export function attentionTickets(tickets: Ticket[], limit = 4): AttentionEntry[] {
  const live = inboxTickets(tickets).filter(isUnresolved);

  const reasonOf = (t: Ticket): AttentionReason | null => {
    if (isSlaRisk(t)) return "sla";
    if (t.conf != null && t.conf < LOW_CONF) return "low-confidence";
    if (t.draft == null && !aiReplySent(t)) return "no-draft";
    return null;
  };
  const rank: Record<AttentionReason, number> = { sla: 0, "low-confidence": 1, "no-draft": 2 };

  return live
    .map((t) => ({ t, reason: reasonOf(t) }))
    .filter((x): x is { t: Ticket; reason: AttentionReason } => x.reason != null)
    .sort((a, b) => {
      if (a.reason !== b.reason) return rank[a.reason] - rank[b.reason];
      if (a.reason === "sla") return a.t.slaMins - b.t.slaMins; // soonest breach first
      if (a.reason === "low-confidence") return (a.t.conf ?? 1) - (b.t.conf ?? 1);
      return 0;
    })
    .slice(0, limit)
    .map(({ t, reason }) => ({
      id: t.id,
      subject: t.subject,
      who: `${t.customer.name} · ${t.customer.company}`,
      reason,
      slaMins: t.slaMins,
      conf: t.conf,
      time: t.time,
    }));
}

/* ------------------------------------------------------------------ */
/*  Distributions (Analytics)                                          */
/* ------------------------------------------------------------------ */

/** AI confidence histogram: [<50%, 50–65%, 65–80%, 80–90%, 90%+]. */
export function confidenceDistribution(tickets: Ticket[]): [number, number, number, number, number] {
  const buckets: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const t of tickets) {
    if (t.conf == null) continue;
    const c = t.conf;
    const i = c < 0.5 ? 0 : c < 0.65 ? 1 : c < 0.8 ? 2 : c < 0.9 ? 3 : 4;
    buckets[i] += 1;
  }
  return buckets;
}

/** Most-used tags across live tickets, descending. */
export function topTags(tickets: Ticket[], limit = 6): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of inboxTickets(tickets)) {
    for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/**
 * Most-cited KB docs, by how often the AI actually cited them in drafts
 * (citation.uses summed by title). Falls back to the KB's own `cited` counter
 * when no draft citations exist yet.
 */
export function topCitedDocs(ws: Pick<Workspace, "tickets" | "kbDocs">, limit = 5): [string, number][] {
  const uses = new Map<string, number>();
  for (const t of ws.tickets) {
    if (!t.draft) continue;
    for (const c of t.draft.citations) uses.set(c.title, (uses.get(c.title) ?? 0) + c.uses);
  }
  if (uses.size === 0) {
    for (const d of ws.kbDocs) {
      const n = parseInt(d.cited, 10);
      if (Number.isFinite(n) && n > 0) uses.set(d.name, n);
    }
  }
  return [...uses.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  Per-agent leaderboard                                              */
/* ------------------------------------------------------------------ */

export interface AgentStat {
  name: AgentName;
  /** Tickets assigned to this agent. */
  assigned: number;
  resolved: number;
  /** aiSent / drafted for this agent's tickets — null when none drafted. */
  acceptance: number | null;
  avgConfidence: number | null;
}

export function leaderboard(tickets: Ticket[]): AgentStat[] {
  return AGENTS.map((name): AgentStat => {
    const mine = tickets.filter((t) => t.assignee === name);
    const drafted = mine.filter(aiDrafted);
    const sent = mine.filter(aiReplySent);
    return {
      name,
      assigned: mine.length,
      resolved: mine.filter(isResolved).length,
      acceptance: drafted.length ? sent.length / drafted.length : null,
      avgConfidence: mean(mine.map((t) => t.conf).filter((c): c is number => c != null)),
    };
  })
    .filter((s) => s.assigned > 0)
    .sort((a, b) => b.resolved - a.resolved);
}

/* ------------------------------------------------------------------ */
/*  Billing usage                                                      */
/* ------------------------------------------------------------------ */

export interface UsageStat {
  label: string;
  value: string;
  /** 0..1 fill for the bar, or null when the limit is unbounded. */
  ratio: number | null;
}

export function billingUsage(ws: Pick<Workspace, "tickets" | "kbDocs" | "subscription">): UsageStat[] {
  const m = dashboardMetrics(ws.tickets);
  const indexed = ws.kbDocs.filter((d) => d.status === "indexed").length;
  const sub = ws.subscription;
  const seatLimit = sub?.seatLimit ?? 0;
  const seatsUsed = sub?.seatsUsed ?? 0;
  return [
    { label: "Tickets handled", value: String(m.total), ratio: null },
    { label: "AI replies sent", value: String(m.aiReplies), ratio: null },
    { label: "Docs indexed", value: String(indexed), ratio: null },
    {
      label: "Team seats",
      value: seatLimit > 0 ? `${seatsUsed} / ${seatLimit}` : String(seatsUsed),
      ratio: seatLimit > 0 ? Math.min(1, seatsUsed / seatLimit) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers (shared by the views)                           */
/* ------------------------------------------------------------------ */

/** 0..1 → "87%" (null → "—"). */
export function pct(ratio: number | null): string {
  return ratio == null ? "—" : `${Math.round(ratio * 100)}%`;
}

/** 0..1 → "0.84" (null → "—"). */
export function conf2(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

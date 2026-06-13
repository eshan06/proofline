import type {
  AuditEvent,
  AnalyticsRangeKey,
  AnalyticsRange,
  Automation,
  CopilotSettings,
  Customer,
  Integration,
  KbDoc,
  Member,
  Notification,
} from "@/lib/schemas";

/**
 * Workspace fixture data — ported VERBATIM from the design prototypes
 * (`customersData`, `kbBase`, `automationsData`, `analyticsData`,
 * `integrationsData`, `auditData`, `notifData`, `members` in
 * Proofline App.dc.html).
 */

export const agents = {
  Eshan: { init: "E", bg: "rgba(77,124,254,0.18)", fg: "#9DB7FF" },
  Maya: { init: "M", bg: "rgba(139,92,246,0.18)", fg: "#C4B0F8" },
  Leo: { init: "L", bg: "rgba(45,212,191,0.16)", fg: "#8EE8DC" },
} as const;

export type AgentInfo = (typeof agents)[keyof typeof agents];

export const seedCustomers: Customer[] = [
  {
    id: "ava-chen",
    name: "Ava Chen",
    company: "Northwind",
    init: "AC",
    hue: 210,
    email: "ava@northwind.co",
    plan: "Growth",
    mrr: "$294/mo",
    since: "Mar 2025",
    loc: "Seattle, US",
    seats: "6 seats",
    lastActive: "4m ago",
    convos: 14,
    sentiment: "Stressed",
    notes: [
      { author: "Maya", time: "8m ago", text: "Hit the plan-sync webhook bug — same as TKT-988. Watch for repeat billing issues." },
      { author: "Eshan", time: "Feb 2026", text: "Champion for the Growth upgrade; runs their support team of 6." },
    ],
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    company: "Lumen Labs",
    init: "ML",
    hue: 280,
    email: "marcus@lumenlabs.io",
    plan: "Growth",
    mrr: "$196/mo",
    since: "Aug 2025",
    loc: "Toronto, CA",
    seats: "4 seats",
    lastActive: "16m ago",
    convos: 9,
    sentiment: "Neutral",
    notes: [{ author: "Leo", time: "Apr 2026", text: "Heavy Slack user — prefers replies in-channel over email." }],
  },
  {
    id: "priya-raman",
    name: "Priya Raman",
    company: "Arcadia",
    init: "PR",
    hue: 30,
    email: "priya@arcadia.dev",
    plan: "Scale",
    mrr: "$1,240/mo",
    since: "Jan 2025",
    loc: "London, UK",
    seats: "18 seats",
    lastActive: "1h ago",
    convos: 23,
    sentiment: "Satisfied",
    notes: [{ author: "Maya", time: "May 2026", text: "Enterprise renewal closed for 12 months. Finance contact: j.wright@arcadia.dev." }],
  },
  {
    id: "jordan-kim",
    name: "Jordan Kim",
    company: "Polygraph",
    init: "JK",
    hue: 150,
    email: "jordan@polygraph.app",
    plan: "Free",
    mrr: "$0",
    since: "Jun 2026",
    loc: "Austin, US",
    seats: "2 seats",
    lastActive: "3h ago",
    convos: 2,
    sentiment: "Delighted",
    notes: [],
  },
  {
    id: "sofia-martinez",
    name: "Sofia Martinez",
    company: "Helio Systems",
    init: "SM",
    hue: 330,
    email: "sofia@helio.systems",
    plan: "Growth",
    mrr: "$441/mo",
    since: "Nov 2025",
    loc: "Madrid, ES",
    seats: "9 seats",
    lastActive: "5h ago",
    convos: 11,
    sentiment: "Neutral",
    notes: [{ author: "Leo", time: "4h ago", text: "Reported the chart timeout bug (LIN-482) — notify when shipped." }],
  },
  {
    id: "daniel-park",
    name: "Daniel Park",
    company: "Helio Systems",
    init: "DP",
    hue: 195,
    email: "daniel@helio.systems",
    plan: "Scale (trial)",
    mrr: "—",
    since: "Jun 2026",
    loc: "Madrid, ES",
    seats: "—",
    lastActive: "1d ago",
    convos: 1,
    sentiment: "Evaluating",
    notes: [{ author: "Eshan", time: "1d ago", text: "Security review in progress — needs SAML docs before Scale signature." }],
  },
];

export const sentimentColor: Record<Customer["sentiment"], string> = {
  Stressed: "#F5B74E",
  Neutral: "#8A93A6",
  Satisfied: "#3DD68C",
  Delighted: "#3DD68C",
  Evaluating: "#9DB7FF",
};

export const seedKbDocs: KbDoc[] = [
  { id: "kb-1", name: "Getting started.md", source: "Notion", status: "indexed", chunks: "36", cited: "208", synced: "2h ago" },
  { id: "kb-2", name: "Billing & Plans.md", source: "Notion", status: "indexed", chunks: "48", cited: "132", synced: "2h ago" },
  { id: "kb-3", name: "Refund policy.pdf", source: "Upload", status: "indexed", chunks: "22", cited: "97", synced: "1d ago" },
  { id: "kb-4", name: "Bug response playbook.md", source: "Notion", status: "indexed", chunks: "14", cited: "55", synced: "2h ago" },
  { id: "kb-5", name: "Stripe sync runbook.md", source: "Notion", status: "indexed", chunks: "12", cited: "41", synced: "2h ago" },
  { id: "kb-6", name: "Slack integration guide", source: "Help Center", status: "indexed", chunks: "18", cited: "18", synced: "3h ago" },
  { id: "kb-7", name: "Known issues.md", source: "Notion", status: "indexed", chunks: "9", cited: "12", synced: "30m ago" },
  { id: "kb-8", name: "SSO configuration guide.pdf", source: "Upload", status: "failed", chunks: "—", cited: "—", synced: "failed 1h ago" },
];

export const seedAutomations: Automation[] = [
  {
    id: "a1",
    name: "Escalate billing tickets over $500",
    trigger: "New ticket created",
    conds: ["Tag is billing", "Amount mentioned > $500"],
    acts: ["Escalate to billing team", "Notify #billing-alerts"],
    enabled: true,
    runs: 38,
    last: "2h ago",
    log: [
      { time: "09:12", text: "TKT-1042 · escalated to billing, Slack notified", ok: true },
      { time: "Yesterday", text: "TKT-1031 · escalated to billing", ok: true },
      { time: "Jun 10", text: "TKT-1024 · condition not met (no amount found)", ok: false },
    ],
  },
  {
    id: "a2",
    name: "Auto-tag login issues",
    trigger: "Keyword detected: “login”, “password”, “2FA”",
    conds: ["Any channel"],
    acts: ["Add tag: login", "Suggest doc: Getting started"],
    enabled: true,
    runs: 214,
    last: "26m ago",
    log: [
      { time: "09:46", text: "TKT-1051 · tagged login", ok: true },
      { time: "09:02", text: "TKT-1049 · tagged login", ok: true },
      { time: "08:31", text: "TKT-1047 · tagged login", ok: true },
    ],
  },
  {
    id: "a3",
    name: "VIP open-ticket alert",
    trigger: "New ticket created",
    conds: ["Customer plan is Scale", "Priority ≥ high"],
    acts: ["Notify #vip-support", "Assign to senior agent"],
    enabled: true,
    runs: 12,
    last: "1d ago",
    log: [{ time: "Yesterday", text: "TKT-1033 · Priya Raman (Arcadia) · #vip-support notified", ok: true }],
  },
  {
    id: "a4",
    name: "Low-confidence safety net",
    trigger: "AI confidence < 65%",
    conds: [],
    acts: ["Hold draft for review", "Add tag: needs-review"],
    enabled: true,
    runs: 31,
    last: "16m ago",
    log: [
      { time: "09:28", text: "TKT-1038 · draft held at 58% confidence", ok: true },
      { time: "Yesterday", text: "TKT-1029 · released (confidence 96%)", ok: true },
    ],
  },
];

/** Builder chip options (WHEN / IF / THEN). */
export const builderTriggers = [
  "New ticket created",
  "No reply after 30 min",
  "AI confidence < 65%",
  "Keyword detected: “refund”",
];
export const builderConditions = [
  "Channel is email",
  "Tag is billing",
  "Customer plan is Enterprise",
  "Priority is urgent",
];
export const builderActions = [
  "Escalate to engineering",
  "Add tag: follow-up",
  "Notify #support-oncall in Slack",
  "Assign to senior agent",
];

export const analyticsData: Record<AnalyticsRangeKey, AnalyticsRange> = {
  "7d": {
    l0: "Jun 6",
    l1: "Jun 12",
    metrics: [
      ["Tickets", "164", "+12%", "#3DD68C"],
      ["Median first response", "4m 12s", "−38s", "#3DD68C"],
      ["AI acceptance", "87%", "+2.4 pts", "#3DD68C"],
      ["SLA breaches", "3", "−2 vs last week", "#3DD68C"],
    ],
    vol: [[18, 9], [22, 10], [16, 8], [25, 11], [21, 9], [24, 10], [28, 11]],
    frt: [6.8, 5.9, 6.2, 5.1, 4.6, 4.9, 4.2],
    dist: [4, 11, 32, 58, 109],
    tags: [["billing", 54], ["bug", 38], ["how-to", 31], ["login", 22], ["feature-request", 14], ["enterprise", 5]],
    docs: [["Getting started.md", 208], ["Billing & Plans.md", 132], ["Refund policy.pdf", 97], ["Bug response playbook.md", 55], ["Stripe sync runbook.md", 41]],
    lead: [["Maya", 61, "91%", "3m 48s"], ["Eshan", 54, "86%", "4m 05s"], ["Leo", 49, "84%", "4m 41s"]],
  },
  "14d": {
    l0: "May 30",
    l1: "Jun 12",
    metrics: [
      ["Tickets", "318", "+9%", "#3DD68C"],
      ["Median first response", "4m 31s", "−1m 02s", "#3DD68C"],
      ["AI acceptance", "85%", "+4.1 pts", "#3DD68C"],
      ["SLA breaches", "8", "−3", "#3DD68C"],
    ],
    vol: [[18, 9], [22, 10], [16, 8], [25, 11], [21, 9], [12, 6], [10, 5], [24, 10], [28, 11], [23, 9], [31, 12], [26, 10], [29, 11], [34, 12]],
    frt: [7.9, 7.2, 7.6, 6.8, 6.1, 6.5, 5.8, 6.8, 5.9, 6.2, 5.1, 4.6, 4.9, 4.2],
    dist: [9, 24, 61, 118, 204],
    tags: [["billing", 96], ["bug", 71], ["how-to", 64], ["login", 41], ["feature-request", 28], ["enterprise", 11]],
    docs: [["Getting started.md", 391], ["Billing & Plans.md", 246], ["Refund policy.pdf", 173], ["Bug response playbook.md", 102], ["Stripe sync runbook.md", 74]],
    lead: [["Maya", 118, "89%", "4m 02s"], ["Eshan", 103, "85%", "4m 19s"], ["Leo", 94, "83%", "4m 56s"]],
  },
  "30d": {
    l0: "May 13",
    l1: "Jun 12",
    metrics: [
      ["Tickets", "702", "+18%", "#3DD68C"],
      ["Median first response", "5m 04s", "−2m 11s", "#3DD68C"],
      ["AI acceptance", "82%", "+7.6 pts", "#3DD68C"],
      ["SLA breaches", "21", "+2", "#F36C6C"],
    ],
    vol: [[14, 8], [17, 9], [15, 8], [19, 10], [16, 8], [21, 10], [18, 9], [22, 10], [16, 8], [25, 11], [21, 9], [24, 10], [28, 11], [31, 12], [34, 12]],
    frt: [9.4, 8.8, 9.1, 8.2, 7.6, 8.0, 7.1, 7.5, 6.8, 6.1, 5.8, 5.1, 4.9, 4.6, 4.2],
    dist: [22, 58, 134, 247, 411],
    tags: [["billing", 203], ["bug", 156], ["how-to", 141], ["login", 88], ["feature-request", 64], ["enterprise", 23]],
    docs: [["Getting started.md", 812], ["Billing & Plans.md", 519], ["Refund policy.pdf", 387], ["Bug response playbook.md", 218], ["Stripe sync runbook.md", 159]],
    lead: [["Maya", 251, "86%", "4m 38s"], ["Eshan", 226, "83%", "5m 01s"], ["Leo", 204, "81%", "5m 22s"]],
  },
};

/** Initial connected state from the prototype's `intgConn`. */
export const seedIntegrations: Integration[] = [
  { key: "webchat", name: "Website Chat", glyph: "</>", fg: "#9DB7FF", desc: "Embeddable widget for your site", perms: "Read & write conversations", last: "live now", connected: true, configurable: true },
  { key: "gmail", name: "Gmail", glyph: "M", fg: "#F8A0A0", desc: "Two-way email sync", perms: "Read & send mail", last: "4m ago", connected: true, configurable: true },
  { key: "slack", name: "Slack", glyph: "#", fg: "#C4B0F8", desc: "Channels as a support source", perms: "Read & post in 4 channels", last: "just now", connected: true, configurable: true },
  { key: "twilio", name: "Twilio SMS", glyph: "S", fg: "#F5B74E", desc: "Text-message support", perms: "", last: "", connected: false, configurable: false },
  { key: "notion", name: "Notion", glyph: "N", fg: "#E6EAF2", desc: "Knowledge-base source", perms: "Read 5 docs", last: "2h ago", connected: true, configurable: false },
  { key: "gdocs", name: "Google Docs", glyph: "G", fg: "#9DB7FF", desc: "Knowledge-base source", perms: "", last: "", connected: false, configurable: false },
  { key: "github", name: "GitHub", glyph: "GH", fg: "#E6EAF2", desc: "Link issues to tickets", perms: "Read & write issues", last: "1h ago", connected: true, configurable: false },
  { key: "stripe", name: "Stripe", glyph: "$", fg: "#C4B0F8", desc: "Plan & payment context", perms: "", last: "", connected: false, configurable: false },
  { key: "linear", name: "Linear", glyph: "L", fg: "#9DB7FF", desc: "Escalate bugs to engineering", perms: "Create & link issues", last: "30m ago", connected: true, configurable: false },
  { key: "zapier", name: "Zapier", glyph: "Z", fg: "#F5B74E", desc: "Automate with 6,000+ apps", perms: "", last: "", connected: false, configurable: false },
];

export const seedMembers: Member[] = [
  { name: "Eshan Patel", email: "eshan@acme.io", role: "Admin", init: "E", status: "Active" },
  { name: "Maya Flores", email: "maya@acme.io", role: "Agent", init: "M", status: "Active" },
  { name: "Leo Tanaka", email: "leo@acme.io", role: "Agent", init: "L", status: "Active" },
];

export const seedAudit: AuditEvent[] = [
  { time: "Today 09:42", user: "Maya", action: "Approved AI draft on TKT-1031", type: "AI" },
  { time: "Today 09:12", user: "System", action: "Automation “Escalate billing tickets over $500” executed on TKT-1042", type: "AI" },
  { time: "Today 08:55", user: "Eshan", action: "Connected GitHub integration", type: "Integrations" },
  { time: "Yesterday 17:30", user: "Leo", action: "Accepted workspace invite", type: "Team" },
  { time: "Yesterday 16:08", user: "Eshan", action: "Changed Maya’s role from Viewer to Agent", type: "Team" },
  { time: "Yesterday 11:21", user: "System", action: "Document “SSO configuration guide.pdf” failed to index", type: "Integrations" },
  { time: "Jun 10 14:02", user: "Eshan", action: "Enabled two-factor enforcement for all members", type: "Security" },
  { time: "Jun 10 09:47", user: "Maya", action: "Deleted document “Old pricing FAQ.md”", type: "Security" },
  { time: "Jun 9 15:12", user: "System", action: "API key “prod-server” rotated", type: "Security" },
];

export const seedNotifications: Notification[] = [
  { c: "#F36C6C", text: "SLA risk: first response due in 18m on TKT-1042", time: "2m ago" },
  { c: "#F5B74E", text: "Low-confidence draft (58%) flagged on TKT-1038", time: "16m ago" },
  { c: "#F36C6C", text: "Gmail sync delayed — last successful sync 4m ago", time: "34m ago" },
  { c: "#4D7CFE", text: "Leo accepted your invite and joined Acme Inc", time: "1h ago" },
  { c: "#8B5CF6", text: "Automation “VIP open-ticket alert” ran 3 times today", time: "3h ago" },
];

export const seedCopilotSettings: CopilotSettings = {
  tone: "Friendly",
  risk: "balanced",
  threshold: 70,
  approvals: { low: true, refund: true, all: false },
  neverSay: ["Legal advice or liability admissions", "Competitor comparisons", "Refund promises over $1,000"],
};

export const playgroundSamples = [
  "How do I get a refund for a duplicate charge?",
  "How do I invite teammates?",
  "Can you help me set up SAML SSO?",
];

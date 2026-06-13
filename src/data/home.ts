import { agents } from "@/data/workspace";

/** Home dashboard presentation fixtures — ported from the prototype renderVals. */

export interface HomeMetric {
  label: string;
  value: string;
  delta: string;
  valueColor: string;
  deltaColor: string;
  bars: { ratio: number; color: string }[];
}

const bars = (vals: number[], color: string) => vals.map((ratio) => ({ ratio, color }));

export const homeMetrics: HomeMetric[] = [
  {
    label: "Open tickets",
    value: "24",
    delta: "+3 today",
    valueColor: "#E6EAF2",
    deltaColor: "#F5B74E",
    bars: bars([0.3, 0.4, 0.35, 0.5, 0.45, 0.6, 0.55, 0.7, 0.6, 0.8, 0.75, 1], "rgba(77,124,254,0.55)"),
  },
  {
    label: "AI draft acceptance",
    value: "87%",
    delta: "+2.4 pts",
    valueColor: "#3DD68C",
    deltaColor: "#3DD68C",
    bars: bars([0.5, 0.55, 0.6, 0.58, 0.7, 0.68, 0.75, 0.8, 0.78, 0.85, 0.9, 1], "rgba(61,214,140,0.5)"),
  },
  {
    label: "Median first response",
    value: "4m 12s",
    delta: "−38s",
    valueColor: "#E6EAF2",
    deltaColor: "#3DD68C",
    bars: bars([1, 0.9, 0.85, 0.8, 0.85, 0.7, 0.65, 0.6, 0.62, 0.5, 0.45, 0.4], "rgba(255,255,255,0.22)"),
  },
  {
    label: "SLA risk",
    value: "3",
    delta: "2 urgent",
    valueColor: "#F36C6C",
    deltaColor: "#F36C6C",
    bars: bars([0.2, 0.3, 0.2, 0.4, 0.3, 0.5, 0.4, 0.3, 0.5, 0.6, 0.5, 0.8], "rgba(243,108,108,0.5)"),
  },
  {
    label: "Resolved this week",
    value: "142",
    delta: "+18%",
    valueColor: "#E6EAF2",
    deltaColor: "#3DD68C",
    bars: bars([0.4, 0.5, 0.45, 0.6, 0.55, 0.65, 0.7, 0.75, 0.7, 0.85, 0.9, 1], "rgba(77,124,254,0.55)"),
  },
];

/** [aiDrafted, humanOnly] per day, last 14 days. */
export const homeVolume: [number, number][] = [
  [18, 9], [22, 10], [16, 8], [25, 11], [21, 9], [12, 6], [10, 5],
  [24, 10], [28, 11], [23, 9], [31, 12], [26, 10], [29, 11], [34, 12],
];

export interface AttentionItem {
  id: string;
  subject: string;
  who: string;
  chip: string;
  chipFg: string;
  chipBg: string;
  dot: string;
  time: string;
}

export const homeAttention: AttentionItem[] = [
  { id: "TKT-1042", subject: "Cannot access upgraded plan after payment", who: "Ava Chen · Northwind", chip: "SLA 18m", chipFg: "#F36C6C", chipBg: "rgba(243,108,108,0.1)", dot: "#F36C6C", time: "4m" },
  { id: "TKT-1038", subject: "Slack notification integration is broken", who: "Marcus Lee · Lumen Labs", chip: "AI 58%", chipFg: "#F5B74E", chipBg: "rgba(245,183,78,0.1)", dot: "#F5B74E", time: "16m" },
  { id: "TKT-1024", subject: "SAML SSO setup with Okta", who: "Daniel Park · Helio Systems", chip: "No AI draft", chipFg: "#8A93A6", chipBg: "rgba(255,255,255,0.06)", dot: "#8A93A6", time: "1d" },
];

export interface ActivityItem {
  init: string;
  bg: string;
  fg: string;
  text: string;
  time: string;
}

export const homeActivity: ActivityItem[] = [
  { init: "M", bg: agents.Maya.bg, fg: agents.Maya.fg, text: "Maya approved the AI draft on TKT-1031", time: "2m ago" },
  { init: "⚡", bg: "rgba(139,92,246,0.15)", fg: "#C4B0F8", text: "Automation “Plan & payment issues” tagged TKT-1042", time: "11m ago" },
  { init: "AI", bg: "rgba(77,124,254,0.15)", fg: "#9DB7FF", text: "Indexed “Known issues.md” — 9 chunks", time: "30m ago" },
  { init: "L", bg: agents.Leo.bg, fg: agents.Leo.fg, text: "Leo connected the GitHub integration", time: "1h ago" },
  { init: "E", bg: agents.Eshan.bg, fg: agents.Eshan.fg, text: "Eshan escalated TKT-1019 to engineering", time: "3h ago" },
];

export const homeChannels = [
  { label: "Website chat", channel: "web" as const, meta: "1.2s median · 99.9%", dot: "#3DD68C" },
  { label: "Email (Gmail)", channel: "email" as const, meta: "sync delayed 4m", dot: "#F5B74E" },
  { label: "Slack", channel: "slack" as const, meta: "2 workspaces · healthy", dot: "#3DD68C" },
];

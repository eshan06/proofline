import type { BoardStage, Priority, TicketStatus } from "@/lib/schemas";

/** Priority → [label, color]. Squares (2px radius), not dots. */
export const priorityMap: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#F36C6C" },
  high: { label: "High", color: "#F5B74E" },
  medium: { label: "Medium", color: "#4D7CFE" },
  low: { label: "Low", color: "#8A93A6" },
};

export const priorityOrder: Priority[] = ["low", "medium", "high", "urgent"];

/** Conversation-header status pill: label, fg, tinted bg, tinted border. */
export const statusMap: Record<
  TicketStatus,
  { label: string; fg: string; bg: string; bd: string }
> = {
  open: { label: "Open", fg: "#4D7CFE", bg: "rgba(77,124,254,0.1)", bd: "rgba(77,124,254,0.3)" },
  waiting: { label: "Waiting on customer", fg: "#F5B74E", bg: "rgba(245,183,78,0.08)", bd: "rgba(245,183,78,0.3)" },
  escalated: { label: "Escalated", fg: "#F36C6C", bg: "rgba(243,108,108,0.08)", bd: "rgba(243,108,108,0.3)" },
  closed: { label: "Closed", fg: "#3DD68C", bg: "rgba(61,214,140,0.08)", bd: "rgba(61,214,140,0.3)" },
};

/** Board columns, in order. */
export const stageMap: Record<BoardStage, { label: string; color: string }> = {
  new: { label: "New", color: "#4D7CFE" },
  waiting: { label: "Waiting", color: "#F5B74E" },
  inprogress: { label: "In progress", color: "#8B5CF6" },
  escalated: { label: "Escalated", color: "#F36C6C" },
  resolved: { label: "Resolved", color: "#3DD68C" },
};

export const stageOrder: BoardStage[] = ["new", "waiting", "inprogress", "escalated", "resolved"];

export const channelLabel: Record<"web" | "email" | "slack", string> = {
  web: "web",
  email: "email",
  slack: "slack",
};

import type { Ticket } from "@/lib/schemas";
import { uid } from "@/lib/utils";
import type { InboundSlackMessage } from "@/server/slack/slack";

/**
 * Construct a ticket from an inbound Slack message — the Slack analogue of
 * buildWebTicket / buildEmailTicket. Shared by both repository backends so the
 * in-memory and Postgres paths create identical tickets. The (channel, threadTs)
 * that a reply posts back to is tracked separately in the slack_threads map;
 * the draft stays null until an agent runs the copilot.
 */
export function buildSlackTicket(rawId: string, msg: InboundSlackMessage): Ticket {
  const clean = msg.text.replace(/\s+/g, " ").trim();
  const name = msg.userName?.trim() || msg.userId;
  const initials =
    (name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("") || "SL").toUpperCase();
  return {
    id: rawId,
    customer: { name, company: "Slack", initials, hue: 280 },
    channel: "slack",
    subject: (clean.slice(0, 120) || "New Slack message"),
    preview: clean.slice(0, 140),
    priority: "medium",
    tags: ["slack"],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 30,
    slaTotal: 30,
    unread: true,
    time: "just now",
    conf: null,
    archived: false,
    messages: [{ id: uid("m"), kind: "customer", author: name, time: "just now", text: msg.text }],
    draft: null,
  };
}

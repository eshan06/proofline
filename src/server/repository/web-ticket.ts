import type { Ticket } from "@/lib/schemas";
import { uid, secureToken } from "@/lib/utils";

/** A human-facing ticket id for an inbound web-chat conversation. */
export function newTicketRawId(): string {
  return `TKT-${secureToken(4)}`;
}

/**
 * Construct a fresh ticket for an inbound website-chat conversation. Shared by
 * both repository implementations so the in-memory and Postgres backends create
 * identical tickets. The visitor's first message becomes the opening customer
 * message; the draft is null until an agent runs the copilot (same grounding /
 * refusal path as every other ticket).
 */
export function buildWebTicket(
  rawId: string,
  visitor: { name?: string; email?: string },
  firstText: string,
): Ticket {
  const clean = firstText.replace(/\s+/g, " ").trim();
  const name = visitor.name?.trim() || "Website visitor";
  const initials =
    (name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("") || "WV").toUpperCase();
  return {
    id: rawId,
    customer: { name, company: visitor.email?.trim() || "Website visitor", initials, hue: 210 },
    channel: "web",
    subject: clean.slice(0, 80) || "New website chat",
    preview: clean.slice(0, 140),
    priority: "medium",
    tags: ["web-chat"],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 30,
    slaTotal: 30,
    unread: true,
    time: "just now",
    conf: null,
    archived: false,
    messages: [{ id: uid("m"), kind: "customer", author: name, time: "just now", text: firstText }],
    draft: null,
  };
}

/** A message in the visitor-facing transcript the widget polls for. */
export interface WidgetTranscriptMessage {
  role: "visitor" | "agent";
  text: string;
  time: string;
}

/** Project a ticket's messages down to the visitor-visible transcript. */
export function ticketToTranscript(messages: Ticket["messages"]): WidgetTranscriptMessage[] {
  return messages
    .filter((m) => m.kind === "customer" || m.kind === "agent")
    .map((m) => ({ role: m.kind === "agent" ? "agent" : "visitor", text: m.text, time: m.time }));
}

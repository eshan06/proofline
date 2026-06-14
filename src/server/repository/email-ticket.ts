import type { Ticket } from "@/lib/schemas";
import { uid } from "@/lib/utils";
import type { InboundEmail } from "@/server/email/gmail";

/**
 * Construct a ticket from an inbound email, the email-channel analogue of
 * buildWebTicket. Shared by both repository backends so the in-memory and
 * Postgres paths create identical tickets. The sender's address is stashed in
 * customer.company (the same convention buildWebTicket uses for web visitors),
 * and is what an agent reply is sent back to. The draft stays null until an
 * agent runs the copilot — same grounding / refusal path as every channel.
 */
export function buildEmailTicket(rawId: string, email: InboundEmail): Ticket {
  const clean = email.body.replace(/\s+/g, " ").trim();
  const name = email.fromName?.trim() || email.from;
  const initials =
    (name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("") || "EM").toUpperCase();
  const subject = (email.subject?.trim() || clean.slice(0, 80) || "New email").slice(0, 120);
  return {
    id: rawId,
    customer: { name, company: email.from, initials, hue: 24 },
    channel: "email",
    subject,
    preview: clean.slice(0, 140),
    priority: "medium",
    tags: ["email"],
    status: "open",
    stage: "new",
    assignee: null,
    slaMins: 30,
    slaTotal: 30,
    unread: true,
    time: "just now",
    conf: null,
    archived: false,
    messages: [{ id: uid("m"), kind: "customer", author: name, time: "just now", text: email.body }],
    draft: null,
  };
}

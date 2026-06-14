import type { Ticket } from "@/lib/schemas";

export const INBOX_FILTERS = [
  "All",
  "Unassigned",
  "Mine",
  "SLA Risk",
  "AI Drafted",
  "Low Confidence",
] as const;

export type InboxFilter = (typeof INBOX_FILTERS)[number];

export function isInboxFilter(value: string | null | undefined): value is InboxFilter {
  return !!value && (INBOX_FILTERS as readonly string[]).includes(value);
}

/** A ticket whose first-response SLA is at risk (due within 45m, not yet met). */
export const isSlaRisk = (t: Ticket) => t.slaMins > 0 && t.slaMins <= 45;

/** The live (non-archived) tickets the inbox shows; archived live in Tickets. */
export function inboxTickets(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => !t.archived);
}

export function filterCounts(tickets: Ticket[]): Record<InboxFilter, number> {
  const live = inboxTickets(tickets);
  return {
    All: live.length,
    Unassigned: live.filter((t) => !t.assignee).length,
    Mine: live.filter((t) => t.assignee === "Eshan").length,
    "SLA Risk": live.filter(isSlaRisk).length,
    "AI Drafted": live.filter((t) => t.draft).length,
    "Low Confidence": live.filter((t) => t.conf != null && t.conf < 0.7).length,
  };
}

/** Apply the active filter chip + free-text search. */
export function filterTickets(
  tickets: Ticket[],
  filter: InboxFilter,
  search: string,
): Ticket[] {
  const q = search.trim().toLowerCase();
  return inboxTickets(tickets).filter((t) => {
    if (filter === "Unassigned" && t.assignee) return false;
    if (filter === "Mine" && t.assignee !== "Eshan") return false;
    if (filter === "SLA Risk" && !isSlaRisk(t)) return false;
    if (filter === "AI Drafted" && !t.draft) return false;
    if (filter === "Low Confidence" && !(t.conf != null && t.conf < 0.7)) return false;
    if (q) {
      const haystack = `${t.subject} ${t.customer.name} ${t.preview} ${t.id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

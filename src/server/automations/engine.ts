import type { Automation, Ticket } from "@/lib/schemas";

/**
 * Automations engine — evaluates the rule language the builder produces.
 *
 * Rules are stored in their human-readable chip form ("AI confidence < 65%",
 * "Tag is billing", …) because that is the product's source of truth: what you
 * read in the rule list is exactly what executes. The parser below understands
 * every chip the builder can emit plus the seeded rules.
 */

export interface TicketEvent {
  kind: "ticket.created" | "draft.generated" | "reply.sent" | "no_reply.timeout";
  ticket: Ticket;
  /** Confidence of the draft involved in the event, when applicable. */
  confidence?: number | null;
  /** Plan of the ticket's customer (joined by the caller). */
  customerPlan?: string;
}

/* ------------------------------------------------------------------ */
/*  Triggers                                                           */
/* ------------------------------------------------------------------ */

export function matchesTrigger(trigger: string, event: TicketEvent): boolean {
  const t = trigger.toLowerCase();

  if (t.startsWith("new ticket")) return event.kind === "ticket.created";
  if (t.startsWith("no reply")) return event.kind === "no_reply.timeout";

  const confMatch = t.match(/ai confidence\s*<\s*(\d+)/);
  if (confMatch) {
    const limit = Number(confMatch[1]) / 100;
    return (
      event.kind === "draft.generated" &&
      event.confidence != null &&
      event.confidence < limit
    );
  }

  const kwMatch = trigger.match(/Keyword detected:\s*(.+)/i);
  if (kwMatch && kwMatch[1]) {
    const keywords = kwMatch[1]
      .split(",")
      .map((k) => k.replace(/[“”"]/g, "").trim().toLowerCase())
      .filter(Boolean);
    const haystack = `${event.ticket.subject} ${event.ticket.preview} ${event.ticket.messages
      .map((m) => m.text)
      .join(" ")}`.toLowerCase();
    return keywords.some((k) => haystack.includes(k));
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Conditions                                                         */
/* ------------------------------------------------------------------ */

const PRIORITY_ORDER = ["low", "medium", "high", "urgent"] as const;

export function matchesCondition(cond: string, event: TicketEvent): boolean {
  const c = cond.toLowerCase();
  const { ticket } = event;

  if (c === "any channel") return true;

  const channel = c.match(/channel is (\w+)/);
  if (channel) return ticket.channel === channel[1];

  const tag = c.match(/tag is ([\w-]+)/);
  if (tag && tag[1]) return ticket.tags.includes(tag[1]);

  const plan = c.match(/customer plan is (\w+)/);
  if (plan && plan[1]) {
    return (event.customerPlan ?? "").toLowerCase().includes(plan[1].toLowerCase());
  }

  const prGte = cond.match(/Priority ≥ (\w+)/i);
  if (prGte && prGte[1]) {
    const min = PRIORITY_ORDER.indexOf(prGte[1].toLowerCase() as (typeof PRIORITY_ORDER)[number]);
    return PRIORITY_ORDER.indexOf(ticket.priority) >= min;
  }

  const prIs = c.match(/priority is (\w+)/);
  if (prIs) return ticket.priority === prIs[1];

  const amount = c.match(/amount mentioned > \$([\d,]+)/);
  if (amount && amount[1]) {
    const limit = Number(amount[1].replace(/,/g, ""));
    const amounts = [...`${ticket.subject} ${ticket.messages.map((m) => m.text).join(" ")}`.matchAll(/\$([\d,]+(?:\.\d+)?)/g)]
      .map((m) => Number((m[1] ?? "0").replace(/,/g, "")));
    return amounts.some((a) => a > limit);
  }

  // Unknown condition: fail closed — an automation must never fire on a
  // condition it cannot evaluate.
  return false;
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export interface AppliedAction {
  description: string;
  mutate?: (ticket: Ticket) => void;
}

export function planAction(act: string): AppliedAction {
  const tag = act.match(/Add tag: ([\w-]+)/i);
  if (tag) {
    const value = tag[1] as string;
    return {
      description: `tagged ${value}`,
      mutate: (t) => {
        if (!t.tags.includes(value)) t.tags.push(value);
      },
    };
  }
  if (/^escalate/i.test(act)) {
    return {
      description: act.toLowerCase(),
      mutate: (t) => {
        t.status = "escalated";
        t.stage = "escalated";
      },
    };
  }
  if (/^assign to senior agent/i.test(act)) {
    return { description: "assigned to senior agent", mutate: (t) => { t.assignee = "Maya"; } };
  }
  if (/^hold draft/i.test(act)) {
    return { description: "draft held for review" };
  }
  // Notifications and doc suggestions have no ticket mutation in v1.
  return { description: act.toLowerCase() };
}

/* ------------------------------------------------------------------ */
/*  Evaluation                                                         */
/* ------------------------------------------------------------------ */

export interface AutomationResult {
  automation: Automation;
  fired: boolean;
  /** Human log line, prototype-style: "TKT-1038 · draft held at 58% confidence". */
  logLine?: string;
}

export function evaluate(automation: Automation, event: TicketEvent): AutomationResult {
  if (!automation.enabled) return { automation, fired: false };
  if (!matchesTrigger(automation.trigger, event)) return { automation, fired: false };
  const failed = automation.conds.find((c) => !matchesCondition(c, event));
  if (failed) {
    return { automation, fired: false, logLine: `${event.ticket.id} · condition not met (${failed})` };
  }

  const applied = automation.acts.map((a) => planAction(a));
  for (const action of applied) action.mutate?.(event.ticket);

  const confidencePart =
    event.confidence != null ? ` at ${Math.round(event.confidence * 100)}% confidence` : "";
  const logLine =
    automation.id === "a4" || /confidence/i.test(automation.trigger)
      ? `${event.ticket.id} · draft held${confidencePart}`
      : `${event.ticket.id} · ${applied.map((a) => a.description).join(", ")}`;

  return { automation, fired: true, logLine };
}

/** Run an event through every automation, in order. */
export function runAutomations(automations: Automation[], event: TicketEvent): AutomationResult[] {
  return automations.map((a) => evaluate(a, event));
}

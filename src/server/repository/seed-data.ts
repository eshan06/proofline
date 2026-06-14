import type {
  Automation,
  AuditEvent,
  CopilotSettings,
  Customer,
  Integration,
  KbDoc,
  Member,
  Notification,
  Ticket,
} from "@/lib/schemas";
import { seedTickets } from "@/data/tickets";
import {
  seedAudit,
  seedAutomations,
  seedCopilotSettings,
  seedCustomers,
  seedIntegrations,
  seedKbDocs,
  seedMembers,
  seedNotifications,
} from "@/data/workspace";
import { secureToken } from "@/lib/utils";

export interface WidgetConfig {
  siteKey: string;
  enabled: boolean;
  allowedOrigins: string[];
}

export interface SubscriptionData {
  plan: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  seats: number;
  currentPeriodEnd: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/** A fresh workspace's full dataset, deep-cloned from the fixtures. */
export interface WorkspaceData {
  name: string;
  widget: WidgetConfig;
  subscription: SubscriptionData;
  tickets: Ticket[];
  customers: Customer[];
  kbDocs: KbDoc[];
  automations: Automation[];
  integrations: Integration[];
  members: Member[];
  audit: AuditEvent[];
  notifications: Notification[];
  copilot: CopilotSettings;
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * A fresh workspace's dataset. `empty` (real signups) yields a clean workspace —
 * no demo tickets/customers/KB/automations/audit — so a new paying user doesn't
 * land in a fake "Acme Inc" full of someone else's data. The channel catalog is
 * present but disconnected, copilot has sane defaults, and a single welcome
 * notification greets them. The full fixture seed is reserved for the demo
 * sandbox (and the showcase "failed SSO" cross-page thread).
 */
export function seedWorkspaceData(name = "Acme Inc", opts: { empty?: boolean } = {}): WorkspaceData {
  const base = {
    name,
    widget: { siteKey: secureToken(16), enabled: true, allowedOrigins: [] },
    subscription: { plan: "Growth", status: "active", seats: 3, currentPeriodEnd: "", stripeCustomerId: null, stripeSubscriptionId: null } as SubscriptionData,
    copilot: clone(seedCopilotSettings),
  };
  if (opts.empty) {
    return {
      ...base,
      tickets: [],
      customers: [],
      kbDocs: [],
      automations: [],
      // Channels available to connect, but none connected yet.
      integrations: clone(seedIntegrations).map((i) => ({ ...i, connected: false, last: "" })),
      members: [],
      audit: [],
      notifications: [{ c: "#5B8DEF", text: "Welcome to Proofline — connect a channel and upload docs to get started.", time: "just now" }],
    };
  }
  return {
    ...base,
    ...clone({
      tickets: seedTickets,
      customers: seedCustomers,
      kbDocs: seedKbDocs,
      automations: seedAutomations,
      integrations: seedIntegrations,
      members: seedMembers,
      audit: seedAudit,
      notifications: seedNotifications,
    }),
  };
}

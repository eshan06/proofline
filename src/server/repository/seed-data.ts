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

/** A fresh workspace's full dataset, deep-cloned from the fixtures. */
export interface WorkspaceData {
  name: string;
  widget: WidgetConfig;
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

export function seedWorkspaceData(name = "Acme Inc"): WorkspaceData {
  return {
    name,
    // Fresh per workspace, not cloned from a shared fixture.
    widget: { siteKey: secureToken(16), enabled: true, allowedOrigins: [] },
    ...clone({
      tickets: seedTickets,
      customers: seedCustomers,
      kbDocs: seedKbDocs,
      automations: seedAutomations,
      integrations: seedIntegrations,
      members: seedMembers,
      audit: seedAudit,
      notifications: seedNotifications,
      copilot: seedCopilotSettings,
    }),
  };
}

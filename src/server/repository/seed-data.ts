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

/** A fresh workspace's full dataset, deep-cloned from the fixtures. */
export interface WorkspaceData {
  name: string;
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
  return clone({
    name,
    tickets: seedTickets,
    customers: seedCustomers,
    kbDocs: seedKbDocs,
    automations: seedAutomations,
    integrations: seedIntegrations,
    members: seedMembers,
    audit: seedAudit,
    notifications: seedNotifications,
    copilot: seedCopilotSettings,
  });
}

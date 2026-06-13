import type {
  AIDraft,
  Automation,
  AutomationRun,
  KbDoc,
  Member,
  Message,
  Ticket,
  TicketPatch,
  Workspace,
  DemoStep,
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
import { uid } from "@/lib/utils";

/**
 * Per-session in-memory workspace store.
 *
 * Deliberate v1 trade-off (see ARCHITECTURE.md §6): the whole surface behaves
 * like a real backend — sessions are isolated, mutations persist for the
 * session — without a database for what is fixture-scale data. Every accessor
 * below is the seam where Postgres/Drizzle slots in later; route handlers
 * never touch the Map directly.
 *
 * Demo sandbox sessions carry a TTL and an AI-call budget (rate limit).
 */

export interface SessionRecord {
  id: string;
  type: "regular" | "demo";
  createdAt: number;
  lastSeen: number;
  /** AI calls consumed (regenerate / tone / playground) — demo sessions are capped. */
  aiCalls: number;
  workspace: MutableWorkspace;
  demoSteps: Record<DemoStep, boolean>;
}

export interface MutableWorkspace {
  name: string;
  tickets: Ticket[];
  kbDocs: KbDoc[];
  automations: Automation[];
  integrations: typeof seedIntegrations;
  members: Member[];
  copilot: typeof seedCopilotSettings;
}

const DEMO_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REGULAR_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const DEMO_AI_CALL_LIMIT = 25;

/** Survive Next.js dev-server module reloads. */
const globalStore = globalThis as unknown as {
  __prooflineSessions?: Map<string, SessionRecord>;
};

function sessions(): Map<string, SessionRecord> {
  if (!globalStore.__prooflineSessions) {
    globalStore.__prooflineSessions = new Map();
  }
  return globalStore.__prooflineSessions;
}

const clone = <T>(v: T): T => structuredClone(v);

function seedWorkspace(): MutableWorkspace {
  return clone({
    name: "Acme Inc",
    tickets: seedTickets,
    kbDocs: seedKbDocs,
    automations: seedAutomations,
    integrations: seedIntegrations,
    members: seedMembers,
    copilot: seedCopilotSettings,
  });
}

export function createSession(type: "regular" | "demo"): SessionRecord {
  const record: SessionRecord = {
    id: `${type === "demo" ? "demo" : "ws"}_${uid("s")}`,
    type,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    aiCalls: 0,
    workspace: seedWorkspace(),
    demoSteps: { draft: false, send: false, upload: false, connect: false, palette: false },
  };
  sweep();
  sessions().set(record.id, record);
  return record;
}

/**
 * Fetch a session. If the cookie points at a session the store no longer has
 * (server restart), transparently re-seed under the same id so users never see
 * a hard failure for what is recoverable state.
 */
export function getSession(id: string | undefined): SessionRecord | null {
  if (!id) return null;
  const map = sessions();
  let record = map.get(id);
  if (!record) {
    if (!/^(ws|demo)_/.test(id)) return null;
    record = {
      id,
      type: id.startsWith("demo_") ? "demo" : "regular",
      createdAt: Date.now(),
      lastSeen: Date.now(),
      aiCalls: 0,
      workspace: seedWorkspace(),
      demoSteps: { draft: false, send: false, upload: false, connect: false, palette: false },
    };
    map.set(id, record);
  }
  const ttl = record.type === "demo" ? DEMO_TTL_MS : REGULAR_TTL_MS;
  if (Date.now() - record.lastSeen > ttl) {
    map.delete(id);
    return null;
  }
  record.lastSeen = Date.now();
  return record;
}

function sweep() {
  const map = sessions();
  const now = Date.now();
  for (const [id, record] of map) {
    const ttl = record.type === "demo" ? DEMO_TTL_MS : REGULAR_TTL_MS;
    if (now - record.lastSeen > ttl) map.delete(id);
  }
}

/* ------------------------------------------------------------------ */
/*  Workspace payload                                                  */
/* ------------------------------------------------------------------ */

export function workspacePayload(s: SessionRecord): Workspace {
  return {
    name: s.workspace.name,
    tickets: s.workspace.tickets,
    customers: seedCustomers,
    kbDocs: s.workspace.kbDocs,
    automations: s.workspace.automations,
    integrations: s.workspace.integrations,
    members: s.workspace.members,
    audit: seedAudit,
    notifications: seedNotifications,
    copilot: s.workspace.copilot,
    demo: { active: s.type === "demo", steps: s.demoSteps },
  };
}

/* ------------------------------------------------------------------ */
/*  Ticket operations                                                  */
/* ------------------------------------------------------------------ */

export function findTicket(s: SessionRecord, id: string): Ticket | undefined {
  return s.workspace.tickets.find((t) => t.id === id);
}

export function patchTicket(s: SessionRecord, id: string, patch: TicketPatch): Ticket {
  const t = findTicket(s, id);
  if (!t) throw new NotFoundError(`Unknown ticket ${id}`);
  if (patch.priority) t.priority = patch.priority;
  if (patch.assignee !== undefined) t.assignee = patch.assignee;
  if (patch.addTag && !t.tags.includes(patch.addTag)) t.tags.push(patch.addTag);
  if (patch.status) {
    t.status = patch.status;
    // Status flows through to the board — single source of truth per ticket.
    if (patch.status === "escalated") {
      t.stage = "escalated";
      appendMessage(t, { kind: "status", text: "Escalated to engineering by Eshan · just now" });
    } else if (patch.status === "closed") {
      t.stage = "resolved";
      appendMessage(t, { kind: "status", text: "Ticket closed by Eshan · just now" });
    } else if (patch.status === "waiting") {
      t.stage = "waiting";
    }
  }
  return t;
}

export function appendMessage(
  t: Ticket,
  msg: Omit<Message, "id" | "time"> & { time?: string },
): Message {
  const message: Message = { id: uid("m"), time: msg.time ?? "just now", ...msg };
  t.messages.push(message);
  return message;
}

export function addReply(s: SessionRecord, id: string, text: string, viaAI: boolean): Ticket {
  const t = findTicket(s, id);
  if (!t) throw new NotFoundError(`Unknown ticket ${id}`);
  appendMessage(t, { kind: "agent", author: "Eshan", text, viaAI });
  t.status = "waiting";
  t.stage = "waiting";
  t.unread = false;
  return t;
}

export function addNote(s: SessionRecord, id: string, text: string): Ticket {
  const t = findTicket(s, id);
  if (!t) throw new NotFoundError(`Unknown ticket ${id}`);
  appendMessage(t, { kind: "note", author: "Eshan", text });
  return t;
}

export function setDraft(s: SessionRecord, id: string, draft: AIDraft): Ticket {
  const t = findTicket(s, id);
  if (!t) throw new NotFoundError(`Unknown ticket ${id}`);
  t.draft = draft;
  return t;
}

/* ------------------------------------------------------------------ */
/*  Knowledge base                                                     */
/* ------------------------------------------------------------------ */

export function addKbDoc(s: SessionRecord, doc: Omit<KbDoc, "id">): KbDoc {
  const full: KbDoc = { id: uid("kb"), ...doc };
  s.workspace.kbDocs.push(full);
  return full;
}

export function updateKbDoc(s: SessionRecord, id: string, patch: Partial<KbDoc>): KbDoc {
  const doc = s.workspace.kbDocs.find((d) => d.id === id);
  if (!doc) throw new NotFoundError(`Unknown document ${id}`);
  Object.assign(doc, patch);
  return doc;
}

/* ------------------------------------------------------------------ */
/*  Automations                                                        */
/* ------------------------------------------------------------------ */

export function addAutomation(
  s: SessionRecord,
  rule: { trigger: string; conds: string[]; acts: string[] },
): Automation {
  const auto: Automation = {
    id: uid("a"),
    name: `${rule.trigger} → ${rule.acts[0] ?? ""}`,
    trigger: rule.trigger,
    conds: rule.conds,
    acts: rule.acts,
    enabled: true,
    runs: 0,
    last: "never",
    log: [],
  };
  s.workspace.automations.unshift(auto);
  return auto;
}

export function setAutomationEnabled(s: SessionRecord, id: string, enabled: boolean): Automation {
  const auto = s.workspace.automations.find((a) => a.id === id);
  if (!auto) throw new NotFoundError(`Unknown automation ${id}`);
  auto.enabled = enabled;
  return auto;
}

export function recordAutomationRun(s: SessionRecord, id: string, run: AutomationRun): void {
  const auto = s.workspace.automations.find((a) => a.id === id);
  if (!auto || !auto.enabled) return;
  auto.runs += 1;
  auto.last = "just now";
  auto.log.unshift(run);
}

/* ------------------------------------------------------------------ */
/*  Demo                                                               */
/* ------------------------------------------------------------------ */

export function completeDemoStep(s: SessionRecord, step: DemoStep): boolean {
  if (s.type !== "demo" || s.demoSteps[step]) return false;
  s.demoSteps[step] = true;
  return true;
}

/** Returns false when a demo session has exhausted its AI budget. */
export function consumeAiCall(s: SessionRecord): boolean {
  if (s.type === "demo" && s.aiCalls >= DEMO_AI_CALL_LIMIT) return false;
  s.aiCalls += 1;
  return true;
}

export class NotFoundError extends Error {}

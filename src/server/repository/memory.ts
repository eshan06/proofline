import type {
  AIDraft,
  AuditEvent,
  Automation,
  AutomationRun,
  CopilotSettings,
  DemoStep,
  Integration,
  IntegrationKey,
  KbDoc,
  Member,
  MemberRole,
  Message,
  Ticket,
  TicketPatch,
  Workspace,
} from "@/lib/schemas";
import { uid, secureToken } from "@/lib/utils";
import { seedWorkspaceData, type WorkspaceData } from "./seed-data";
import { buildWebTicket, newTicketRawId, ticketToTranscript, type WidgetTranscriptMessage } from "./web-ticket";
import {
  NotFoundError,
  type Repository,
  type SessionInfo,
  type UserRecord,
} from "./types";

const DEMO_TTL_MS = 30 * 60 * 1000;
const REGULAR_TTL_MS = 12 * 60 * 60 * 1000;
export const DEMO_AI_CALL_LIMIT = Number(process.env.DEMO_AI_CALL_LIMIT) || 25;

interface MemSession extends SessionInfo {
  lastSeen: number;
  ttl: number;
}

/**
 * In-memory repository — the default backend. Behavior is identical to the
 * original store: per-workspace data seeded from fixtures, sessions with TTL +
 * AI budget. Survives Next.js dev reloads via a global.
 */
interface WidgetConvo {
  workspaceId: string;
  ticketId: string;
  visitorName: string | null;
  visitorEmail: string | null;
}

export class MemoryRepository implements Repository {
  private sessions: Map<string, MemSession>;
  private workspaces: Map<string, WorkspaceData>;
  private users: Map<string, UserRecord>;
  private memberships: { userId: string; workspaceId: string; role: MemberRole }[];
  private widgetConvos: Map<string, WidgetConvo>;

  constructor() {
    const g = globalThis as unknown as {
      __plMem?: {
        sessions: Map<string, MemSession>;
        workspaces: Map<string, WorkspaceData>;
        users: Map<string, UserRecord>;
        memberships: { userId: string; workspaceId: string; role: MemberRole }[];
        widgetConvos: Map<string, WidgetConvo>;
      };
    };
    if (!g.__plMem) {
      g.__plMem = { sessions: new Map(), workspaces: new Map(), users: new Map(), memberships: [], widgetConvos: new Map() };
    }
    this.sessions = g.__plMem.sessions;
    this.workspaces = g.__plMem.workspaces;
    this.users = g.__plMem.users;
    this.memberships = g.__plMem.memberships;
    this.widgetConvos = g.__plMem.widgetConvos;
  }

  private ws(workspaceId: string): WorkspaceData {
    let data = this.workspaces.get(workspaceId);
    if (!data) {
      // Lazily seed any referenced workspace (keeps the cookie-reseed behavior).
      data = seedWorkspaceData();
      this.workspaces.set(workspaceId, data);
    }
    return data;
  }

  private ticket(workspaceId: string, id: string): Ticket {
    const t = this.ws(workspaceId).tickets.find((x) => x.id === id);
    if (!t) throw new NotFoundError(`Unknown ticket ${id}`);
    return t;
  }

  /* sessions ------------------------------------------------------------- */

  async createSession(input: { type: "regular" | "demo"; userId?: string | null; workspaceId: string }): Promise<SessionInfo> {
    this.sweep();
    const rec: MemSession = {
      id: `${input.type === "demo" ? "demo" : "ws"}_${secureToken(18)}`,
      type: input.type,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId,
      aiCalls: 0,
      demoSteps: { draft: false, send: false, upload: false, connect: false, palette: false },
      lastSeen: Date.now(),
      ttl: input.type === "demo" ? DEMO_TTL_MS : REGULAR_TTL_MS,
    };
    this.sessions.set(rec.id, rec);
    return this.publicSession(rec);
  }

  async getSession(id: string): Promise<SessionInfo | null> {
    let rec = this.sessions.get(id);
    if (!rec) {
      // Cookie points at a session we lost (restart) — reseed transparently.
      if (!/^(ws|demo)_/.test(id)) return null;
      const workspaceId = `ws_${uid("w")}`;
      rec = {
        id,
        type: id.startsWith("demo_") ? "demo" : "regular",
        userId: null,
        workspaceId,
        aiCalls: 0,
        demoSteps: { draft: false, send: false, upload: false, connect: false, palette: false },
        lastSeen: Date.now(),
        ttl: id.startsWith("demo_") ? DEMO_TTL_MS : REGULAR_TTL_MS,
      };
      this.sessions.set(id, rec);
    }
    if (Date.now() - rec.lastSeen > rec.ttl) {
      this.sessions.delete(id);
      return null;
    }
    rec.lastSeen = Date.now();
    return this.publicSession(rec);
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async consumeAiCall(sessionId: string): Promise<boolean> {
    const rec = this.sessions.get(sessionId);
    if (!rec) return true;
    // The in-memory repo is the dev/demo/test backend only (production always
    // has DATABASE_URL → PgRepository). Cap AI usage for EVERY session here, not
    // just demo ones: otherwise a reseeded `ws_` cookie (see getSession) would
    // be treated as a `regular` session and get unbounded, free inference.
    if (rec.aiCalls >= DEMO_AI_CALL_LIMIT) return false;
    rec.aiCalls += 1;
    return true;
  }

  async completeDemoStep(sessionId: string, step: DemoStep): Promise<boolean> {
    const rec = this.sessions.get(sessionId);
    if (!rec || rec.type !== "demo" || rec.demoSteps[step]) return false;
    rec.demoSteps[step] = true;
    return true;
  }

  private publicSession(rec: MemSession): SessionInfo {
    return {
      id: rec.id,
      type: rec.type,
      userId: rec.userId,
      workspaceId: rec.workspaceId,
      aiCalls: rec.aiCalls,
      demoSteps: rec.demoSteps,
    };
  }

  private sweep() {
    const now = Date.now();
    for (const [id, rec] of this.sessions) {
      if (now - rec.lastSeen > rec.ttl) this.sessions.delete(id);
    }
  }

  /* auth ----------------------------------------------------------------- */

  async createUserWithWorkspace(input: { email: string; name: string; passwordHash: string; workspaceName?: string }) {
    const user: UserRecord = { id: `u_${uid("u")}`, email: input.email.toLowerCase(), name: input.name, passwordHash: input.passwordHash };
    this.users.set(user.email, user);
    const workspaceId = `ws_${uid("w")}`;
    this.workspaces.set(workspaceId, seedWorkspaceData(input.workspaceName ?? `${input.name}'s workspace`));
    this.memberships.push({ userId: user.id, workspaceId, role: "Admin" });
    return { user, workspaceId };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async getUser(userId: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) if (u.id === userId) return u;
    return null;
  }

  async membershipRole(userId: string, workspaceId: string): Promise<MemberRole | null> {
    return this.memberships.find((m) => m.userId === userId && m.workspaceId === workspaceId)?.role ?? null;
  }

  async primaryWorkspaceForUser(userId: string): Promise<string | null> {
    return this.memberships.find((m) => m.userId === userId)?.workspaceId ?? null;
  }

  async createDemoWorkspace(): Promise<string> {
    const workspaceId = `ws_${uid("w")}`;
    this.workspaces.set(workspaceId, seedWorkspaceData());
    return workspaceId;
  }

  /* workspace payload ---------------------------------------------------- */

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const d = this.ws(workspaceId);
    return {
      name: d.name,
      tickets: d.tickets,
      customers: d.customers,
      kbDocs: d.kbDocs,
      automations: d.automations,
      integrations: d.integrations,
      members: d.members,
      audit: d.audit,
      notifications: d.notifications,
      copilot: d.copilot,
      demo: { active: false, steps: { draft: false, send: false, upload: false, connect: false, palette: false } },
      currentUser: null,
      widget: d.widget,
    };
  }

  async getKbDocs(workspaceId: string): Promise<KbDoc[]> {
    return this.ws(workspaceId).kbDocs;
  }
  async getAutomations(workspaceId: string): Promise<Automation[]> {
    return this.ws(workspaceId).automations;
  }
  async getCopilot(workspaceId: string): Promise<CopilotSettings> {
    return this.ws(workspaceId).copilot;
  }

  /* tickets -------------------------------------------------------------- */

  async findTicket(workspaceId: string, id: string): Promise<Ticket | null> {
    return this.ws(workspaceId).tickets.find((t) => t.id === id) ?? null;
  }

  private append(t: Ticket, msg: Omit<Message, "id" | "time"> & { time?: string }) {
    t.messages.push({ id: uid("m"), time: msg.time ?? "just now", ...msg });
  }

  async patchTicket(workspaceId: string, id: string, patch: TicketPatch, actor: string): Promise<Ticket> {
    const t = this.ticket(workspaceId, id);
    if (patch.priority) t.priority = patch.priority;
    if (patch.assignee !== undefined) t.assignee = patch.assignee;
    if (patch.addTag && !t.tags.includes(patch.addTag)) t.tags.push(patch.addTag);
    if (patch.status) {
      t.status = patch.status;
      if (patch.status === "escalated") {
        t.stage = "escalated";
        this.append(t, { kind: "status", text: `Escalated to engineering by ${actor} · just now` });
      } else if (patch.status === "closed") {
        t.stage = "resolved";
        this.append(t, { kind: "status", text: `Ticket closed by ${actor} · just now` });
      } else if (patch.status === "waiting") {
        t.stage = "waiting";
      }
    }
    return t;
  }

  async addReply(workspaceId: string, id: string, text: string, viaAI: boolean, actor: string): Promise<Ticket> {
    const t = this.ticket(workspaceId, id);
    this.append(t, { kind: "agent", author: actor, text, viaAI });
    t.status = "waiting";
    t.stage = "waiting";
    t.unread = false;
    return t;
  }

  async addNote(workspaceId: string, id: string, text: string, actor: string): Promise<Ticket> {
    const t = this.ticket(workspaceId, id);
    this.append(t, { kind: "note", author: actor, text });
    return t;
  }

  async setDraft(workspaceId: string, id: string, draft: AIDraft): Promise<Ticket> {
    const t = this.ticket(workspaceId, id);
    t.draft = draft;
    return t;
  }

  /* knowledge base ------------------------------------------------------- */

  async addKbDoc(workspaceId: string, doc: Omit<KbDoc, "id">): Promise<KbDoc> {
    const full: KbDoc = { id: uid("kb"), ...doc };
    this.ws(workspaceId).kbDocs.push(full);
    return full;
  }

  async updateKbDoc(workspaceId: string, id: string, patch: Partial<KbDoc>): Promise<KbDoc> {
    const doc = this.ws(workspaceId).kbDocs.find((d) => d.id === id);
    if (!doc) throw new NotFoundError(`Unknown document ${id}`);
    Object.assign(doc, patch);
    return doc;
  }

  /* automations ---------------------------------------------------------- */

  async addAutomation(workspaceId: string, rule: { trigger: string; conds: string[]; acts: string[] }): Promise<Automation> {
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
    this.ws(workspaceId).automations.unshift(auto);
    return auto;
  }

  async setAutomationEnabled(workspaceId: string, id: string, enabled: boolean): Promise<Automation> {
    const auto = this.ws(workspaceId).automations.find((a) => a.id === id);
    if (!auto) throw new NotFoundError(`Unknown automation ${id}`);
    auto.enabled = enabled;
    return auto;
  }

  async recordAutomationRun(workspaceId: string, id: string, run: AutomationRun): Promise<void> {
    const auto = this.ws(workspaceId).automations.find((a) => a.id === id);
    if (!auto || !auto.enabled) return;
    auto.runs += 1;
    auto.last = "just now";
    auto.log.unshift(run);
  }

  /* integrations / members / copilot ------------------------------------ */

  async patchIntegration(workspaceId: string, key: IntegrationKey, connected: boolean): Promise<Integration> {
    const intg = this.ws(workspaceId).integrations.find((i) => i.key === key);
    if (!intg) throw new NotFoundError(`Unknown integration ${key}`);
    intg.connected = connected;
    return intg;
  }

  async inviteMember(workspaceId: string, email: string, role: MemberRole): Promise<Member> {
    const local = email.split("@")[0] ?? "teammate";
    const member: Member = {
      name: local.charAt(0).toUpperCase() + local.slice(1),
      email,
      role,
      init: local.charAt(0).toUpperCase(),
      status: "Invited",
    };
    this.ws(workspaceId).members.push(member);
    return member;
  }

  async patchCopilot(workspaceId: string, patch: Partial<CopilotSettings>): Promise<CopilotSettings> {
    const d = this.ws(workspaceId);
    d.copilot = { ...d.copilot, ...patch };
    return d.copilot;
  }

  async appendAudit(workspaceId: string, event: { user: string; action: string; type: AuditEvent["type"] }): Promise<void> {
    this.ws(workspaceId).audit.unshift({ time: "just now", user: event.user, action: event.action, type: event.type });
  }

  /* website chat widget -------------------------------------------------- */

  async resolveSiteKey(siteKey: string): Promise<{ workspaceId: string; allowedOrigins: string[] } | null> {
    for (const [wsId, d] of this.workspaces) {
      if (d.widget.siteKey === siteKey && d.widget.enabled) {
        return { workspaceId: wsId, allowedOrigins: d.widget.allowedOrigins };
      }
    }
    return null;
  }

  async startWidgetConversation(
    workspaceId: string,
    visitor: { name?: string; email?: string },
    firstText: string,
  ): Promise<{ token: string; ticketId: string }> {
    const ticket = buildWebTicket(newTicketRawId(), visitor, firstText);
    this.ws(workspaceId).tickets.unshift(ticket);
    const token = secureToken(24);
    this.widgetConvos.set(token, {
      workspaceId,
      ticketId: ticket.id,
      visitorName: visitor.name?.trim() || null,
      visitorEmail: visitor.email?.trim() || null,
    });
    return { token, ticketId: ticket.id };
  }

  async appendWidgetMessage(workspaceId: string, token: string, text: string): Promise<boolean> {
    const conv = this.widgetConvos.get(token);
    if (!conv || conv.workspaceId !== workspaceId) return false;
    const t = this.ws(workspaceId).tickets.find((x) => x.id === conv.ticketId);
    if (!t) return false;
    this.append(t, { kind: "customer", author: conv.visitorName ?? t.customer.name, text });
    t.status = "open";
    t.stage = "new";
    t.unread = true;
    return true;
  }

  async getWidgetTranscript(workspaceId: string, token: string): Promise<WidgetTranscriptMessage[] | null> {
    const conv = this.widgetConvos.get(token);
    if (!conv || conv.workspaceId !== workspaceId) return null;
    const t = this.ws(workspaceId).tickets.find((x) => x.id === conv.ticketId);
    if (!t) return null;
    return ticketToTranscript(t.messages);
  }
}

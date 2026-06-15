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
  Notification,
  Ticket,
  TicketPatch,
  Workspace,
} from "@/lib/schemas";
import { uid, secureToken } from "@/lib/utils";
import { seedWorkspaceData, type WorkspaceData } from "./seed-data";
import { buildWebTicket, newTicketRawId, ticketToTranscript, type WidgetTranscriptMessage } from "./web-ticket";
import { buildEmailTicket } from "./email-ticket";
import { buildSlackTicket } from "./slack-ticket";
import { planSeatLimit } from "@/server/billing/plans";
import type { InboundEmail } from "@/server/email/gmail";
import type { InboundSlackMessage, SlackAccount } from "@/server/slack/slack";
import {
  NotFoundError,
  type ChannelIngestResult,
  type EmailThreadRef,
  type GmailAccount,
  type InboundEmailResult,
  type Repository,
  type SessionInfo,
  type SlackThreadRef,
  type SubscriptionState,
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

interface EmailThreadRec {
  workspaceId: string;
  gmailThreadId: string;
  ticketId: string;
  customerEmail: string;
  lastInboundMessageId: string | null;
  seen: Set<string>;
}

interface SlackThreadRec {
  workspaceId: string;
  channel: string;
  threadTs: string;
  ticketId: string;
  seen: Set<string>;
}

export class MemoryRepository implements Repository {
  private sessions: Map<string, MemSession>;
  private workspaces: Map<string, WorkspaceData>;
  private users: Map<string, UserRecord>;
  private memberships: { userId: string; workspaceId: string; role: MemberRole }[];
  private widgetConvos: Map<string, WidgetConvo>;
  private authTokens: Map<string, { kind: "reset" | "verify"; userId: string; expiresAt: number }>;
  private gmailAccounts: Map<string, GmailAccount>;
  /** Keyed by `${workspaceId}:${gmailThreadId}`. */
  private emailThreads: Map<string, EmailThreadRec>;
  private slackAccounts: Map<string, SlackAccount>;
  /** Keyed by `${workspaceId}:${channel}:${threadTs}`. */
  private slackThreads: Map<string, SlackThreadRec>;

  constructor() {
    const g = globalThis as unknown as {
      __plMem?: {
        sessions: Map<string, MemSession>;
        workspaces: Map<string, WorkspaceData>;
        users: Map<string, UserRecord>;
        memberships: { userId: string; workspaceId: string; role: MemberRole }[];
        widgetConvos: Map<string, WidgetConvo>;
        authTokens: Map<string, { kind: "reset" | "verify"; userId: string; expiresAt: number }>;
        gmailAccounts: Map<string, GmailAccount>;
        emailThreads: Map<string, EmailThreadRec>;
        slackAccounts: Map<string, SlackAccount>;
        slackThreads: Map<string, SlackThreadRec>;
      };
    };
    if (!g.__plMem) {
      g.__plMem = { sessions: new Map(), workspaces: new Map(), users: new Map(), memberships: [], widgetConvos: new Map(), authTokens: new Map(), gmailAccounts: new Map(), emailThreads: new Map(), slackAccounts: new Map(), slackThreads: new Map() };
    }
    // Backfill maps added after a long-running process first created __plMem.
    g.__plMem.gmailAccounts ??= new Map();
    g.__plMem.emailThreads ??= new Map();
    g.__plMem.slackAccounts ??= new Map();
    g.__plMem.slackThreads ??= new Map();
    this.sessions = g.__plMem.sessions;
    this.workspaces = g.__plMem.workspaces;
    this.users = g.__plMem.users;
    this.memberships = g.__plMem.memberships;
    this.widgetConvos = g.__plMem.widgetConvos;
    this.authTokens = g.__plMem.authTokens;
    this.gmailAccounts = g.__plMem.gmailAccounts;
    this.emailThreads = g.__plMem.emailThreads;
    this.slackAccounts = g.__plMem.slackAccounts;
    this.slackThreads = g.__plMem.slackThreads;
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
    const user: UserRecord = { id: `u_${uid("u")}`, email: input.email.toLowerCase(), name: input.name, passwordHash: input.passwordHash, emailVerified: false };
    this.users.set(user.email, user);
    const workspaceId = `ws_${uid("w")}`;
    // Real signup → empty workspace (no demo fixtures).
    this.workspaces.set(workspaceId, seedWorkspaceData(input.workspaceName ?? `${input.name}'s workspace`, { empty: true }));
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

  private userById(userId: string): UserRecord | undefined {
    for (const u of this.users.values()) if (u.id === userId) return u;
    return undefined;
  }

  async createPasswordReset(userId: string): Promise<string> {
    const token = secureToken(24);
    this.authTokens.set(token, { kind: "reset", userId, expiresAt: Date.now() + 60 * 60 * 1000 });
    return token;
  }
  async consumePasswordReset(token: string): Promise<string | null> {
    const t = this.authTokens.get(token);
    if (!t || t.kind !== "reset") return null;
    this.authTokens.delete(token);
    return t.expiresAt < Date.now() ? null : t.userId;
  }
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    const u = this.userById(userId);
    if (u) u.passwordHash = passwordHash;
  }
  async deleteUserSessions(userId: string): Promise<void> {
    for (const [id, s] of this.sessions) if (s.userId === userId) this.sessions.delete(id);
  }
  async createEmailVerification(userId: string): Promise<string> {
    const token = secureToken(24);
    this.authTokens.set(token, { kind: "verify", userId, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return token;
  }
  async consumeEmailVerification(token: string): Promise<string | null> {
    const t = this.authTokens.get(token);
    if (!t || t.kind !== "verify") return null;
    this.authTokens.delete(token);
    return t.expiresAt < Date.now() ? null : t.userId;
  }
  async markEmailVerified(userId: string): Promise<void> {
    const u = this.userById(userId);
    if (u) u.emailVerified = true;
  }
  async consumeEmailVerificationAtomic(token: string): Promise<string | null> {
    const t = this.authTokens.get(token);
    if (!t || t.kind !== "verify") return null;
    this.authTokens.delete(token);
    if (t.expiresAt < Date.now()) return null;
    const u = this.userById(t.userId);
    if (u) u.emailVerified = true;
    return t.userId;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.delete(workspaceId);
    // Splice in place so the shared global array reference stays valid.
    for (let i = this.memberships.length - 1; i >= 0; i--) {
      if (this.memberships[i]!.workspaceId === workspaceId) this.memberships.splice(i, 1);
    }
    // Mirror FK cascade: drop sessions, widget conversations, and the gmail
    // account + email threads for this workspace.
    for (const [id, s] of this.sessions) if (s.workspaceId === workspaceId) this.sessions.delete(id);
    for (const [t, c] of this.widgetConvos) if (c.workspaceId === workspaceId) this.widgetConvos.delete(t);
    this.gmailAccounts.delete(workspaceId);
    for (const [k, rec] of this.emailThreads) if (rec.workspaceId === workspaceId) this.emailThreads.delete(k);
    this.slackAccounts.delete(workspaceId);
    for (const [k, rec] of this.slackThreads) if (rec.workspaceId === workspaceId) this.slackThreads.delete(k);
  }

  async deleteUserIfOrphaned(userId: string): Promise<void> {
    if (this.memberships.some((m) => m.userId === userId)) return;
    for (const [email, u] of this.users) if (u.id === userId) this.users.delete(email);
    for (const [id, s] of this.sessions) if (s.userId === userId) this.sessions.delete(id);
    for (const [tok, t] of this.authTokens) if (t.userId === userId) this.authTokens.delete(tok);
  }

  async getSubscription(workspaceId: string): Promise<SubscriptionState> {
    return { ...this.ws(workspaceId).subscription };
  }
  async setSubscription(workspaceId: string, patch: Partial<SubscriptionState>): Promise<void> {
    const d = this.ws(workspaceId);
    d.subscription = { ...d.subscription, ...patch };
  }
  async countMembers(workspaceId: string): Promise<number> {
    return this.ws(workspaceId).members.length;
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
      subscription: {
        plan: d.subscription.plan,
        status: d.subscription.status,
        seats: d.subscription.seats,
        seatLimit: planSeatLimit(d.subscription.plan),
        seatsUsed: d.members.length,
        currentPeriodEnd: d.subscription.currentPeriodEnd,
      },
    };
  }

  async getShell(workspaceId: string): Promise<{ name: string; notifications: Notification[] }> {
    const d = this.ws(workspaceId);
    return { name: d.name, notifications: d.notifications };
  }

  async renameWorkspace(workspaceId: string, name: string): Promise<void> {
    this.ws(workspaceId).name = name;
  }
  async patchWidgetConfig(workspaceId: string, patch: { allowedOrigins?: string[]; enabled?: boolean }): Promise<void> {
    const d = this.ws(workspaceId);
    if (patch.allowedOrigins !== undefined) d.widget.allowedOrigins = patch.allowedOrigins;
    if (patch.enabled !== undefined) d.widget.enabled = patch.enabled;
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

  async saveTicket(workspaceId: string, ticket: Ticket): Promise<void> {
    // In-memory tickets are mutated in place (the live object), so persistence
    // is implicit; assign defensively in case a detached copy was passed.
    const t = this.ws(workspaceId).tickets.find((x) => x.id === ticket.id);
    if (t && t !== ticket) Object.assign(t, ticket);
  }

  async saveTicketFields(
    workspaceId: string,
    id: string,
    fields: Partial<Pick<Ticket, "priority" | "assignee" | "tags" | "status" | "stage" | "unread">>,
  ): Promise<void> {
    const t = this.ws(workspaceId).tickets.find((x) => x.id === id);
    if (t) Object.assign(t, fields);
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

  async acceptInvite(input: { workspaceId: string; email: string; role: string; name?: string; passwordHash?: string }): Promise<{ userId: string }> {
    const normalizedEmail = input.email.toLowerCase();
    // Activate the invited member entry in the workspace list.
    const ws = this.ws(input.workspaceId);
    const memberEntry = ws.members.find((m) => m.email.toLowerCase() === normalizedEmail);
    if (memberEntry) {
      if (input.name) memberEntry.name = input.name;
      memberEntry.status = "Active";
    }
    // Find or create the user record (users Map is keyed by email).
    let userRec = this.users.get(normalizedEmail);
    if (userRec) {
      if (input.name) userRec.name = input.name;
      if (input.passwordHash) userRec.passwordHash = input.passwordHash;
    } else {
      const local = normalizedEmail.split("@")[0] ?? "teammate";
      userRec = {
        id: `u_mem_${Date.now()}`,
        email: normalizedEmail,
        name: input.name ?? (local.charAt(0).toUpperCase() + local.slice(1)),
        passwordHash: input.passwordHash ?? null,
        emailVerified: false,
      };
      this.users.set(normalizedEmail, userRec);
      this.memberships.push({ userId: userRec.id, workspaceId: input.workspaceId, role: input.role as MemberRole });
    }
    return { userId: userRec.id };
  }

  async updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<Member> {
    const d = this.ws(workspaceId);
    // Find the membership by userId in this.memberships (used for role checks)
    const memEntry = this.memberships.find((m) => m.userId === userId && m.workspaceId === workspaceId);
    if (!memEntry) throw new NotFoundError(`No membership for user ${userId} in this workspace`);
    memEntry.role = role;
    // Also update the denormalised member record stored on the workspace
    const member = d.members.find((m) => {
      // members are keyed by email; resolve via users
      const u = [...this.users.values()].find((u) => u.id === userId);
      return u ? m.email === u.email : false;
    });
    if (member) member.role = role;
    const u = [...this.users.values()].find((u) => u.id === userId);
    return {
      name: u?.name ?? userId,
      email: u?.email ?? "",
      role,
      init: (u?.name ?? userId).charAt(0).toUpperCase(),
      status: member?.status ?? "Active",
    };
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

  /* gmail email channel -------------------------------------------------- */

  async resolveGmailWorkspace(address: string): Promise<string | null> {
    const a = address.trim().toLowerCase();
    for (const [wsId, acct] of this.gmailAccounts) if (acct.address === a) return wsId;
    return null;
  }

  async getGmailAccount(workspaceId: string): Promise<GmailAccount | null> {
    return this.gmailAccounts.get(workspaceId) ?? null;
  }

  async setGmailAccount(workspaceId: string, account: GmailAccount): Promise<void> {
    this.gmailAccounts.set(workspaceId, { refreshToken: account.refreshToken, address: account.address.trim().toLowerCase() });
  }

  async clearGmailAccount(workspaceId: string): Promise<void> {
    this.gmailAccounts.delete(workspaceId);
  }

  async ingestInboundEmail(workspaceId: string, email: InboundEmail): Promise<InboundEmailResult> {
    const key = `${workspaceId}:${email.threadId}`;
    const existing = this.emailThreads.get(key);
    if (existing) {
      if (email.messageId && existing.seen.has(email.messageId)) {
        return { ticketId: existing.ticketId, created: false, duplicate: true };
      }
      const t = this.ws(workspaceId).tickets.find((x) => x.id === existing.ticketId);
      if (t) {
        this.append(t, { kind: "customer", author: email.fromName || t.customer.name, text: email.body });
        t.status = "open";
        t.stage = "new";
        t.unread = true;
      }
      if (email.messageId) {
        existing.seen.add(email.messageId);
        existing.lastInboundMessageId = email.messageId;
      }
      return { ticketId: existing.ticketId, created: false, duplicate: false };
    }
    const ticket = buildEmailTicket(newTicketRawId(), email);
    this.ws(workspaceId).tickets.unshift(ticket);
    this.emailThreads.set(key, {
      workspaceId,
      gmailThreadId: email.threadId,
      ticketId: ticket.id,
      customerEmail: email.from,
      lastInboundMessageId: email.messageId || null,
      seen: new Set(email.messageId ? [email.messageId] : []),
    });
    return { ticketId: ticket.id, created: true, duplicate: false };
  }

  async getEmailThread(workspaceId: string, ticketId: string): Promise<EmailThreadRef | null> {
    for (const rec of this.emailThreads.values()) {
      if (rec.workspaceId === workspaceId && rec.ticketId === ticketId) {
        return { gmailThreadId: rec.gmailThreadId, customerEmail: rec.customerEmail, lastInboundMessageId: rec.lastInboundMessageId };
      }
    }
    return null;
  }

  /* slack channel -------------------------------------------------------- */

  async resolveSlackWorkspace(teamId: string): Promise<string | null> {
    for (const [wsId, acct] of this.slackAccounts) if (acct.teamId === teamId) return wsId;
    return null;
  }

  async getSlackAccount(workspaceId: string): Promise<SlackAccount | null> {
    return this.slackAccounts.get(workspaceId) ?? null;
  }

  async setSlackAccount(workspaceId: string, account: SlackAccount): Promise<void> {
    this.slackAccounts.set(workspaceId, { botToken: account.botToken, teamId: account.teamId, teamName: account.teamName });
  }

  async clearSlackAccount(workspaceId: string): Promise<void> {
    this.slackAccounts.delete(workspaceId);
  }

  async ingestSlackMessage(workspaceId: string, msg: InboundSlackMessage): Promise<ChannelIngestResult> {
    const key = `${workspaceId}:${msg.channel}:${msg.threadTs}`;
    const existing = this.slackThreads.get(key);
    if (existing) {
      if (msg.ts && existing.seen.has(msg.ts)) {
        return { ticketId: existing.ticketId, created: false, duplicate: true };
      }
      const t = this.ws(workspaceId).tickets.find((x) => x.id === existing.ticketId);
      if (t) {
        this.append(t, { kind: "customer", author: msg.userName || t.customer.name, text: msg.text });
        t.status = "open";
        t.stage = "new";
        t.unread = true;
      }
      if (msg.ts) existing.seen.add(msg.ts);
      return { ticketId: existing.ticketId, created: false, duplicate: false };
    }
    const ticket = buildSlackTicket(newTicketRawId(), msg);
    this.ws(workspaceId).tickets.unshift(ticket);
    this.slackThreads.set(key, {
      workspaceId,
      channel: msg.channel,
      threadTs: msg.threadTs,
      ticketId: ticket.id,
      seen: new Set(msg.ts ? [msg.ts] : []),
    });
    return { ticketId: ticket.id, created: true, duplicate: false };
  }

  async getSlackThread(workspaceId: string, ticketId: string): Promise<SlackThreadRef | null> {
    for (const rec of this.slackThreads.values()) {
      if (rec.workspaceId === workspaceId && rec.ticketId === ticketId) {
        return { channel: rec.channel, threadTs: rec.threadTs };
      }
    }
    return null;
  }
}

import { and, eq, asc, inArray, sql, or, ne, lt } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import * as s from "@/server/db/schema";
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
import { seedWorkspaceData } from "./seed-data";
import { buildWebTicket, newTicketRawId, ticketToTranscript, type WidgetTranscriptMessage } from "./web-ticket";
import { planSeatLimit } from "@/server/billing/plans";
import { NotFoundError, type Repository, type SessionInfo, type SubscriptionState, type UserRecord } from "./types";

const DEMO_TTL_MS = 30 * 60 * 1000;
const REGULAR_TTL_MS = 12 * 60 * 60 * 1000;
export const DEMO_AI_CALL_LIMIT = Number(process.env.DEMO_AI_CALL_LIMIT) || 25;

const emptySteps = (): Record<DemoStep, boolean> => ({
  draft: false, send: false, upload: false, connect: false, palette: false,
});

/** The Drizzle client or a transaction handle — both expose insert/select/update. */
type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Postgres-backed repository (Drizzle). Active when DATABASE_URL is set. */
export class PgRepository implements Repository {
  private get db(): Db {
    return getDb();
  }

  /* seeding -------------------------------------------------------------- */

  /**
   * Insert the seed rows for a workspace via `exec` (the client or a
   * transaction). Pure DB writes — no corpus embedding — so the caller can run
   * it atomically inside a transaction.
   */
  private async seedWorkspaceRows(exec: Executor, workspaceId: string, name: string, empty = false): Promise<void> {
    const d = seedWorkspaceData(name, { empty });
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace"}-${workspaceId.slice(-6)}`;
    await exec.insert(s.workspaces).values({ id: workspaceId, name: d.name, slug, plan: "Growth", widgetSiteKey: secureToken(16) });
    await exec.insert(s.copilotSettings).values({
      workspaceId,
      tone: d.copilot.tone,
      risk: d.copilot.risk,
      threshold: d.copilot.threshold,
      approvals: d.copilot.approvals,
      neverSay: d.copilot.neverSay,
    });
    if (d.customers.length)
      await exec.insert(s.customers).values(d.customers.map((c) => ({ ...c, id: `${workspaceId}_${c.id}`, workspaceId })));
    if (d.tickets.length)
      await exec.insert(s.tickets).values(
        d.tickets.map((t, i) => ({
          id: `${workspaceId}_${t.id}`,
          workspaceId,
          customer: t.customer,
          channel: t.channel,
          subject: t.subject,
          preview: t.preview,
          priority: t.priority,
          tags: t.tags,
          status: t.status,
          stage: t.stage,
          assignee: t.assignee,
          slaMins: t.slaMins,
          slaTotal: t.slaTotal,
          unread: t.unread,
          time: t.time,
          conf: t.conf,
          archived: t.archived,
          messages: t.messages,
          draft: t.draft,
          aiFailureReason: t.aiFailureReason,
          sortOrder: i,
        })),
      );
    if (d.kbDocs.length)
      await exec.insert(s.kbDocs).values(d.kbDocs.map((k, i) => ({ ...k, id: `${workspaceId}_${k.id}`, workspaceId, sortOrder: i })));
    if (d.automations.length)
      await exec.insert(s.automations).values(d.automations.map((a, i) => ({ ...a, id: `${workspaceId}_${a.id}`, workspaceId, sortOrder: i })));
    if (d.integrations.length)
      await exec.insert(s.integrations).values(
        d.integrations.map((g, i) => ({
          id: `${workspaceId}_${g.key}`,
          workspaceId,
          key: g.key,
          name: g.name,
          glyph: g.glyph,
          fg: g.fg,
          description: g.desc,
          perms: g.perms,
          last: g.last,
          connected: g.connected,
          configurable: g.configurable,
          sortOrder: i,
        })),
      );
    if (d.audit.length)
      await exec.insert(s.auditEvents).values(d.audit.map((a) => ({ ...a, id: uid("au"), workspaceId })));
    if (d.notifications.length)
      await exec.insert(s.notifications).values(d.notifications.map((n, i) => ({ id: uid("nt"), workspaceId, color: n.c, text: n.text, time: n.time, sortOrder: i })));
  }

  /**
   * Embed the seed knowledge corpus so RAG retrieval is real from day one.
   * Best-effort and intentionally OUTSIDE any provisioning transaction: a slow
   * or failed embedding must neither block nor roll back workspace creation.
   */
  private async ingestCorpusBestEffort(workspaceId: string): Promise<void> {
    try {
      const { ingestSeedCorpus } = await import("@/server/ai/rag");
      await ingestSeedCorpus(workspaceId);
    } catch (err) {
      console.error("[seed] corpus ingestion failed:", err);
    }
  }

  private async seedWorkspace(workspaceId: string, name: string): Promise<void> {
    await this.db.transaction((tx) => this.seedWorkspaceRows(tx, workspaceId, name));
    await this.ingestCorpusBestEffort(workspaceId);
  }

  /* sessions ------------------------------------------------------------- */

  async createSession(input: { type: "regular" | "demo"; userId?: string | null; workspaceId: string }): Promise<SessionInfo> {
    const id = `${input.type === "demo" ? "demo" : "ws"}_${secureToken(18)}`;
    const ttl = input.type === "demo" ? DEMO_TTL_MS : REGULAR_TTL_MS;
    await this.db.insert(s.sessions).values({
      id,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId,
      type: input.type,
      aiCalls: 0,
      demoSteps: emptySteps(),
      expiresAt: new Date(Date.now() + ttl),
    });
    return { id, type: input.type, userId: input.userId ?? null, workspaceId: input.workspaceId, aiCalls: 0, demoSteps: emptySteps() };
  }

  async getSession(id: string): Promise<SessionInfo | null> {
    const [row] = await this.db.select().from(s.sessions).where(eq(s.sessions.id, id)).limit(1);
    if (!row || !row.workspaceId) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.db.delete(s.sessions).where(eq(s.sessions.id, id));
      return null;
    }
    return {
      id: row.id,
      type: row.type as "regular" | "demo",
      userId: row.userId,
      workspaceId: row.workspaceId,
      aiCalls: row.aiCalls,
      demoSteps: { ...emptySteps(), ...(row.demoSteps ?? {}) },
    };
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.delete(s.sessions).where(eq(s.sessions.id, id));
  }

  async consumeAiCall(sessionId: string): Promise<boolean> {
    // Atomic: increment only if the session is non-demo, or a demo session still
    // under budget. A single conditional UPDATE avoids the select-then-update
    // race where concurrent calls both pass the check and overrun the budget.
    const updated = await this.db
      .update(s.sessions)
      .set({ aiCalls: sql`${s.sessions.aiCalls} + 1` })
      .where(and(eq(s.sessions.id, sessionId), or(ne(s.sessions.type, "demo"), lt(s.sessions.aiCalls, DEMO_AI_CALL_LIMIT))))
      .returning({ id: s.sessions.id });
    if (updated.length) return true;
    // No row updated: either an unknown session (allow, as before) or a demo
    // session that has hit its budget (deny).
    const [row] = await this.db.select({ id: s.sessions.id }).from(s.sessions).where(eq(s.sessions.id, sessionId)).limit(1);
    return !row;
  }

  async completeDemoStep(sessionId: string, step: DemoStep): Promise<boolean> {
    const [row] = await this.db.select().from(s.sessions).where(eq(s.sessions.id, sessionId)).limit(1);
    if (!row || row.type !== "demo") return false;
    const steps = { ...emptySteps(), ...(row.demoSteps ?? {}) };
    if (steps[step]) return false;
    steps[step] = true;
    await this.db.update(s.sessions).set({ demoSteps: steps }).where(eq(s.sessions.id, sessionId));
    return true;
  }

  /* auth ----------------------------------------------------------------- */

  async createUserWithWorkspace(input: { email: string; name: string; passwordHash: string; workspaceName?: string }) {
    const user: UserRecord = { id: `u_${uid("u")}`, email: input.email.toLowerCase(), name: input.name, passwordHash: input.passwordHash };
    const workspaceId = `ws_${uid("w")}`;
    // Atomic: user + seeded workspace + membership all commit together, so a
    // mid-provision failure never leaves an orphaned user or a half-workspace.
    await this.db.transaction(async (tx) => {
      await tx.insert(s.users).values({ id: user.id, email: user.email, name: user.name, passwordHash: user.passwordHash });
      // Real signup → empty workspace (no demo data, no seed KB corpus).
      await this.seedWorkspaceRows(tx, workspaceId, input.workspaceName ?? `${input.name}'s workspace`, true);
      await tx.insert(s.memberships).values({ userId: user.id, workspaceId, role: "Admin", status: "Active" });
    });
    return { user, workspaceId };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(s.users).where(eq(s.users.email, email.toLowerCase())).limit(1);
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.passwordHash, emailVerified: row.emailVerified } : null;
  }

  async getUser(userId: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.passwordHash, emailVerified: row.emailVerified } : null;
  }

  async createPasswordReset(userId: string): Promise<string> {
    const token = secureToken(24);
    await this.db.insert(s.passwordResets).values({ token, userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    return token;
  }
  async consumePasswordReset(token: string): Promise<string | null> {
    const [row] = await this.db.select().from(s.passwordResets).where(eq(s.passwordResets.token, token)).limit(1);
    if (!row) return null;
    await this.db.delete(s.passwordResets).where(eq(s.passwordResets.token, token));
    return row.expiresAt.getTime() < Date.now() ? null : row.userId;
  }
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.update(s.users).set({ passwordHash }).where(eq(s.users.id, userId));
  }
  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(s.sessions).where(eq(s.sessions.userId, userId));
  }
  async createEmailVerification(userId: string): Promise<string> {
    const token = secureToken(24);
    await this.db.insert(s.emailVerifications).values({ token, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    return token;
  }
  async consumeEmailVerification(token: string): Promise<string | null> {
    const [row] = await this.db.select().from(s.emailVerifications).where(eq(s.emailVerifications.token, token)).limit(1);
    if (!row) return null;
    await this.db.delete(s.emailVerifications).where(eq(s.emailVerifications.token, token));
    return row.expiresAt.getTime() < Date.now() ? null : row.userId;
  }
  async markEmailVerified(userId: string): Promise<void> {
    await this.db.update(s.users).set({ emailVerified: true }).where(eq(s.users.id, userId));
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    // FK cascades remove tickets, customers, kb, automations, integrations,
    // audit, notifications, copilot settings, memberships, sessions, and widget
    // conversations for this workspace.
    await this.db.delete(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  }

  async deleteUserIfOrphaned(userId: string): Promise<void> {
    const rows = await this.db.select().from(s.memberships).where(eq(s.memberships.userId, userId)).limit(1);
    if (rows.length) return;
    // Cascades the user's remaining sessions, password resets, verifications.
    await this.db.delete(s.users).where(eq(s.users.id, userId));
  }

  async getSubscription(workspaceId: string): Promise<SubscriptionState> {
    const [row] = await this.db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId)).limit(1);
    if (!row) throw new NotFoundError(`Unknown workspace ${workspaceId}`);
    return {
      plan: row.plan,
      status: row.subscriptionStatus as SubscriptionState["status"],
      seats: row.seats,
      currentPeriodEnd: row.currentPeriodEnd,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
    };
  }

  async setSubscription(workspaceId: string, patch: Partial<SubscriptionState>): Promise<void> {
    await this.db
      .update(s.workspaces)
      .set({
        ...(patch.plan !== undefined && { plan: patch.plan }),
        ...(patch.status !== undefined && { subscriptionStatus: patch.status }),
        ...(patch.seats !== undefined && { seats: patch.seats }),
        ...(patch.currentPeriodEnd !== undefined && { currentPeriodEnd: patch.currentPeriodEnd }),
        ...(patch.stripeCustomerId !== undefined && { stripeCustomerId: patch.stripeCustomerId }),
        ...(patch.stripeSubscriptionId !== undefined && { stripeSubscriptionId: patch.stripeSubscriptionId }),
      })
      .where(eq(s.workspaces.id, workspaceId));
  }

  async countMembers(workspaceId: string): Promise<number> {
    const rows = await this.db.select({ userId: s.memberships.userId }).from(s.memberships).where(eq(s.memberships.workspaceId, workspaceId));
    return rows.length;
  }

  async membershipRole(userId: string, workspaceId: string): Promise<MemberRole | null> {
    const [row] = await this.db
      .select()
      .from(s.memberships)
      .where(and(eq(s.memberships.userId, userId), eq(s.memberships.workspaceId, workspaceId)))
      .limit(1);
    return (row?.role as MemberRole | undefined) ?? null;
  }

  async primaryWorkspaceForUser(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(s.memberships)
      .where(eq(s.memberships.userId, userId))
      .orderBy(asc(s.memberships.createdAt))
      .limit(1);
    return row?.workspaceId ?? null;
  }

  async createDemoWorkspace(): Promise<string> {
    const workspaceId = `ws_${uid("w")}`;
    await this.seedWorkspace(workspaceId, "Acme Inc");
    return workspaceId;
  }

  /* workspace payload ---------------------------------------------------- */

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const db = this.db;
    const [wsRow] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId)).limit(1);
    if (!wsRow) {
      // Self-heal: a cookie referencing a not-yet-seeded workspace.
      await this.seedWorkspace(workspaceId, "Acme Inc");
      return this.getWorkspace(workspaceId);
    }
    const [tk, cust, kb, autos, intg, mem, aud, notif, cop] = await Promise.all([
      db.select().from(s.tickets).where(eq(s.tickets.workspaceId, workspaceId)).orderBy(asc(s.tickets.sortOrder)),
      db.select().from(s.customers).where(eq(s.customers.workspaceId, workspaceId)),
      db.select().from(s.kbDocs).where(eq(s.kbDocs.workspaceId, workspaceId)).orderBy(asc(s.kbDocs.sortOrder)),
      db.select().from(s.automations).where(eq(s.automations.workspaceId, workspaceId)).orderBy(asc(s.automations.sortOrder)),
      db.select().from(s.integrations).where(eq(s.integrations.workspaceId, workspaceId)).orderBy(asc(s.integrations.sortOrder)),
      db.select().from(s.memberships).where(eq(s.memberships.workspaceId, workspaceId)),
      db.select().from(s.auditEvents).where(eq(s.auditEvents.workspaceId, workspaceId)),
      db.select().from(s.notifications).where(eq(s.notifications.workspaceId, workspaceId)).orderBy(asc(s.notifications.sortOrder)),
      db.select().from(s.copilotSettings).where(eq(s.copilotSettings.workspaceId, workspaceId)).limit(1),
    ]);

    // Members: real memberships joined to users. Batch the user lookup into one
    // query (was N+1 — one round-trip per member, a real latency cost in the
    // per-navigation workspace fetch).
    const memberUserIds = mem.map((m) => m.userId);
    const memberUsers = memberUserIds.length
      ? await db.select().from(s.users).where(inArray(s.users.id, memberUserIds))
      : [];
    const usersById = new Map(memberUsers.map((u) => [u.id, u]));
    const memberRows = mem.map((m) => {
      const u = usersById.get(m.userId);
      const name = u?.name ?? m.invitedEmail?.split("@")[0] ?? "Member";
      return { name, email: u?.email ?? m.invitedEmail ?? "", role: m.role as MemberRole, init: name.charAt(0).toUpperCase(), status: m.status as "Active" | "Invited" };
    });
    const seedMembers = seedWorkspaceData().members;

    const copilot = cop[0]
      ? { tone: cop[0].tone as CopilotSettings["tone"], risk: cop[0].risk as CopilotSettings["risk"], threshold: cop[0].threshold, approvals: cop[0].approvals, neverSay: cop[0].neverSay }
      : seedWorkspaceData().copilot;

    return {
      name: wsRow.name,
      tickets: tk.map(rowToTicket),
      customers: cust.map((c) => ({
        id: stripPrefix(c.id, workspaceId),
        name: c.name, company: c.company, init: c.init, hue: c.hue, email: c.email,
        plan: c.plan, mrr: c.mrr, since: c.since, loc: c.loc, seats: c.seats,
        lastActive: c.lastActive, convos: c.convos,
        sentiment: c.sentiment as Workspace["customers"][number]["sentiment"],
        notes: c.notes,
      })),
      kbDocs: kb.map((k) => ({ id: stripPrefix(k.id, workspaceId), name: k.name, source: k.source, status: k.status as KbDoc["status"], chunks: k.chunks, cited: k.cited, synced: k.synced })),
      automations: autos.map((a) => ({ id: stripPrefix(a.id, workspaceId), name: a.name, trigger: a.trigger, conds: a.conds, acts: a.acts, enabled: a.enabled, runs: a.runs, last: a.last, log: a.log })),
      integrations: intg.map((g) => ({ key: g.key as IntegrationKey, name: g.name, glyph: g.glyph, fg: g.fg, desc: g.description, perms: g.perms, last: g.last, connected: g.connected, configurable: g.configurable })),
      members: memberRows.length ? memberRows : seedMembers,
      audit: aud.map((a) => ({ time: a.time, user: a.user, action: a.action, type: a.type as Workspace["audit"][number]["type"] })),
      notifications: notif.map((n) => ({ c: n.color, text: n.text, time: n.time })),
      copilot,
      demo: { active: false, steps: emptySteps() },
      currentUser: null,
      widget: {
        siteKey: wsRow.widgetSiteKey ?? "",
        enabled: wsRow.widgetEnabled,
        allowedOrigins: wsRow.widgetAllowedOrigins,
      },
      subscription: {
        plan: wsRow.plan,
        status: wsRow.subscriptionStatus as "active" | "trialing" | "past_due" | "canceled",
        seats: wsRow.seats,
        seatLimit: planSeatLimit(wsRow.plan),
        seatsUsed: memberRows.length,
        currentPeriodEnd: wsRow.currentPeriodEnd,
      },
    };
  }

  async getShell(workspaceId: string): Promise<{ name: string; notifications: Notification[] }> {
    const [wsRow] = await this.db.select({ name: s.workspaces.name }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId)).limit(1);
    if (!wsRow) {
      await this.seedWorkspace(workspaceId, "Acme Inc");
      return this.getShell(workspaceId);
    }
    const notif = await this.db.select().from(s.notifications).where(eq(s.notifications.workspaceId, workspaceId)).orderBy(asc(s.notifications.sortOrder));
    return { name: wsRow.name, notifications: notif.map((n) => ({ c: n.color, text: n.text, time: n.time })) };
  }

  async getKbDocs(workspaceId: string): Promise<KbDoc[]> {
    const rows = await this.db.select().from(s.kbDocs).where(eq(s.kbDocs.workspaceId, workspaceId)).orderBy(asc(s.kbDocs.sortOrder));
    return rows.map((k) => ({ id: stripPrefix(k.id, workspaceId), name: k.name, source: k.source, status: k.status as KbDoc["status"], chunks: k.chunks, cited: k.cited, synced: k.synced }));
  }
  async getAutomations(workspaceId: string): Promise<Automation[]> {
    const rows = await this.db.select().from(s.automations).where(eq(s.automations.workspaceId, workspaceId)).orderBy(asc(s.automations.sortOrder));
    return rows.map((a) => ({ id: stripPrefix(a.id, workspaceId), name: a.name, trigger: a.trigger, conds: a.conds, acts: a.acts, enabled: a.enabled, runs: a.runs, last: a.last, log: a.log }));
  }
  async getCopilot(workspaceId: string): Promise<CopilotSettings> {
    const [c] = await this.db.select().from(s.copilotSettings).where(eq(s.copilotSettings.workspaceId, workspaceId)).limit(1);
    return c ? { tone: c.tone as CopilotSettings["tone"], risk: c.risk as CopilotSettings["risk"], threshold: c.threshold, approvals: c.approvals, neverSay: c.neverSay } : seedWorkspaceData().copilot;
  }

  /* tickets -------------------------------------------------------------- */

  private async loadTicket(workspaceId: string, id: string) {
    const [row] = await this.db.select().from(s.tickets).where(and(eq(s.tickets.workspaceId, workspaceId), eq(s.tickets.id, `${workspaceId}_${id}`))).limit(1);
    return row;
  }

  async findTicket(workspaceId: string, id: string): Promise<Ticket | null> {
    const row = await this.loadTicket(workspaceId, id);
    return row ? rowToTicket(row) : null;
  }

  async patchTicket(workspaceId: string, id: string, patch: TicketPatch, actor: string): Promise<Ticket> {
    const row = await this.loadTicket(workspaceId, id);
    if (!row) throw new NotFoundError(`Unknown ticket ${id}`);
    const t = rowToTicket(row);
    if (patch.priority) t.priority = patch.priority;
    if (patch.assignee !== undefined) t.assignee = patch.assignee;
    if (patch.addTag && !t.tags.includes(patch.addTag)) t.tags.push(patch.addTag);
    if (patch.status) {
      t.status = patch.status;
      if (patch.status === "escalated") {
        t.stage = "escalated";
        t.messages.push({ id: uid("m"), kind: "status", time: "just now", text: `Escalated to engineering by ${actor} · just now` });
      } else if (patch.status === "closed") {
        t.stage = "resolved";
        t.messages.push({ id: uid("m"), kind: "status", time: "just now", text: `Ticket closed by ${actor} · just now` });
      } else if (patch.status === "waiting") {
        t.stage = "waiting";
      }
    }
    await this.saveTicket(workspaceId, t);
    return t;
  }

  async addReply(workspaceId: string, id: string, text: string, viaAI: boolean, actor: string): Promise<Ticket> {
    const row = await this.loadTicket(workspaceId, id);
    if (!row) throw new NotFoundError(`Unknown ticket ${id}`);
    const t = rowToTicket(row);
    t.messages.push({ id: uid("m"), kind: "agent", author: actor, time: "just now", text, viaAI });
    t.status = "waiting";
    t.stage = "waiting";
    t.unread = false;
    await this.saveTicket(workspaceId, t);
    return t;
  }

  async addNote(workspaceId: string, id: string, text: string, actor: string): Promise<Ticket> {
    const row = await this.loadTicket(workspaceId, id);
    if (!row) throw new NotFoundError(`Unknown ticket ${id}`);
    const t = rowToTicket(row);
    t.messages.push({ id: uid("m"), kind: "note", author: actor, time: "just now", text });
    await this.saveTicket(workspaceId, t);
    return t;
  }

  async setDraft(workspaceId: string, id: string, draft: AIDraft): Promise<Ticket> {
    const row = await this.loadTicket(workspaceId, id);
    if (!row) throw new NotFoundError(`Unknown ticket ${id}`);
    const t = rowToTicket(row);
    t.draft = draft;
    await this.saveTicket(workspaceId, t);
    return t;
  }

  private async saveTicket(workspaceId: string, t: Ticket): Promise<void> {
    await this.db
      .update(s.tickets)
      .set({
        priority: t.priority, assignee: t.assignee, tags: t.tags, status: t.status, stage: t.stage,
        unread: t.unread, messages: t.messages, draft: t.draft,
      })
      .where(and(eq(s.tickets.workspaceId, workspaceId), eq(s.tickets.id, `${workspaceId}_${t.id}`)));
  }

  /* knowledge base ------------------------------------------------------- */

  async addKbDoc(workspaceId: string, doc: Omit<KbDoc, "id">): Promise<KbDoc> {
    const rawId = uid("kb");
    await this.db.insert(s.kbDocs).values({ id: `${workspaceId}_${rawId}`, workspaceId, name: doc.name, source: doc.source, status: doc.status, chunks: doc.chunks, cited: doc.cited, synced: doc.synced, sortOrder: 999 });
    return { id: rawId, ...doc };
  }

  async updateKbDoc(workspaceId: string, id: string, patch: Partial<KbDoc>): Promise<KbDoc> {
    const fullId = id.startsWith(workspaceId) ? id : `${workspaceId}_${id}`;
    await this.db.update(s.kbDocs).set({ ...(patch.status && { status: patch.status }), ...(patch.chunks && { chunks: patch.chunks }), ...(patch.cited && { cited: patch.cited }), ...(patch.synced && { synced: patch.synced }) }).where(and(eq(s.kbDocs.workspaceId, workspaceId), eq(s.kbDocs.id, fullId)));
    const [row] = await this.db.select().from(s.kbDocs).where(eq(s.kbDocs.id, fullId)).limit(1);
    if (!row) throw new NotFoundError(`Unknown document ${id}`);
    return { id: stripPrefix(row.id, workspaceId), name: row.name, source: row.source, status: row.status as KbDoc["status"], chunks: row.chunks, cited: row.cited, synced: row.synced };
  }

  /* automations ---------------------------------------------------------- */

  async addAutomation(workspaceId: string, rule: { trigger: string; conds: string[]; acts: string[] }): Promise<Automation> {
    const rawId = uid("a");
    const auto: Automation = { id: rawId, name: `${rule.trigger} → ${rule.acts[0] ?? ""}`, trigger: rule.trigger, conds: rule.conds, acts: rule.acts, enabled: true, runs: 0, last: "never", log: [] };
    // Newest first: shift existing sortOrders up by inserting at -1.
    await this.db.insert(s.automations).values({ id: `${workspaceId}_${rawId}`, workspaceId, name: auto.name, trigger: auto.trigger, conds: auto.conds, acts: auto.acts, enabled: true, runs: 0, last: "never", log: [], sortOrder: -1 });
    return auto;
  }

  async setAutomationEnabled(workspaceId: string, id: string, enabled: boolean): Promise<Automation> {
    const fullId = id.startsWith(workspaceId) ? id : `${workspaceId}_${id}`;
    await this.db.update(s.automations).set({ enabled }).where(and(eq(s.automations.workspaceId, workspaceId), eq(s.automations.id, fullId)));
    const [row] = await this.db.select().from(s.automations).where(eq(s.automations.id, fullId)).limit(1);
    if (!row) throw new NotFoundError(`Unknown automation ${id}`);
    return { id: stripPrefix(row.id, workspaceId), name: row.name, trigger: row.trigger, conds: row.conds, acts: row.acts, enabled: row.enabled, runs: row.runs, last: row.last, log: row.log };
  }

  async recordAutomationRun(workspaceId: string, id: string, run: AutomationRun): Promise<void> {
    const fullId = id.startsWith(workspaceId) ? id : `${workspaceId}_${id}`;
    const [row] = await this.db.select().from(s.automations).where(eq(s.automations.id, fullId)).limit(1);
    if (!row || !row.enabled) return;
    await this.db.update(s.automations).set({ runs: row.runs + 1, last: "just now", log: [run, ...row.log] }).where(eq(s.automations.id, fullId));
  }

  /* integrations / members / copilot ------------------------------------ */

  async patchIntegration(workspaceId: string, key: IntegrationKey, connected: boolean): Promise<Integration> {
    await this.db.update(s.integrations).set({ connected }).where(and(eq(s.integrations.workspaceId, workspaceId), eq(s.integrations.key, key)));
    const [row] = await this.db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, workspaceId), eq(s.integrations.key, key))).limit(1);
    if (!row) throw new NotFoundError(`Unknown integration ${key}`);
    return { key: row.key as IntegrationKey, name: row.name, glyph: row.glyph, fg: row.fg, desc: row.description, perms: row.perms, last: row.last, connected: row.connected, configurable: row.configurable };
  }

  async inviteMember(workspaceId: string, email: string, role: MemberRole): Promise<Member> {
    const local = email.split("@")[0] ?? "teammate";
    const userId = `u_${uid("u")}`;
    await this.db.insert(s.users).values({ id: userId, email: email.toLowerCase(), name: local.charAt(0).toUpperCase() + local.slice(1) }).onConflictDoNothing();
    await this.db.insert(s.memberships).values({ userId, workspaceId, role, status: "Invited", invitedEmail: email }).onConflictDoNothing();
    return { name: local.charAt(0).toUpperCase() + local.slice(1), email, role, init: local.charAt(0).toUpperCase(), status: "Invited" };
  }

  async patchCopilot(workspaceId: string, patch: Partial<CopilotSettings>): Promise<CopilotSettings> {
    await this.db.update(s.copilotSettings).set({
      ...(patch.tone && { tone: patch.tone }),
      ...(patch.risk && { risk: patch.risk }),
      ...(patch.threshold !== undefined && { threshold: patch.threshold }),
      ...(patch.approvals && { approvals: patch.approvals }),
      ...(patch.neverSay && { neverSay: patch.neverSay }),
    }).where(eq(s.copilotSettings.workspaceId, workspaceId));
    return this.getCopilot(workspaceId);
  }

  async appendAudit(workspaceId: string, event: { user: string; action: string; type: AuditEvent["type"] }): Promise<void> {
    await this.db.insert(s.auditEvents).values({ id: uid("au"), workspaceId, time: "just now", user: event.user, action: event.action, type: event.type });
  }

  /* website chat widget -------------------------------------------------- */

  async resolveSiteKey(siteKey: string): Promise<{ workspaceId: string; allowedOrigins: string[] } | null> {
    const [row] = await this.db.select().from(s.workspaces).where(eq(s.workspaces.widgetSiteKey, siteKey)).limit(1);
    return row && row.widgetEnabled ? { workspaceId: row.id, allowedOrigins: row.widgetAllowedOrigins ?? [] } : null;
  }

  async startWidgetConversation(
    workspaceId: string,
    visitor: { name?: string; email?: string },
    firstText: string,
  ): Promise<{ token: string; ticketId: string }> {
    const rawId = newTicketRawId();
    const ticket = buildWebTicket(rawId, visitor, firstText);
    await this.db.insert(s.tickets).values({
      id: `${workspaceId}_${rawId}`,
      workspaceId,
      customer: ticket.customer,
      channel: ticket.channel,
      subject: ticket.subject,
      preview: ticket.preview,
      priority: ticket.priority,
      tags: ticket.tags,
      status: ticket.status,
      stage: ticket.stage,
      assignee: ticket.assignee,
      slaMins: ticket.slaMins,
      slaTotal: ticket.slaTotal,
      unread: ticket.unread,
      time: ticket.time,
      conf: ticket.conf,
      archived: ticket.archived,
      messages: ticket.messages,
      draft: ticket.draft,
      sortOrder: -1,
    });
    const token = secureToken(24);
    await this.db.insert(s.widgetConversations).values({
      token,
      workspaceId,
      ticketId: `${workspaceId}_${rawId}`,
      visitorName: visitor.name?.trim() || null,
      visitorEmail: visitor.email?.trim() || null,
    });
    return { token, ticketId: rawId };
  }

  private async loadConvo(workspaceId: string, token: string) {
    const [conv] = await this.db
      .select()
      .from(s.widgetConversations)
      .where(and(eq(s.widgetConversations.token, token), eq(s.widgetConversations.workspaceId, workspaceId)))
      .limit(1);
    return conv;
  }

  async appendWidgetMessage(workspaceId: string, token: string, text: string): Promise<boolean> {
    const conv = await this.loadConvo(workspaceId, token);
    if (!conv) return false;
    const [row] = await this.db
      .select()
      .from(s.tickets)
      .where(and(eq(s.tickets.workspaceId, workspaceId), eq(s.tickets.id, conv.ticketId)))
      .limit(1);
    if (!row) return false;
    const t = rowToTicket(row);
    t.messages.push({ id: uid("m"), kind: "customer", author: conv.visitorName ?? t.customer.name, time: "just now", text });
    t.status = "open";
    t.stage = "new";
    t.unread = true;
    await this.saveTicket(workspaceId, t);
    return true;
  }

  async getWidgetTranscript(workspaceId: string, token: string): Promise<WidgetTranscriptMessage[] | null> {
    const conv = await this.loadConvo(workspaceId, token);
    if (!conv) return null;
    const [row] = await this.db
      .select()
      .from(s.tickets)
      .where(and(eq(s.tickets.workspaceId, workspaceId), eq(s.tickets.id, conv.ticketId)))
      .limit(1);
    if (!row) return null;
    return ticketToTranscript(rowToTicket(row).messages);
  }
}

/* helpers ---------------------------------------------------------------- */

function stripPrefix(id: string, workspaceId: string): string {
  return id.startsWith(`${workspaceId}_`) ? id.slice(workspaceId.length + 1) : id;
}

type TicketRow = typeof s.tickets.$inferSelect;

function rowToTicket(row: TicketRow): Ticket {
  const rawId = row.id.startsWith(`${row.workspaceId}_`) ? row.id.slice(row.workspaceId.length + 1) : row.id;
  return {
    id: rawId,
    customer: row.customer,
    channel: row.channel as Ticket["channel"],
    subject: row.subject,
    preview: row.preview,
    priority: row.priority as Ticket["priority"],
    tags: row.tags,
    status: row.status as Ticket["status"],
    stage: row.stage as Ticket["stage"],
    assignee: row.assignee as Ticket["assignee"],
    slaMins: row.slaMins,
    slaTotal: row.slaTotal,
    unread: row.unread,
    time: row.time,
    conf: row.conf,
    archived: row.archived,
    messages: row.messages as Message[],
    draft: row.draft as AIDraft | null,
    aiFailureReason: row.aiFailureReason ?? undefined,
  };
}

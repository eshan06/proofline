import type {
  AIDraft,
  AuditEvent,
  Automation,
  AutomationRun,
  CopilotSettings,
  Integration,
  IntegrationKey,
  KbDoc,
  Member,
  MemberRole,
  Notification,
  Ticket,
  TicketPatch,
  Workspace,
  DemoStep,
} from "@/lib/schemas";

export interface SessionInfo {
  id: string;
  type: "regular" | "demo";
  userId: string | null;
  workspaceId: string;
  aiCalls: number;
  demoSteps: Record<DemoStep, boolean>;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  emailVerified?: boolean;
}

export interface SubscriptionState {
  plan: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  seats: number;
  currentPeriodEnd: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Unix-seconds `created` of the last applied Stripe subscription event (ordering guard). */
  eventAt?: number;
}

export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    // Set explicitly so it can be recognized by name even when bundling
    // duplicates this module across alias (@/…) and relative (./…) imports,
    // which would otherwise make `instanceof` unreliable.
    this.name = "NotFoundError";
  }
}

/** Thrown when an action would exceed the workspace's paid seat limit (HTTP 402). */
export class SeatLimitError extends Error {
  constructor(message?: string) {
    super(message ?? "This workspace is at its seat limit.");
    this.name = "SeatLimitError";
  }
}

/** Thrown when an action would leave a workspace with no active Admin (HTTP 409). */
export class LastAdminError extends Error {
  constructor(message?: string) {
    super(message ?? "Cannot remove the last Admin from the workspace.");
    this.name = "LastAdminError";
  }
}

export type { WidgetTranscriptMessage } from "./web-ticket";
import type { WidgetTranscriptMessage } from "./web-ticket";
import type { InboundEmail } from "@/server/email/gmail";
import type { InboundSlackMessage, SlackAccount } from "@/server/slack/slack";

/** Persisted Gmail OAuth account for a workspace's support inbox. */
export interface GmailAccount {
  refreshToken: string;
  address: string;
}

/** Metadata for an email-channel ticket, used to thread an outbound reply. */
export interface EmailThreadRef {
  gmailThreadId: string;
  customerEmail: string;
  lastInboundMessageId: string | null;
}

export interface InboundEmailResult {
  ticketId: string;
  /** True when this email opened a new ticket (vs. appended to an existing thread). */
  created: boolean;
  /** True when the message was already ingested (deduped, no-op). */
  duplicate: boolean;
}

/** Channel-agnostic ingest result (shared by the email + Slack inbound paths). */
export type ChannelIngestResult = InboundEmailResult;

/** Metadata to post an outbound reply back into a Slack thread. */
export interface SlackThreadRef {
  channel: string;
  threadTs: string;
}

/**
 * The data boundary the whole app depends on. Two implementations exist —
 * in-memory (default; tests, demo, zero-setup dev) and Postgres (when
 * DATABASE_URL is set). Every business method is workspace-scoped, which is
 * how multi-tenancy is enforced: a caller can only touch its own workspace.
 */
export interface Repository {
  /* sessions */
  createSession(input: {
    type: "regular" | "demo";
    userId?: string | null;
    workspaceId: string;
  }): Promise<SessionInfo>;
  getSession(id: string): Promise<SessionInfo | null>;
  deleteSession(id: string): Promise<void>;
  /**
   * Reap expired sessions and abandoned demo workspaces (no membership, no live
   * session, older than the demo TTL). The workspace delete cascades to all its
   * child rows, including the seeded pgvector embeddings. For a scheduled job —
   * without it, every /demo visit leaks a workspace + its embeddings forever.
   */
  cleanupExpired(): Promise<{ sessionsDeleted: number; demoWorkspacesDeleted: number }>;
  /** false when a demo session has exhausted its AI budget. */
  consumeAiCall(sessionId: string): Promise<boolean>;
  completeDemoStep(sessionId: string, step: DemoStep): Promise<boolean>;

  /* auth + provisioning */
  createUserWithWorkspace(input: {
    email: string;
    name: string;
    passwordHash: string;
    workspaceName?: string;
  }): Promise<{ user: UserRecord; workspaceId: string }>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  getUser(userId: string): Promise<UserRecord | null>;
  membershipRole(userId: string, workspaceId: string): Promise<MemberRole | null>;

  /* account lifecycle: password reset + email verification */
  createPasswordReset(userId: string): Promise<string>;
  /** Consume a reset token (one-time): returns the userId, or null if invalid/expired. */
  consumePasswordReset(token: string): Promise<string | null>;
  setPassword(userId: string, passwordHash: string): Promise<void>;
  /** Invalidate all of a user's sessions (e.g. after a password reset). */
  deleteUserSessions(userId: string): Promise<void>;
  createEmailVerification(userId: string): Promise<string>;
  consumeEmailVerification(token: string): Promise<string | null>;
  markEmailVerified(userId: string): Promise<void>;
  /** Atomic: consume the token and mark the user verified in one transaction. Returns userId or null. */
  consumeEmailVerificationAtomic(token: string): Promise<string | null>;

  /* account deletion (GDPR / workspace teardown) */
  /** Delete a workspace and all its data (cascade). */
  deleteWorkspace(workspaceId: string): Promise<void>;
  /** Delete a user if they have no remaining workspace memberships. */
  deleteUserIfOrphaned(userId: string): Promise<void>;

  /* billing / subscription */
  getSubscription(workspaceId: string): Promise<SubscriptionState>;
  setSubscription(workspaceId: string, patch: Partial<SubscriptionState>): Promise<void>;
  /**
   * Idempotency guard for Stripe webhooks. Records the event id; returns true if
   * this id was not seen before (caller should process it) or false if it was
   * already processed (caller should skip). Atomic per event id.
   */
  markStripeEventProcessed(eventId: string, type: string): Promise<boolean>;
  /**
   * Compensating delete for markStripeEventProcessed: called when applying the
   * event failed after marking, so Stripe's redelivery is processed rather than
   * deduped away as a duplicate.
   */
  unmarkStripeEventProcessed(eventId: string): Promise<void>;
  /** Resolve the workspace owning a Stripe customer/subscription id, or null. */
  findWorkspaceByStripeIds(ids: { customerId?: string | null; subscriptionId?: string | null }): Promise<string | null>;
  /**
   * Atomic per-workspace daily AI-call budget. Increments today's counter only if
   * it is still under `dailyLimit`; returns true if allowed, false if the cap is
   * reached. Bounds vendor (LLM/embedding) spend per tenant.
   */
  consumeWorkspaceAiCall(workspaceId: string, dailyLimit: number): Promise<boolean>;
  /** Active + invited member count, for seat-limit enforcement. */
  countMembers(workspaceId: string): Promise<number>;
  /** Just the workspace's members — a light query, not the full getWorkspace fan-out. */
  listMembers(workspaceId: string): Promise<Member[]>;
  /** The user's primary (first) workspace id, or null if they have none. */
  primaryWorkspaceForUser(userId: string): Promise<string | null>;
  /** A fully-seeded throwaway workspace for an unauthenticated demo session. */
  createDemoWorkspace(): Promise<string>;

  /* workspace payload */
  getWorkspace(workspaceId: string): Promise<Workspace>;
  /** Light shell data (name + notifications) for fast first paint. */
  getShell(workspaceId: string): Promise<{ name: string; notifications: Notification[] }>;
  renameWorkspace(workspaceId: string, name: string): Promise<void>;
  getKbDocs(workspaceId: string): Promise<KbDoc[]>;
  getAutomations(workspaceId: string): Promise<Automation[]>;
  getCopilot(workspaceId: string): Promise<CopilotSettings>;

  /* tickets */
  findTicket(workspaceId: string, id: string): Promise<Ticket | null>;
  patchTicket(workspaceId: string, id: string, patch: TicketPatch, actor: string): Promise<Ticket>;
  addReply(workspaceId: string, id: string, text: string, viaAI: boolean, actor: string): Promise<Ticket>;
  addNote(workspaceId: string, id: string, text: string, actor: string): Promise<Ticket>;
  setDraft(workspaceId: string, id: string, draft: AIDraft): Promise<Ticket>;
  /** Persist the full mutated ticket (e.g. after automations change tags/status). */
  saveTicket(workspaceId: string, ticket: Ticket): Promise<void>;
  /**
   * Persist only the named scalar/array fields, leaving messages + draft as they
   * currently are. Use after a slow step (AI drafting) when a blind full-ticket
   * save would risk clobbering a message that arrived meanwhile.
   */
  saveTicketFields(
    workspaceId: string,
    id: string,
    fields: Partial<Pick<Ticket, "priority" | "assignee" | "tags" | "status" | "stage" | "unread">>,
  ): Promise<void>;

  /* knowledge base */
  addKbDoc(workspaceId: string, doc: Omit<KbDoc, "id">): Promise<KbDoc>;
  updateKbDoc(workspaceId: string, id: string, patch: Partial<KbDoc>): Promise<KbDoc>;
  /** Delete a KB doc and (via FK cascade) its embedded chunks. Workspace-scoped. */
  deleteKbDoc(workspaceId: string, id: string): Promise<void>;

  /* automations */
  addAutomation(
    workspaceId: string,
    rule: { trigger: string; conds: string[]; acts: string[] },
  ): Promise<Automation>;
  setAutomationEnabled(workspaceId: string, id: string, enabled: boolean): Promise<Automation>;
  recordAutomationRun(workspaceId: string, id: string, run: AutomationRun): Promise<void>;

  /* integrations / members / copilot */
  patchIntegration(workspaceId: string, key: IntegrationKey, connected: boolean): Promise<Integration>;
  inviteMember(workspaceId: string, email: string, role: MemberRole): Promise<Member>;
  /**
   * Invite a member, enforcing the seat limit atomically (count + insert in one
   * transaction / under a lock) so concurrent invites can't overrun the cap.
   * Throws SeatLimitError when at the limit.
   */
  inviteMemberGuarded(workspaceId: string, email: string, role: MemberRole, seatLimit: number): Promise<Member>;
  updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<Member>;
  /**
   * Change a member's role, guaranteeing the workspace keeps ≥1 active Admin.
   * Count + write happen atomically (serialized) to close the last-admin TOCTOU.
   * Throws LastAdminError if it would drop the last active Admin.
   */
  updateMemberRoleGuarded(workspaceId: string, userId: string, role: MemberRole): Promise<Member>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  /**
   * Remove a member, guaranteeing the workspace keeps ≥1 active Admin (atomic).
   * Throws LastAdminError if it would remove the last active Admin. Returns the
   * removed member's display name for the audit line.
   */
  removeMemberGuarded(workspaceId: string, userId: string): Promise<{ name: string }>;
  /**
   * Accept an invite for `email` on `workspaceId`.
   * - If `passwordHash` is supplied, a new user account is created (or an
   *   existing placeholder account gains a real password + updated name).
   * - The membership row for that email is flipped from "Invited" to "Active".
   * Returns the userId so the caller can start a session.
   */
  acceptInvite(input: {
    workspaceId: string;
    email: string;
    role: string;
    name?: string;
    passwordHash?: string;
    /**
     * When set, the acceptance is performed inside a transaction that re-checks
     * active seats against this limit and throws SeatLimitError if activating the
     * member would exceed it — closing the count-then-write race at accept time.
     * An invite token requires a still-pending Invited membership, making accept
     * effectively single-use (a removed/already-active member is rejected).
     */
    seatLimit?: number;
  }): Promise<{ userId: string }>;
  patchCopilot(workspaceId: string, patch: Partial<CopilotSettings>): Promise<CopilotSettings>;

  /* audit log — security-relevant actions are appended here */
  appendAudit(workspaceId: string, event: { user: string; action: string; type: AuditEvent["type"] }): Promise<void>;

  /**
   * End-customer PII captured through the chat widget / Gmail / Slack channels,
   * for a complete GDPR data export (getWorkspace alone omits these tables).
   * Workspace-scoped.
   */
  exportChannelData(workspaceId: string): Promise<{
    widgetConversations: { ticketId: string; visitorName: string | null; visitorEmail: string | null; createdAt?: string }[];
    emailThreads: { ticketId: string; customerEmail: string; gmailThreadId: string }[];
    slackThreads: { ticketId: string; channel: string; threadTs: string }[];
  }>;

  /* website chat widget (public intake) */
  /** Update the widget allowed-origin CORS list (and optionally enabled flag). */
  patchWidgetConfig(workspaceId: string, patch: { allowedOrigins?: string[]; enabled?: boolean }): Promise<void>;
  /** Resolve a public widget site key to its workspace + CORS allowlist, or null if unknown/disabled. */
  resolveSiteKey(siteKey: string): Promise<{ workspaceId: string; allowedOrigins: string[] } | null>;
  /** Open a new web-chat conversation (creates a ticket); returns the visitor's token + ticket id. */
  startWidgetConversation(
    workspaceId: string,
    visitor: { name?: string; email?: string },
    firstText: string,
  ): Promise<{ token: string; ticketId: string }>;
  /**
   * Append a visitor message to an existing conversation.
   * - "ok": appended. "unknown": token not found. "limit": the conversation has
   *   hit its per-conversation message cap (bounds O(n²) jsonb growth / abuse).
   */
  appendWidgetMessage(workspaceId: string, token: string, text: string): Promise<"ok" | "unknown" | "limit">;
  /** The visitor-facing transcript (customer + agent turns), or null if the token is unknown. */
  getWidgetTranscript(workspaceId: string, token: string): Promise<WidgetTranscriptMessage[] | null>;

  /* gmail email channel (dormant until an admin connects Google OAuth) */
  /** Which workspace owns inbound mail to this address (the connected support inbox), or null. */
  resolveGmailWorkspace(address: string): Promise<string | null>;
  /** The stored Gmail account for a workspace, or null if not connected. */
  getGmailAccount(workspaceId: string): Promise<GmailAccount | null>;
  /** Persist the Gmail OAuth account (refresh token + connected address). */
  setGmailAccount(workspaceId: string, account: GmailAccount): Promise<void>;
  /** Forget the Gmail account (on disconnect). */
  clearGmailAccount(workspaceId: string): Promise<void>;
  /** Ingest an inbound email: open a ticket for a new Gmail thread, or append to the existing one (deduped by messageId). */
  ingestInboundEmail(workspaceId: string, email: InboundEmail): Promise<InboundEmailResult>;
  /** Thread metadata for an email ticket (for In-Reply-To on agent replies), or null if not an email thread. */
  getEmailThread(workspaceId: string, ticketId: string): Promise<EmailThreadRef | null>;

  /* customers */
  appendCustomerNote(
    workspaceId: string,
    customerId: string,
    note: { author: string; text: string },
  ): Promise<void>;

  /* slack email channel (dormant until an admin installs the Slack app) */
  /** Which workspace owns the given Slack team (workspace install), or null. */
  resolveSlackWorkspace(teamId: string): Promise<string | null>;
  getSlackAccount(workspaceId: string): Promise<SlackAccount | null>;
  setSlackAccount(workspaceId: string, account: SlackAccount): Promise<void>;
  clearSlackAccount(workspaceId: string): Promise<void>;
  /** Ingest an inbound Slack message: open a ticket for a new thread, or append (deduped by event ts). */
  ingestSlackMessage(workspaceId: string, msg: InboundSlackMessage): Promise<ChannelIngestResult>;
  /** (channel, threadTs) for a Slack ticket so an agent reply posts back, or null if not a Slack thread. */
  getSlackThread(workspaceId: string, ticketId: string): Promise<SlackThreadRef | null>;
}

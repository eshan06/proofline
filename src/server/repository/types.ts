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

  /* account deletion (GDPR / workspace teardown) */
  /** Delete a workspace and all its data (cascade). */
  deleteWorkspace(workspaceId: string): Promise<void>;
  /** Delete a user if they have no remaining workspace memberships. */
  deleteUserIfOrphaned(userId: string): Promise<void>;

  /* billing / subscription */
  getSubscription(workspaceId: string): Promise<SubscriptionState>;
  setSubscription(workspaceId: string, patch: Partial<SubscriptionState>): Promise<void>;
  /** Active + invited member count, for seat-limit enforcement. */
  countMembers(workspaceId: string): Promise<number>;
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
  patchCopilot(workspaceId: string, patch: Partial<CopilotSettings>): Promise<CopilotSettings>;

  /* audit log — security-relevant actions are appended here */
  appendAudit(workspaceId: string, event: { user: string; action: string; type: AuditEvent["type"] }): Promise<void>;

  /* website chat widget (public intake) */
  /** Resolve a public widget site key to its workspace + CORS allowlist, or null if unknown/disabled. */
  resolveSiteKey(siteKey: string): Promise<{ workspaceId: string; allowedOrigins: string[] } | null>;
  /** Open a new web-chat conversation (creates a ticket); returns the visitor's token + ticket id. */
  startWidgetConversation(
    workspaceId: string,
    visitor: { name?: string; email?: string },
    firstText: string,
  ): Promise<{ token: string; ticketId: string }>;
  /** Append a visitor message to an existing conversation. False if the token is unknown. */
  appendWidgetMessage(workspaceId: string, token: string, text: string): Promise<boolean>;
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

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
  /** The user's primary (first) workspace id, or null if they have none. */
  primaryWorkspaceForUser(userId: string): Promise<string | null>;
  /** A fully-seeded throwaway workspace for an unauthenticated demo session. */
  createDemoWorkspace(): Promise<string>;

  /* workspace payload */
  getWorkspace(workspaceId: string): Promise<Workspace>;
  getKbDocs(workspaceId: string): Promise<KbDoc[]>;
  getAutomations(workspaceId: string): Promise<Automation[]>;
  getCopilot(workspaceId: string): Promise<CopilotSettings>;

  /* tickets */
  findTicket(workspaceId: string, id: string): Promise<Ticket | null>;
  patchTicket(workspaceId: string, id: string, patch: TicketPatch, actor: string): Promise<Ticket>;
  addReply(workspaceId: string, id: string, text: string, viaAI: boolean, actor: string): Promise<Ticket>;
  addNote(workspaceId: string, id: string, text: string, actor: string): Promise<Ticket>;
  setDraft(workspaceId: string, id: string, draft: AIDraft): Promise<Ticket>;

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
}

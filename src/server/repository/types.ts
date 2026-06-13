import type {
  AIDraft,
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
}

export class NotFoundError extends Error {}

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
  membershipRole(userId: string, workspaceId: string): Promise<MemberRole | null>;
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
  patchTicket(workspaceId: string, id: string, patch: TicketPatch): Promise<Ticket>;
  addReply(workspaceId: string, id: string, text: string, viaAI: boolean): Promise<Ticket>;
  addNote(workspaceId: string, id: string, text: string): Promise<Ticket>;
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
}

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Core enums                                                         */
/* ------------------------------------------------------------------ */

export const channelSchema = z.enum(["web", "email", "slack"]);
export type Channel = z.infer<typeof channelSchema>;

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type Priority = z.infer<typeof prioritySchema>;

export const ticketStatusSchema = z.enum(["open", "waiting", "escalated", "closed"]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const boardStageSchema = z.enum(["new", "waiting", "inprogress", "escalated", "resolved"]);
export type BoardStage = z.infer<typeof boardStageSchema>;

export const agentNameSchema = z.enum(["Eshan", "Maya", "Leo"]);
export type AgentName = z.infer<typeof agentNameSchema>;

export const toneSchema = z.enum(["concise", "empathetic"]);
export type Tone = z.infer<typeof toneSchema>;

export const draftVariantSchema = z.enum(["base", "regen", "concise", "empathetic"]);
export type DraftVariant = z.infer<typeof draftVariantSchema>;

/* ------------------------------------------------------------------ */
/*  Tickets & messages                                                 */
/* ------------------------------------------------------------------ */

export const messageSchema = z.object({
  id: z.string(),
  kind: z.enum(["customer", "agent", "note", "status"]),
  author: z.string().optional(),
  time: z.string().default(""),
  text: z.string(),
  viaAI: z.boolean().optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const citationSchema = z.object({
  title: z.string(),
  path: z.string(),
  snippet: z.string(),
  uses: z.number(),
});
export type Citation = z.infer<typeof citationSchema>;

export const aiDraftSchema = z.object({
  /** Current draft text (varies with the active variant / saved edits). */
  text: z.string(),
  confidence: z.number(),
  confMeta: z.string(),
  citations: z.array(citationSchema),
  reasoning: z.string(),
  actions: z.array(z.string()),
  variant: draftVariantSchema,
  alternates: z.object({
    base: z.string(),
    regen: z.string(),
    concise: z.string(),
    empathetic: z.string(),
  }),
});
export type AIDraft = z.infer<typeof aiDraftSchema>;

export const ticketCustomerSchema = z.object({
  name: z.string(),
  company: z.string(),
  initials: z.string(),
  hue: z.number(),
});

export const ticketSchema = z.object({
  id: z.string(),
  customer: ticketCustomerSchema,
  channel: channelSchema,
  subject: z.string(),
  preview: z.string(),
  priority: prioritySchema,
  tags: z.array(z.string()),
  status: ticketStatusSchema,
  stage: boardStageSchema,
  assignee: agentNameSchema.nullable(),
  slaMins: z.number(),
  slaTotal: z.number(),
  unread: z.boolean(),
  time: z.string(),
  conf: z.number().nullable(),
  archived: z.boolean(),
  messages: z.array(messageSchema),
  draft: aiDraftSchema.nullable(),
  aiFailureReason: z.string().optional(),
});
export type Ticket = z.infer<typeof ticketSchema>;

/* ------------------------------------------------------------------ */
/*  Customers                                                          */
/* ------------------------------------------------------------------ */

export const customerNoteSchema = z.object({
  author: z.string(),
  time: z.string(),
  text: z.string(),
});

export const sentimentSchema = z.enum(["Stressed", "Neutral", "Satisfied", "Delighted", "Evaluating"]);
export type Sentiment = z.infer<typeof sentimentSchema>;

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  init: z.string(),
  hue: z.number(),
  email: z.string(),
  plan: z.string(),
  mrr: z.string(),
  since: z.string(),
  loc: z.string(),
  seats: z.string(),
  lastActive: z.string(),
  convos: z.number(),
  sentiment: sentimentSchema,
  notes: z.array(customerNoteSchema),
});
export type Customer = z.infer<typeof customerSchema>;

/* ------------------------------------------------------------------ */
/*  Knowledge base                                                     */
/* ------------------------------------------------------------------ */

export const kbStatusSchema = z.enum(["indexed", "processing", "failed"]);
export type KbStatus = z.infer<typeof kbStatusSchema>;

export const kbDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  status: kbStatusSchema,
  chunks: z.string(),
  cited: z.string(),
  synced: z.string(),
});
export type KbDoc = z.infer<typeof kbDocSchema>;

/* ------------------------------------------------------------------ */
/*  Automations                                                        */
/* ------------------------------------------------------------------ */

export const automationRunSchema = z.object({
  time: z.string(),
  text: z.string(),
  ok: z.boolean(),
});
export type AutomationRun = z.infer<typeof automationRunSchema>;

export const automationSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: z.string(),
  conds: z.array(z.string()),
  acts: z.array(z.string()),
  enabled: z.boolean(),
  runs: z.number(),
  last: z.string(),
  log: z.array(automationRunSchema),
});
export type Automation = z.infer<typeof automationSchema>;

/* ------------------------------------------------------------------ */
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

export const analyticsRangeKeySchema = z.enum(["7d", "14d", "30d"]);
export type AnalyticsRangeKey = z.infer<typeof analyticsRangeKeySchema>;

export const analyticsRangeSchema = z.object({
  l0: z.string(),
  l1: z.string(),
  metrics: z.array(z.tuple([z.string(), z.string(), z.string(), z.string()])),
  vol: z.array(z.tuple([z.number(), z.number()])),
  frt: z.array(z.number()),
  dist: z.array(z.number()),
  tags: z.array(z.tuple([z.string(), z.number()])),
  docs: z.array(z.tuple([z.string(), z.number()])),
  lead: z.array(z.tuple([z.string(), z.number(), z.string(), z.string()])),
});
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

/* ------------------------------------------------------------------ */
/*  Integrations                                                       */
/* ------------------------------------------------------------------ */

export const integrationKeySchema = z.enum([
  "webchat", "gmail", "slack", "twilio", "notion", "gdocs", "github", "stripe", "linear", "zapier",
]);
export type IntegrationKey = z.infer<typeof integrationKeySchema>;

export const integrationSchema = z.object({
  key: integrationKeySchema,
  name: z.string(),
  glyph: z.string(),
  fg: z.string(),
  desc: z.string(),
  perms: z.string(),
  last: z.string(),
  connected: z.boolean(),
  configurable: z.boolean(),
});
export type Integration = z.infer<typeof integrationSchema>;

/* ------------------------------------------------------------------ */
/*  Team / audit / notifications                                       */
/* ------------------------------------------------------------------ */

export const memberRoleSchema = z.enum(["Admin", "Agent", "Viewer"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const memberSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: memberRoleSchema,
  init: z.string(),
  status: z.enum(["Active", "Invited"]),
});
export type Member = z.infer<typeof memberSchema>;

export const auditEventSchema = z.object({
  time: z.string(),
  user: z.string(),
  action: z.string(),
  type: z.enum(["AI", "Team", "Integrations", "Security"]),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const notificationSchema = z.object({
  c: z.string(),
  text: z.string(),
  time: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

/* ------------------------------------------------------------------ */
/*  Copilot settings                                                   */
/* ------------------------------------------------------------------ */

export const copilotSettingsSchema = z.object({
  tone: z.enum(["Friendly", "Concise", "Formal", "Technical"]),
  risk: z.enum(["conservative", "balanced", "autonomous"]),
  threshold: z.number().min(40).max(95),
  approvals: z.object({ low: z.boolean(), refund: z.boolean(), all: z.boolean() }),
  neverSay: z.array(z.string()),
});
export type CopilotSettings = z.infer<typeof copilotSettingsSchema>;

/* ------------------------------------------------------------------ */
/*  Demo mode                                                          */
/* ------------------------------------------------------------------ */

export const demoStepSchema = z.enum(["draft", "send", "upload", "connect", "palette"]);
export type DemoStep = z.infer<typeof demoStepSchema>;

export const demoStateSchema = z.object({
  active: z.boolean(),
  steps: z.record(demoStepSchema, z.boolean()),
});
export type DemoState = z.infer<typeof demoStateSchema>;

/* ------------------------------------------------------------------ */
/*  Workspace payload (GET /api/workspace)                             */
/* ------------------------------------------------------------------ */

export const workspaceSchema = z.object({
  name: z.string(),
  tickets: z.array(ticketSchema),
  customers: z.array(customerSchema),
  kbDocs: z.array(kbDocSchema),
  automations: z.array(automationSchema),
  integrations: z.array(integrationSchema),
  members: z.array(memberSchema),
  audit: z.array(auditEventSchema),
  notifications: z.array(notificationSchema),
  copilot: copilotSettingsSchema,
  demo: demoStateSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;

/* ------------------------------------------------------------------ */
/*  API request bodies                                                 */
/* ------------------------------------------------------------------ */

export const ticketPatchSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: prioritySchema.optional(),
  assignee: agentNameSchema.nullable().optional(),
  addTag: z.string().optional(),
});
export type TicketPatch = z.infer<typeof ticketPatchSchema>;

export const postMessageSchema = z.object({
  kind: z.enum(["reply", "note"]),
  text: z.string().min(1),
  viaAI: z.boolean().optional(),
});

export const draftActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("regenerate") }),
  z.object({ action: z.literal("tone"), tone: toneSchema }),
  z.object({ action: z.literal("edit"), text: z.string() }),
]);
export type DraftAction = z.infer<typeof draftActionSchema>;

export const playgroundRequestSchema = z.object({
  question: z.string().min(1),
});

export const playgroundResultSchema = z.object({
  conf: z.number().nullable(),
  text: z.string(),
  cites: z.array(z.string()),
});
export type PlaygroundResult = z.infer<typeof playgroundResultSchema>;

export const createAutomationSchema = z.object({
  trigger: z.string().min(1),
  conds: z.array(z.string()),
  acts: z.array(z.string().min(1)).min(1),
});

export const automationPatchSchema = z.object({
  enabled: z.boolean(),
});

export const integrationPatchSchema = z.object({
  connected: z.boolean(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema,
});

export const copilotPatchSchema = copilotSettingsSchema.partial();

export const eventSchema = z.object({
  name: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

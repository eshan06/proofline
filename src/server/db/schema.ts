import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  vector,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Relational schema for Proofline. Multi-tenant: every business row carries a
 * `workspaceId` and all queries are scoped to it (see repository/pg). Nested
 * value objects that are always read/written with their parent (a draft's
 * citations, an automation's condition list) are stored as jsonb; things that
 * are appended over time (messages, automation runs, kb chunks) are their own
 * tables.
 *
 * The kb_chunks embedding dimension is EMBEDDING_DIM (default 384). Switching
 * embedding providers changes the dimension and requires a re-index — standard
 * for any RAG system.
 */

export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM) || 384;

/* ---------------------------------------------------------------- identity */

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("Growth"),
  // Billing / subscription state (synced from the billing provider's webhook).
  subscriptionStatus: text("subscription_status").notNull().default("active"), // active|trialing|past_due|canceled
  seats: integer("seats").notNull().default(3),
  currentPeriodEnd: text("current_period_end").notNull().default(""),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Website chat widget: a public (non-secret) site key identifies the tenant
  // in the embed script; allowed origins gate cross-origin intake (CORS).
  widgetSiteKey: text("widget_site_key").unique(),
  widgetEnabled: boolean("widget_enabled").notNull().default(true),
  widgetAllowedOrigins: jsonb("widget_allowed_origins").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("Agent"), // Admin | Agent | Viewer
    status: text("status").notNull().default("Active"), // Active | Invited
    invitedEmail: text("invited_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("regular"), // regular | demo
    aiCalls: integer("ai_calls").notNull().default(0),
    demoSteps: jsonb("demo_steps").$type<Record<string, boolean>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const emailVerifications = pgTable("email_verifications", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Website chat widget conversations. The `token` is an unguessable per-visitor
 * key held only by that visitor's browser — it is how an *unauthenticated*
 * widget addresses its ticket without being able to read anyone else's (the
 * human ticket id is never exposed to the widget).
 */
export const widgetConversations = pgTable(
  "widget_conversations",
  {
    token: text("token").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id").notNull(),
    visitorName: text("visitor_name"),
    visitorEmail: text("visitor_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("widget_convos_ws_idx").on(t.workspaceId)],
);

/* ---------------------------------------------------------------- support data */

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company").notNull(),
    init: text("init").notNull(),
    hue: integer("hue").notNull(),
    email: text("email").notNull(),
    plan: text("plan").notNull(),
    mrr: text("mrr").notNull(),
    since: text("since").notNull(),
    loc: text("loc").notNull(),
    seats: text("seats").notNull(),
    lastActive: text("last_active").notNull(),
    convos: integer("convos").notNull().default(0),
    sentiment: text("sentiment").notNull(),
    notes: jsonb("notes").$type<{ author: string; time: string; text: string }[]>().notNull().default([]),
  },
  (t) => [index("customers_ws_idx").on(t.workspaceId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    customer: jsonb("customer").$type<{ name: string; company: string; initials: string; hue: number }>().notNull(),
    channel: text("channel").notNull(),
    subject: text("subject").notNull(),
    preview: text("preview").notNull().default(""),
    priority: text("priority").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull(),
    stage: text("stage").notNull(),
    assignee: text("assignee"),
    slaMins: integer("sla_mins").notNull().default(0),
    slaTotal: integer("sla_total").notNull().default(0),
    unread: boolean("unread").notNull().default(false),
    time: text("time").notNull().default(""),
    conf: doublePrecision("conf"),
    archived: boolean("archived").notNull().default(false),
    messages: jsonb("messages").$type<unknown[]>().notNull().default([]),
    draft: jsonb("draft"), // AIDraft | null
    aiFailureReason: text("ai_failure_reason"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("tickets_ws_idx").on(t.workspaceId)],
);

export const kbDocs = pgTable(
  "kb_docs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    chunks: text("chunks").notNull().default("0"),
    cited: text("cited").notNull().default("0"),
    synced: text("synced").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("kb_docs_ws_idx").on(t.workspaceId)],
);

export const kbChunks = pgTable(
  "kb_chunks",
  {
    id: text("id").primaryKey(),
    docId: text("doc_id").notNull().references(() => kbDocs.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    docTitle: text("doc_title").notNull(),
    path: text("path").notNull().default(""),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  },
  (t) => [
    index("kb_chunks_ws_idx").on(t.workspaceId),
    index("kb_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(),
    conds: jsonb("conds").$type<string[]>().notNull().default([]),
    acts: jsonb("acts").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    runs: integer("runs").notNull().default(0),
    last: text("last").notNull().default("never"),
    log: jsonb("log").$type<{ time: string; text: string; ok: boolean }[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("automations_ws_idx").on(t.workspaceId)],
);

export const integrations = pgTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    glyph: text("glyph").notNull(),
    fg: text("fg").notNull(),
    description: text("description").notNull(),
    perms: text("perms").notNull().default(""),
    last: text("last").notNull().default(""),
    connected: boolean("connected").notNull().default(false),
    configurable: boolean("configurable").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("integrations_ws_idx").on(t.workspaceId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    time: text("time").notNull(),
    user: text("user").notNull(),
    action: text("action").notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_ws_idx").on(t.workspaceId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    color: text("color").notNull(),
    text: text("text").notNull(),
    time: text("time").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("notifications_ws_idx").on(t.workspaceId)],
);

export const copilotSettings = pgTable("copilot_settings", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  tone: text("tone").notNull().default("Friendly"),
  risk: text("risk").notNull().default("balanced"),
  threshold: integer("threshold").notNull().default(70),
  approvals: jsonb("approvals").$type<{ low: boolean; refund: boolean; all: boolean }>().notNull(),
  neverSay: jsonb("never_say").$type<string[]>().notNull().default([]),
});

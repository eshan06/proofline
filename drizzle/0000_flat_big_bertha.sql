CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"time" text NOT NULL,
	"user" text NOT NULL,
	"action" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"conds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"last" text DEFAULT 'never' NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_settings" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"tone" text DEFAULT 'Friendly' NOT NULL,
	"risk" text DEFAULT 'balanced' NOT NULL,
	"threshold" integer DEFAULT 70 NOT NULL,
	"approvals" jsonb NOT NULL,
	"never_say" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"init" text NOT NULL,
	"hue" integer NOT NULL,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"mrr" text NOT NULL,
	"since" text NOT NULL,
	"loc" text NOT NULL,
	"seats" text NOT NULL,
	"last_active" text NOT NULL,
	"convos" integer DEFAULT 0 NOT NULL,
	"sentiment" text NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"glyph" text NOT NULL,
	"fg" text NOT NULL,
	"description" text NOT NULL,
	"perms" text DEFAULT '' NOT NULL,
	"last" text DEFAULT '' NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"configurable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"doc_title" text NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384)
);
--> statement-breakpoint
CREATE TABLE "kb_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"chunks" text DEFAULT '0' NOT NULL,
	"cited" text DEFAULT '0' NOT NULL,
	"synced" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"role" text DEFAULT 'Agent' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"invited_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"color" text NOT NULL,
	"text" text NOT NULL,
	"time" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"workspace_id" text,
	"type" text DEFAULT 'regular' NOT NULL,
	"ai_calls" integer DEFAULT 0 NOT NULL,
	"demo_steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"customer" jsonb NOT NULL,
	"channel" text NOT NULL,
	"subject" text NOT NULL,
	"preview" text DEFAULT '' NOT NULL,
	"priority" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"assignee" text,
	"sla_mins" integer DEFAULT 0 NOT NULL,
	"sla_total" integer DEFAULT 0 NOT NULL,
	"unread" boolean DEFAULT false NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"conf" double precision,
	"archived" boolean DEFAULT false NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" jsonb,
	"ai_failure_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'Growth' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_settings" ADD CONSTRAINT "copilot_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_doc_id_kb_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."kb_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_docs" ADD CONSTRAINT "kb_docs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_ws_idx" ON "audit_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "automations_ws_idx" ON "automations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "customers_ws_idx" ON "customers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "integrations_ws_idx" ON "integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_ws_idx" ON "kb_chunks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "kb_docs_ws_idx" ON "kb_docs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_ws_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tickets_ws_idx" ON "tickets" USING btree ("workspace_id");
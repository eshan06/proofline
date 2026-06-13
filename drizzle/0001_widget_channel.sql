CREATE TABLE "widget_conversations" (
	"token" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"visitor_name" text,
	"visitor_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_site_key" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill a unique public site key for any workspace that predates this column,
-- so the website chat widget works for existing tenants too. md5(random()||id) is
-- 32 hex chars (matching secureToken(16)); seeding `id` guarantees distinctness for
-- the UNIQUE constraint below. Must run BEFORE the constraint is added.
UPDATE "workspaces" SET "widget_site_key" = md5(random()::text || "id") WHERE "widget_site_key" IS NULL;--> statement-breakpoint
ALTER TABLE "widget_conversations" ADD CONSTRAINT "widget_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "widget_convos_ws_idx" ON "widget_conversations" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_widget_site_key_unique" UNIQUE("widget_site_key");
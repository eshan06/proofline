CREATE TABLE "slack_threads" (
	"workspace_id" text NOT NULL,
	"channel" text NOT NULL,
	"thread_ts" text NOT NULL,
	"ticket_id" text NOT NULL,
	"seen_event_ts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slack_threads_workspace_id_channel_thread_ts_pk" PRIMARY KEY("workspace_id","channel","thread_ts")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "slack_team_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "slack_team_name" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "slack_bot_token" text;--> statement-breakpoint
ALTER TABLE "slack_threads" ADD CONSTRAINT "slack_threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_threads_ticket_idx" ON "slack_threads" USING btree ("workspace_id","ticket_id");
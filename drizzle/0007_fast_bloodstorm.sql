CREATE TABLE "ai_usage" (
	"workspace_id" text NOT NULL,
	"day" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_workspace_id_day_pk" PRIMARY KEY("workspace_id","day")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "subscription_event_at" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
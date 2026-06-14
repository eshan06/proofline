CREATE TABLE "email_threads" (
	"workspace_id" text NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"customer_email" text NOT NULL,
	"last_inbound_message_id" text,
	"seen_message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_threads_workspace_id_gmail_thread_id_pk" PRIMARY KEY("workspace_id","gmail_thread_id")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "gmail_address" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "gmail_refresh_token" text;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_threads_ticket_idx" ON "email_threads" USING btree ("workspace_id","ticket_id");
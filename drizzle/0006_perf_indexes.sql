CREATE INDEX "memberships_ws_idx" ON "memberships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaces_gmail_address_idx" ON "workspaces" USING btree ("gmail_address");--> statement-breakpoint
CREATE INDEX "workspaces_slack_team_idx" ON "workspaces" USING btree ("slack_team_id");
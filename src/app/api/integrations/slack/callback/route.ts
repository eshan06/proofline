import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { slack, slackRedirectUri } from "@/server/slack/slack";
import { authorizeSlackAdmin, SLACK_STATE_COOKIE } from "@/server/slack/slack-oauth";
import { repo } from "@/server/repository";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/**
 * Slack OAuth callback. Verifies the CSRF state cookie, exchanges the code for a
 * bot token + team identity, stores them on the workspace, marks the Slack
 * integration connected, and audits it.
 */
export async function GET(req: Request) {
  const auth = await authorizeSlackAdmin();
  if ("redirect" in auth) return NextResponse.redirect(new URL(auth.redirect, req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get(SLACK_STATE_COOKIE)?.value;

  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?slack=${status}`, req.url));
    res.cookies.delete(SLACK_STATE_COOKIE);
    return res;
  };

  if (url.searchParams.get("error")) return done("denied");
  if (!code || !state || !expected || state !== expected) return done("error");

  try {
    const account = await slack().exchangeCode(code, slackRedirectUri());
    const r = repo();
    await r.setSlackAccount(auth.workspaceId, account);
    await r.patchIntegration(auth.workspaceId, "slack", true);
    await r.appendAudit(auth.workspaceId, {
      user: "Admin",
      action: `Connected Slack${account.teamName ? ` (${account.teamName})` : ""}`,
      type: "Integrations",
    });
    logger.info("slack.connected", { workspaceId: auth.workspaceId, teamId: account.teamId });
    return done("connected");
  } catch (err) {
    logger.reportError("slack.connect_failed", err, { workspaceId: auth.workspaceId });
    return done("error");
  }
}

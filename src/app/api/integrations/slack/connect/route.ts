import { NextResponse } from "next/server";
import { slack, slackRedirectUri } from "@/server/slack/slack";
import { authorizeSlackAdmin, SLACK_STATE_COOKIE, slackStateCookieOpts } from "@/server/slack/slack-oauth";
import { secureToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Start the Slack app install (OAuth v2). An admin hits this; we mint a CSRF
 * state, stash it in an httpOnly cookie (double-submit), and redirect to Slack's
 * authorize screen. The callback verifies the state.
 */
export async function GET(req: Request) {
  const auth = await authorizeSlackAdmin();
  if ("redirect" in auth) return NextResponse.redirect(new URL(auth.redirect, req.url));

  const s = slack();
  if (!s.canInstall) return NextResponse.redirect(new URL("/integrations?slack=unconfigured", req.url));

  const state = secureToken(16);
  const res = NextResponse.redirect(s.getInstallUrl(state, slackRedirectUri()));
  res.cookies.set(SLACK_STATE_COOKIE, state, slackStateCookieOpts);
  return res;
}

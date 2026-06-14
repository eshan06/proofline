import { NextResponse } from "next/server";
import { gmail } from "@/server/email/gmail";
import { authorizeGmailAdmin, GMAIL_STATE_COOKIE, stateCookieOpts } from "@/server/email/gmail-oauth";
import { secureToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Start the Gmail OAuth connect flow. An admin hits this (top-level navigation);
 * we mint a CSRF state, stash it in an httpOnly cookie (double-submit), and
 * redirect to Google's consent screen. The callback verifies the state.
 */
export async function GET(req: Request) {
  const auth = await authorizeGmailAdmin();
  if ("redirect" in auth) return NextResponse.redirect(new URL(auth.redirect, req.url));

  const g = gmail();
  if (!g.enabled) return NextResponse.redirect(new URL("/integrations?gmail=unconfigured", req.url));

  const state = secureToken(16);
  const res = NextResponse.redirect(g.getAuthUrl(state));
  res.cookies.set(GMAIL_STATE_COOKIE, state, stateCookieOpts);
  return res;
}

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gmail } from "@/server/email/gmail";
import { authorizeGmailAdmin, GMAIL_STATE_COOKIE } from "@/server/email/gmail-oauth";
import { repo } from "@/server/repository";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/**
 * Google OAuth callback. Verifies the CSRF state cookie, exchanges the code for
 * a refresh token + the connected mailbox address, stores them on the workspace,
 * marks the Gmail integration connected, and audits it.
 */
export async function GET(req: Request) {
  const auth = await authorizeGmailAdmin();
  if ("redirect" in auth) return NextResponse.redirect(new URL(auth.redirect, req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get(GMAIL_STATE_COOKIE)?.value;

  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?gmail=${status}`, req.url));
    res.cookies.delete(GMAIL_STATE_COOKIE);
    return res;
  };

  if (url.searchParams.get("error")) return done("denied"); // user declined consent
  const stateOk =
    !!state && !!expected && state.length === expected.length && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!code || !stateOk) return done("error");

  try {
    const { refreshToken, email } = await gmail().exchangeCode(code);
    const r = repo();
    await r.setGmailAccount(auth.workspaceId, { refreshToken, address: email });
    await r.patchIntegration(auth.workspaceId, "gmail", true);
    await r.appendAudit(auth.workspaceId, {
      user: "Admin",
      action: `Connected Gmail${email ? ` (${email})` : ""}`,
      type: "Integrations",
    });
    logger.info("gmail.connected", { workspaceId: auth.workspaceId });
    return done("connected");
  } catch (err) {
    logger.reportError("gmail.connect_failed", err, { workspaceId: auth.workspaceId });
    return done("error");
  }
}

import { NextResponse } from "next/server";
import { repo } from "@/server/repository";
import { startRegularSession } from "@/server/session";

/**
 * Email-verification link target (GET, clicked from the inbox). Atomically
 * consumes the one-time token, marks the account verified, then starts a
 * session so the user lands logged in — no extra sign-in step.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "");
  if (token) {
    const r = repo();
    // Atomic: token consumption and account marking in one transaction so a
    // mid-flight failure can't leave the token consumed but the user unverified.
    const userId = await r.consumeEmailVerificationAtomic(token);
    if (userId) {
      const workspaceId = await r.primaryWorkspaceForUser(userId);
      if (workspaceId) {
        await startRegularSession(userId, workspaceId);
      }
      return NextResponse.redirect(`${base}/home?verified=1`);
    }
  }
  return NextResponse.redirect(`${base}/signin?verify=failed`);
}

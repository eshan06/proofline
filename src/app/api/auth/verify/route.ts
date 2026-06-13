import { NextResponse } from "next/server";
import { repo } from "@/server/repository";

/**
 * Email-verification link target (GET, clicked from the inbox). Consumes the
 * one-time token, marks the account verified, and redirects into the app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "");
  if (token) {
    const userId = await repo().consumeEmailVerification(token);
    if (userId) {
      await repo().markEmailVerified(userId);
      return NextResponse.redirect(`${base}/home?verified=1`);
    }
  }
  return NextResponse.redirect(`${base}/signin?verify=failed`);
}

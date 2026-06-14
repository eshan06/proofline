import { repo } from "@/server/repository";
import { currentSession } from "@/server/session";

export const GMAIL_STATE_COOKIE = "gmail_oauth_state";

/**
 * Authorize an admin for the Gmail connect/callback flow. Returns the workspace
 * id on success, or a `redirect` path the route should send the browser to
 * (these are top-level navigations, so we redirect rather than return JSON).
 */
export async function authorizeGmailAdmin(): Promise<{ workspaceId: string } | { redirect: string }> {
  const session = await currentSession();
  if (!session) return { redirect: "/signin" };
  // Real users must be Admins; demo/anonymous sessions are unrestricted in their sandbox.
  if (session.userId) {
    const role = await repo().membershipRole(session.userId, session.workspaceId);
    if (role !== "Admin") return { redirect: "/integrations?gmail=forbidden" };
  }
  return { workspaceId: session.workspaceId };
}

export const stateCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

import { repo } from "@/server/repository";
import { currentSession } from "@/server/session";

export const SLACK_STATE_COOKIE = "slack_oauth_state";

/**
 * Authorize an admin for the Slack install/callback flow. Returns the workspace
 * id, or a `redirect` path (these are top-level navigations, so we redirect
 * rather than return JSON). Mirrors the Gmail connect guard.
 */
export async function authorizeSlackAdmin(): Promise<{ workspaceId: string } | { redirect: string }> {
  const session = await currentSession();
  if (!session) return { redirect: "/signin" };
  if (session.userId) {
    const role = await repo().membershipRole(session.userId, session.workspaceId);
    if (role !== "Admin") return { redirect: "/integrations?slack=forbidden" };
  }
  return { workspaceId: session.workspaceId };
}

export const slackStateCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

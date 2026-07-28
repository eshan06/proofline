import { cookies } from "next/headers";
import { repo, type SessionInfo } from "@/server/repository";
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from "@/lib/session-cookie";

export { SESSION_COOKIE };

const cookieOpts = (type: "regular" | "demo") => sessionCookieOptions(SESSION_MAX_AGE[type]);

/** Read the current session (RSC / route handlers). Null when signed out. */
export async function currentSession(): Promise<SessionInfo | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return repo().getSession(id);
}

/** Establish a regular session for a signed-in user. */
export async function startRegularSession(userId: string, workspaceId: string): Promise<SessionInfo> {
  const session = await repo().createSession({ type: "regular", userId, workspaceId });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, cookieOpts("regular"));
  return session;
}

/** Mint an unauthenticated demo sandbox session over a fresh seeded workspace. */
export async function startDemoSession(): Promise<SessionInfo> {
  const workspaceId = await repo().createDemoWorkspace();
  const session = await repo().createSession({ type: "demo", workspaceId });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, cookieOpts("demo"));
  return session;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await repo().deleteSession(id);
  jar.delete(SESSION_COOKIE);
}

import { redirect } from "next/navigation";
import { currentSession, startDemoSession } from "@/server/session";
import { repo, type SessionInfo } from "@/server/repository";
import { hasDatabase } from "@/server/db/client";
import type { CurrentUser, Shell, Workspace } from "@/lib/schemas";

/** Initials from a display name ("Ada Lovelace" → "AL"), falling back to email. */
function initialsOf(name: string, email: string): string {
  const fromName = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return fromName || email[0]?.toUpperCase() || "U";
}

/** Resolve the signed-in user for a session, or null for demo/anonymous. */
export async function resolveCurrentUser(session: SessionInfo): Promise<CurrentUser | null> {
  if (!session.userId) return null;
  // Parallel — independent queries; saves a DB round-trip on the shell path.
  const [user, role] = await Promise.all([
    repo().getUser(session.userId),
    repo().membershipRole(session.userId, session.workspaceId),
  ]);
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    initials: initialsOf(user.name, user.email),
    role,
    emailVerified: user.emailVerified ?? false,
  };
}

/**
 * Overlay session-specific fields (demo state + signed-in identity) onto a
 * base workspace payload. Shared by the RSC loader and `GET /api/workspace` so
 * the client sees the same identity on first paint and on every refetch.
 */
export async function attachSession(ws: Workspace, session: SessionInfo): Promise<Workspace> {
  return {
    ...ws,
    demo: { active: session.type === "demo", steps: session.demoSteps },
    currentUser: await resolveCurrentUser(session),
  };
}

/**
 * Server-side workspace loader for the app layout.
 *
 * - With a database, app routes require a real session: no session ⇒ /signin.
 *   (Middleware never mints anonymous sessions in DB mode.)
 * - Without a database (zero-setup dev / demo), middleware mints an anonymous
 *   session cookie and the in-memory repo lazily seeds its workspace, so the
 *   app "just works".
 *
 * The session's demo state (active + completed steps) is overlaid onto the
 * workspace payload, since it's session-specific, not workspace-specific.
 */
export async function loadWorkspace(): Promise<Workspace> {
  const session = await currentSession();
  if (!session) {
    if (hasDatabase()) redirect("/signin");
    // No DB: this path is effectively unreachable (middleware mints a cookie),
    // but seed an ephemeral demo workspace rather than failing.
    const demo = await startDemoSession();
    const ws = await repo().getWorkspace(demo.workspaceId);
    return attachSession(ws, demo);
  }
  const ws = await repo().getWorkspace(session.workspaceId);
  return attachSession(ws, session);
}

/**
 * Light shell loader for the app layout — just the chrome's data (name,
 * identity, notifications, demo state). Two cheap queries instead of the full
 * ~9-query workspace fetch, so the shell paints instantly; the heavy workspace
 * data loads lazily client-side (useWorkspace) and is merged over this.
 */
export async function loadShell(): Promise<Shell> {
  const session = await currentSession();
  if (!session) {
    if (hasDatabase()) redirect("/signin");
    const demo = await startDemoSession();
    const shell = await repo().getShell(demo.workspaceId);
    return { name: shell.name, currentUser: null, notifications: shell.notifications, demo: { active: true, steps: demo.demoSteps } };
  }
  const [shell, currentUser] = await Promise.all([repo().getShell(session.workspaceId), resolveCurrentUser(session)]);
  return {
    name: shell.name,
    currentUser,
    notifications: shell.notifications,
    demo: { active: session.type === "demo", steps: session.demoSteps },
  };
}

/** Used by the /demo route: force a sandbox session then enter the app. */
export async function ensureDemoSession(): Promise<never> {
  const session = await currentSession();
  if (!session || session.type !== "demo") {
    await startDemoSession();
  }
  redirect("/inbox/TKT-1042");
}

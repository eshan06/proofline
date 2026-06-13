import { redirect } from "next/navigation";
import { currentSession, startDemoSession } from "@/server/session";
import { repo } from "@/server/repository";
import { hasDatabase } from "@/server/db/client";
import type { Workspace } from "@/lib/schemas";

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
    return { ...ws, demo: { active: true, steps: demo.demoSteps } };
  }
  const ws = await repo().getWorkspace(session.workspaceId);
  return {
    ...ws,
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

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentSession, startSession } from "@/server/session";
import { createSession, getSession, workspacePayload } from "@/server/store";
import { SESSION_COOKIE } from "@/middleware";
import type { Workspace } from "@/lib/schemas";

/**
 * Server-side workspace loader for the app layout. Middleware guarantees a
 * session cookie exists, and the store lazily seeds a workspace for it — so we
 * only read here (Server Components can't write cookies). The fallback handles
 * the theoretical gap where the cookie is present on the request but not yet
 * committed.
 */
export async function loadWorkspace(): Promise<Workspace> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  const session = getSession(id);
  if (session) return workspacePayload(session);

  // Extremely defensive: no usable cookie reached the RSC. Seed an ephemeral
  // payload (no cookie write — Server Components can't). Middleware makes this
  // path effectively unreachable.
  return workspacePayload(createSession("regular"));
}

/** Used by the demo route to force a sandbox session then enter the app. */
export async function ensureDemoSession(): Promise<never> {
  const session = await currentSession();
  if (!session || session.type !== "demo") {
    await startSession("demo");
  }
  redirect("/inbox/TKT-1042");
}

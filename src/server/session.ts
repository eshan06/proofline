import { cookies } from "next/headers";
import { createSession, getSession, type SessionRecord } from "@/server/store";

export const SESSION_COOKIE = "pl_session";

/** Read the current session (RSC / route handlers). Null when signed out. */
export async function currentSession(): Promise<SessionRecord | null> {
  const jar = await cookies();
  return getSession(jar.get(SESSION_COOKIE)?.value);
}

/** Create a session and persist the cookie (route handlers / server actions only). */
export async function startSession(type: "regular" | "demo"): Promise<SessionRecord> {
  const record = createSession(type);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, record.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: type === "demo" ? 60 * 30 : 60 * 60 * 12,
  });
  return record;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

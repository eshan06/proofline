import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { currentSession } from "@/server/session";
import { NotFoundError, repo, type SessionInfo } from "@/server/repository";
import type { MemberRole } from "@/lib/schemas";
import { logger } from "@/server/logger";
import { clientKey, rateLimit, type RateLimit } from "@/server/rate-limit";
import { secureToken } from "@/lib/utils";

/**
 * Small shared plumbing for route handlers: session guard, zod-validated
 * bodies, and consistent error envelopes.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionInfo> {
  const session = await currentSession();
  if (!session) throw new ApiError(401, "No active session — sign in or open the demo.");
  return session;
}

/**
 * Authorize a real user's role. Demo/anonymous sessions (no userId) are
 * unrestricted within their throwaway sandbox workspace; real users must hold
 * one of the allowed roles or get a 403.
 */
export async function requireRole(session: SessionInfo, allowed: MemberRole[]): Promise<void> {
  if (!session.userId) return;
  const role = await repo().membershipRole(session.userId, session.workspaceId);
  if (!role || !allowed.includes(role)) {
    throw new ApiError(403, "You don't have permission to do that.");
  }
}

/**
 * Display name to attribute an action to (message author, "closed by …" status
 * lines). The real signed-in user when there is one; for demo/anonymous
 * sessions we fall back to "Eshan", the persona the seed fixtures are authored
 * under, so the demo stays visually consistent.
 */
export async function actorName(session: SessionInfo): Promise<string> {
  if (!session.userId) return "Eshan";
  const user = await repo().getUser(session.userId);
  return user?.name ?? "Eshan";
}

/** Throw 429 when the caller exceeds the named limit (keyed by client IP). */
export async function enforceRateLimit(req: Request, scope: string, limit: RateLimit): Promise<void> {
  const result = await rateLimit(clientKey(req, scope), limit);
  if (!result.allowed) {
    logger.warn("rate_limited", { scope, retryAfterSec: result.retryAfterSec });
    throw new ApiError(429, `Too many requests — try again in ${result.retryAfterSec}s.`);
  }
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Expected a JSON body.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

export function handleApi<T>(fn: () => Promise<T>): Promise<NextResponse> {
  return fn().then(
    (data) => NextResponse.json(data),
    (err: unknown) => {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Match by name as well as instanceof: the bundler can duplicate the
      // repository module across alias/relative imports, giving NotFoundError
      // two class identities, so a plain instanceof check is not reliable.
      if (err instanceof NotFoundError || (err instanceof Error && err.name === "NotFoundError")) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      // Unexpected: report it (logs + optional alert) with a short correlation
      // id the client surfaces, so a user's "error abc123" maps to one log line.
      const errorId = secureToken(4);
      logger.reportError("api.unhandled", err, { errorId });
      return NextResponse.json({ error: "Internal error", errorId }, { status: 500 });
    },
  );
}

/** Product analytics — flows through the structured logger; seam for a real pipeline. */
export function trackEvent(session: SessionInfo, name: string, props?: Record<string, unknown>) {
  logger.event(name, { session: session.id.slice(0, 12), sessionType: session.type, ...props });
}

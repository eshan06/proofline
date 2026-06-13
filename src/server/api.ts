import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { currentSession } from "@/server/session";
import { NotFoundError, type SessionInfo } from "@/server/repository";
import { logger } from "@/server/logger";
import { clientKey, rateLimit, type RateLimit } from "@/server/rate-limit";

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

/** Throw 429 when the caller exceeds the named limit (keyed by client IP). */
export function enforceRateLimit(req: Request, scope: string, limit: RateLimit): void {
  const result = rateLimit(clientKey(req, scope), limit);
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
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      logger.error("api.unhandled", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    },
  );
}

/** Product analytics — flows through the structured logger; seam for a real pipeline. */
export function trackEvent(session: SessionInfo, name: string, props?: Record<string, unknown>) {
  logger.event(name, { session: session.id.slice(0, 12), sessionType: session.type, ...props });
}

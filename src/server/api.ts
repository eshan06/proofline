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

/**
 * Throw 429 when an explicit key exceeds the limit. Used for per-account
 * throttles (keyed by email) on auth endpoints, so brute-force/abuse can't be
 * evaded by rotating source IPs (the per-IP limiter alone misses that).
 */
export async function enforceRateLimitKey(key: string, limit: RateLimit): Promise<void> {
  const result = await rateLimit(key, limit);
  if (!result.allowed) {
    logger.warn("rate_limited", { key: key.split(":")[0], retryAfterSec: result.retryAfterSec });
    throw new ApiError(429, `Too many requests — try again in ${result.retryAfterSec}s.`);
  }
}

/** Per-workspace daily AI-call ceiling, bounding LLM/embedding vendor spend per tenant. */
export const WORKSPACE_AI_DAILY_LIMIT = Number(process.env.WORKSPACE_AI_DAILY_LIMIT) || 2000;

/**
 * Block AI generation for a workspace whose paid subscription is delinquent
 * (past_due) or cancelled. Real sessions only — demo sandboxes are seeded active
 * and are throwaway. Keeps paid features (copilot/AI drafting) gated to entitled
 * subscriptions instead of merely showing a status label.
 */
export async function requireAiEntitlement(session: SessionInfo): Promise<void> {
  if (!session.userId) return; // demo / anonymous sandbox
  const { isEntitled } = await import("@/server/billing/plans");
  const sub = await repo().getSubscription(session.workspaceId);
  if (!isEntitled(sub.status)) {
    throw new ApiError(402, "This workspace's subscription is not active. Update billing to keep using the AI copilot.");
  }
}

/**
 * Consume one AI call against both budgets: the demo per-session cap (so a demo
 * can't run unbounded inference) and the per-workspace daily cap (so a single
 * paid tenant can't drive unbounded vendor cost). Throws 429 on either.
 */
export async function consumeAiBudget(session: SessionInfo): Promise<void> {
  if (!(await repo().consumeAiCall(session.id))) {
    throw new ApiError(429, "Demo AI limit reached — sign up to keep drafting.");
  }
  if (!(await repo().consumeWorkspaceAiCall(session.workspaceId, WORKSPACE_AI_DAILY_LIMIT))) {
    throw new ApiError(429, "This workspace has reached its daily AI limit. It resets tomorrow (UTC).");
  }
}

/** Default JSON body cap. Endpoints accepting larger payloads pass an override. */
export const DEFAULT_MAX_BODY_BYTES = 64 * 1024; // 64 KB

/**
 * Read a request body as text with a hard byte cap, streaming so a missing or
 * lying Content-Length can't be used to buffer an unbounded payload into memory
 * (an OOM/DoS vector, especially on the public widget endpoint). Throws 413 when
 * the cap is exceeded.
 */
export async function readBodyCapped(req: Request, maxBytes: number = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, "Request body too large.");
  }
  const body = req.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new ApiError(413, "Request body too large.");
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return new TextDecoder().decode(concatChunks(chunks, total));
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>, maxBytes: number = DEFAULT_MAX_BODY_BYTES): Promise<T> {
  const text = await readBodyCapped(req, maxBytes);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
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
      // Repository-thrown domain errors (matched by name for the same reason).
      if (err instanceof Error && err.name === "SeatLimitError") {
        return NextResponse.json({ error: err.message }, { status: 402 });
      }
      if (err instanceof Error && err.name === "LastAdminError") {
        return NextResponse.json({ error: err.message }, { status: 409 });
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
  const endpoint = process.env.ANALYTICS_ENDPOINT;
  if (endpoint) {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: name,
        sessionType: session.type,
        sessionId: session.id.slice(0, 12),
        properties: props,
      }),
    }).catch(() => {});
  }
}

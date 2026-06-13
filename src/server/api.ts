import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { currentSession } from "@/server/session";
import { NotFoundError, type SessionRecord } from "@/server/store";

/**
 * Small shared plumbing for route handlers: session guard, zod-validated
 * bodies, and consistent error envelopes.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionRecord> {
  const session = await currentSession();
  if (!session) throw new ApiError(401, "No active session — sign in or open the demo.");
  return session;
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
      console.error("[api]", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    },
  );
}

/** Product analytics — v1 sink is the server log; the seam for a real pipeline. */
export function trackEvent(session: SessionRecord, name: string, props?: Record<string, unknown>) {
  console.info(
    `[analytics] ${name}`,
    JSON.stringify({ session: session.id.slice(0, 12), type: session.type, ...props }),
  );
}

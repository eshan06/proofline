import { NextResponse } from "next/server";
import { hasDatabase, getSql } from "@/server/db/client";

/**
 * Readiness probe (distinct from liveness at /api/health). Verifies the
 * instance can actually serve traffic — in DB mode it pings Postgres, so an
 * instance with a dead database is pulled from the load balancer rather than
 * served broken requests. In the zero-setup in-memory backend there is no
 * dependency to check, so it is always ready.
 *
 * The DB ping is raced against a 3-second timeout so a stalled connection
 * never hangs a readiness check indefinitely.
 */
export const dynamic = "force-dynamic";

const DB_PING_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ status: "ready", backend: "memory" }, { headers: { "cache-control": "no-store" } });
  }
  try {
    await withTimeout(getSql()`select 1`, DB_PING_TIMEOUT_MS, "db ping");
    return NextResponse.json({ status: "ready", backend: "postgres" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { status: "not_ready", backend: "postgres", error: err instanceof Error ? err.message : "db unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

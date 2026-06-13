import { NextResponse } from "next/server";
import { hasDatabase, getSql } from "@/server/db/client";

/**
 * Readiness probe (distinct from liveness at /api/health). Verifies the
 * instance can actually serve traffic — in DB mode it pings Postgres, so an
 * instance with a dead database is pulled from the load balancer rather than
 * served broken requests. In the zero-setup in-memory backend there is no
 * dependency to check, so it is always ready.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ status: "ready", backend: "memory" }, { headers: { "cache-control": "no-store" } });
  }
  try {
    await getSql()`select 1`;
    return NextResponse.json({ status: "ready", backend: "postgres" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { status: "not_ready", backend: "postgres", error: err instanceof Error ? err.message : "db unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

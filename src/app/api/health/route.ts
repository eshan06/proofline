import { NextResponse } from "next/server";

/**
 * Liveness/readiness probe. Intentionally unauthenticated and dependency-free
 * so a load balancer / orchestrator can hit it cheaply. Reports the active AI
 * provider so ops can confirm the deployment's configuration at a glance.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "proofline",
      aiProvider: process.env.AI_PROVIDER ?? "mock",
      uptimeSeconds: Math.round(process.uptime()),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

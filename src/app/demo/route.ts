import { ensureDemoSession } from "@/server/load-workspace";

/**
 * /demo — creates an unauthenticated sandbox session (server-seeded mock
 * workspace, no persistence, rate-limited AI) and enters the app at the hero
 * inbox. The regular sign-in flow stays separate.
 */
export async function GET() {
  await ensureDemoSession();
}

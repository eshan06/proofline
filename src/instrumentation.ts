/**
 * Next.js instrumentation. Kept deliberately free of any Node-only imports
 * (e.g. the Postgres driver) because Next traces this file for the edge runtime
 * too, where those can't be bundled. Graceful DB-pool shutdown lives in
 * db/client.ts instead (a Node-only module). Here we only register the
 * server-error hook, which depends solely on the edge-safe logger.
 */
export async function register() {
  // no-op: see db/client.ts for graceful shutdown registration
}

/** Next 15 server-error hook — report uncaught request errors. */
export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  const { logger } = await import("@/server/logger");
  logger.reportError("request.uncaught", err, { path: request?.path, method: request?.method });
}

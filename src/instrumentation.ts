/**
 * Next.js instrumentation. Kept deliberately free of any Node-only imports
 * (e.g. the Postgres driver) because Next traces this file for the edge runtime
 * too, where those can't be bundled. Graceful DB-pool shutdown lives in
 * db/client.ts instead (a Node-only module). Here we only register the
 * server-error hook, which depends solely on the edge-safe logger.
 */
export async function register() {
  // Graceful DB-pool shutdown is registered in db/client.ts (a Node-only module).
  //
  // To add Sentry (or any error tracker): install it, then wire its capture into
  // the logger's error sink here so every logger.reportError() — including the
  // onRequestError hook below — forwards to it. Guard on the runtime so the
  // edge bundle stays clean:
  //
  //   if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
  //     const Sentry = await import("@sentry/nextjs");
  //     Sentry.init({ dsn: process.env.SENTRY_DSN });
  //     const { setErrorSink } = await import("@/server/logger");
  //     setErrorSink((err, ctx) => Sentry.captureException(err, { extra: ctx }));
  //   }
}

/** Next 15 server-error hook — report uncaught request errors. */
export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  const { logger } = await import("@/server/logger");
  logger.reportError("request.uncaught", err, { path: request?.path, method: request?.method });
}

/**
 * Next.js instrumentation. Kept deliberately free of any Node-only imports
 * (e.g. the Postgres driver) because Next traces this file for the edge runtime
 * too, where those can't be bundled. Graceful DB-pool shutdown lives in
 * db/client.ts instead (a Node-only module). Here we only register the
 * server-error hook, which depends solely on the edge-safe logger.
 */
export async function register() {
  // Graceful DB-pool shutdown is registered in db/client.ts (a Node-only module).

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setErrorSink } = await import("@/server/logger");

    // ── Sentry ───────────────────────────────────────────────────────────────
    // To activate Sentry:
    //   1. npm install @sentry/nextjs
    //   2. Set SENTRY_DSN in your environment / .env.local
    //   3. Replace the webhook block below with:
    //
    //        if (process.env.SENTRY_DSN) {
    //          const Sentry = await import("@sentry/nextjs");
    //          Sentry.init({ dsn: process.env.SENTRY_DSN });
    //          setErrorSink((err, ctx) => Sentry.captureException(err, { extra: ctx }));
    //        }
    // ─────────────────────────────────────────────────────────────────────────

    // Generic error-reporting webhook. Set ERROR_WEBHOOK_URL to a Slack
    // incoming-webhook URL, a PagerDuty Events v2 endpoint, or any HTTP
    // endpoint that accepts a JSON POST body. Errors are fire-and-forget so
    // they never block request handling.
    if (process.env.ERROR_WEBHOOK_URL) {
      const webhookUrl = process.env.ERROR_WEBHOOK_URL;
      setErrorSink((err, ctx) => {
        const body = JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          context: ctx,
          timestamp: new Date().toISOString(),
        });
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => {
          // Swallow fetch errors — webhook delivery is best-effort.
        });
      });
    }
  }
}

/** Next 15 server-error hook — report uncaught request errors. */
export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  const { logger } = await import("@/server/logger");
  logger.reportError("request.uncaught", err, { path: request?.path, method: request?.method });
}

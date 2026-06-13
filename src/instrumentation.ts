/**
 * Next.js instrumentation. Runs once when the server process starts (Node
 * runtime only). We use it for:
 *  - graceful shutdown: drain the Postgres pool on SIGTERM/SIGINT so a deploy
 *    or container stop closes connections cleanly instead of severing in-flight
 *    queries.
 *  - error capture: `onRequestError` funnels uncaught server errors through the
 *    same reporting seam as handled 500s.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("@/server/logger");
  const { closeDb } = await import("@/server/db/client");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server.shutdown", { signal });
    try {
      await closeDb();
    } catch (err) {
      logger.reportError("server.shutdown_error", err);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

/** Next 15 server-error hook — report uncaught request errors. */
export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  const { logger } = await import("@/server/logger");
  logger.reportError("request.uncaught", err, { path: request?.path, method: request?.method });
}

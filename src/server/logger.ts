/**
 * Structured logging seam. Emits single-line JSON so a log pipeline
 * (Datadog/Loki/CloudWatch) can parse it; swap the sink here for a real
 * transport without touching call sites. Analytics events flow through the
 * same channel as `event` records.
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Optional exception sink. reportError forwards every exception here in addition
 * to logging it, so an APM/error tracker (Sentry, etc.) can capture it without
 * touching any call site. We intentionally don't import a specific SDK (that
 * would force a dependency and risk a build-time resolution failure) — instead,
 * wire it once at startup, e.g. in instrumentation.ts's register():
 *
 *   import * as Sentry from "@sentry/nextjs";
 *   Sentry.init({ dsn: process.env.SENTRY_DSN });
 *   setErrorSink((err, ctx) => Sentry.captureException(err, { extra: ctx }));
 */
type ErrorSink = (err: unknown, context?: Record<string, unknown>) => void;
let errorSink: ErrorSink | null = null;

export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", msg, fields);
  },
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
  /**
   * Report an exception. Always logs structured error JSON; additionally
   * forwards a one-line alert to ERROR_WEBHOOK_URL when set (Slack/Discord/any
   * incoming webhook), so production errors surface somewhere a human watches.
   * This is the seam a richer sink (Sentry) drops into without touching callers.
   */
  reportError: (msg: string, err: unknown, fields?: Record<string, unknown>) => {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    emit("error", msg, { ...fields, error, stack });
    if (errorSink) {
      try {
        errorSink(err, { msg, ...fields });
      } catch {
        /* a broken error sink must never mask the original error */
      }
    }
    const url = process.env.ERROR_WEBHOOK_URL;
    if (url) {
      const id = fields && "errorId" in fields ? ` (${(fields as { errorId?: string }).errorId})` : "";
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `🚨 [proofline] ${msg}${id}: ${error}` }),
      }).catch(() => {});
    }
  },
  /** Product analytics event (demo_step_completed, etc.). */
  event: (name: string, fields?: Record<string, unknown>) =>
    emit("info", "analytics", { event: name, ...fields }),
};

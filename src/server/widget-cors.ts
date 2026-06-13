/**
 * CORS for the public website-chat widget. The widget runs on the customer's
 * own site (a third-party origin), so the intake endpoints are deliberately
 * cross-origin. They use no cookies — a request is authorized by the public
 * site key plus the per-visitor conversation token — so reflecting the origin
 * (or `*` when unconfigured) is safe; the origin allowlist is a configurable
 * hardening control, not the security boundary.
 */

/** The value to send for Access-Control-Allow-Origin, or null when blocked. */
export function widgetCorsOrigin(origin: string | null, allowedOrigins: string[]): string | null {
  // Unconfigured: allow any origin (zero-setup / quick start). Operators lock
  // this down by listing their site origins in the widget settings.
  if (allowedOrigins.length === 0) return "*";
  if (origin && allowedOrigins.includes(origin)) return origin;
  return null;
}

export function corsHeaders(allowOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

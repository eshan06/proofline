/**
 * Session cookie name + attribute policy, shared by the edge middleware (which
 * mints anonymous sandbox cookies) and the server session helpers (which mint
 * demo/regular sessions). Both must agree, or a cookie written by one is
 * rejected or duplicated by the other.
 *
 * Kept dependency-free so the edge middleware can import it.
 */

export const SESSION_COOKIE = "pl_session";

/**
 * True when this deployment is the stateless in-memory demo (no database).
 * That build is meant to be embeddable — see `embeddable demo` in next.config.ts.
 */
export function isStatelessDemo(): boolean {
  return !process.env.DATABASE_URL;
}

/**
 * Cookie attributes for the session.
 *
 * The stateless demo is designed to be embedded in someone else's page (a
 * portfolio, a docs site). A cross-site iframe is a *third-party* context,
 * where a `SameSite=Lax` cookie is never sent back — the sandbox session would
 * be re-minted on every request and the visitor's state would reset on each
 * navigation. So in demo mode the cookie is:
 *
 *  - `SameSite=None` so it is sent inside a cross-site iframe at all, and
 *  - `Partitioned` (CHIPS) so browsers that block or partition third-party
 *    cookies still keep it, keyed to the embedding page. That is exactly the
 *    semantics a demo wants: every host page gets its own isolated sandbox.
 *
 * Dropping to `SameSite=None` does not open a CSRF hole: mutating `/api`
 * requests are gated on a matching `Origin` in middleware, which is the actual
 * defense — SameSite was only defense-in-depth. And in demo mode there is no
 * durable data or real account behind the session to forge a request against.
 *
 * When a database IS configured the session is a real credential for real
 * tenant data, so it stays `SameSite=Lax` and the app refuses to be framed.
 */
export function sessionCookieOptions(maxAgeSec: number) {
  const secure = process.env.NODE_ENV === "production";
  // `SameSite=None` is only honoured on a Secure cookie, so plain-HTTP local
  // dev keeps Lax (embedding is a deployed-demo concern, not a dev one).
  const crossSite = isStatelessDemo() && secure;
  return {
    httpOnly: true,
    secure,
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    ...(crossSite ? { partitioned: true } : {}),
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** Session lifetimes (seconds). Demo sandboxes are short-lived by design. */
export const SESSION_MAX_AGE = { demo: 60 * 30, regular: 60 * 60 * 12 } as const;

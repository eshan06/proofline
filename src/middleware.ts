import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "pl_session";

/**
 * Gate app routes on a session cookie. Cookies can't be written from a Server
 * Component, so anonymous sessions are minted here. Middleware runs on the edge
 * and can't touch the repository — it only inspects cookie presence; the RSC /
 * route handlers validate the session against the store.
 *
 * - With a database (DATABASE_URL set): app routes require real auth. No
 *   cookie ⇒ redirect to /signin. /demo still mints a sandbox session.
 * - Without a database: mint an anonymous `ws_` cookie; the in-memory repo
 *   lazily seeds its workspace (zero-setup dev / demo).
 */
/**
 * CSRF defense for state-changing API calls. Session cookies are sameSite=lax,
 * which still permits some cross-site requests, so we reject mutating /api
 * requests whose Origin isn't our own host. Exemptions: the public widget
 * intake (cross-origin by design, CORS-gated) and the Stripe webhook
 * (server-to-server, authenticated by signature, no browser Origin).
 */
function csrfGuard(req: NextRequest): NextResponse {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/widget/") || path === "/api/billing/webhook") return NextResponse.next();

  const origin = req.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* malformed Origin → treat as mismatch below */
    }
    const host = req.headers.get("host");
    if (!originHost || originHost !== host) {
      return new NextResponse(JSON.stringify({ error: "Cross-origin request blocked." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }
  // No Origin header: same-origin non-form fetches and server-to-server callers.
  // Browsers attach Origin to cross-site POSTs, so absence is not the threat.
  return NextResponse.next();
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) return csrfGuard(req);

  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (process.env.DATABASE_URL) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const id = `ws_s_${crypto.randomUUID().replace(/-/g, "")}`;
  const res = NextResponse.next();
  req.cookies.set(SESSION_COOKIE, id);
  res.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/home/:path*",
    "/inbox/:path*",
    "/tickets/:path*",
    "/customers/:path*",
    "/kb/:path*",
    "/copilot/:path*",
    "/automations/:path*",
    "/analytics/:path*",
    "/integrations/:path*",
    "/settings/:path*",
  ],
};

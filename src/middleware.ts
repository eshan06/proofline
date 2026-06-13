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
export function middleware(req: NextRequest) {
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

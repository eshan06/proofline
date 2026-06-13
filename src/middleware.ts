import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "pl_session";

/**
 * Ensure every app request carries a workspace session cookie.
 *
 * Cookies can't be written from a Server Component, so the session is minted
 * here instead. Middleware runs in the edge runtime and can't touch the Node
 * in-memory store — it only generates the id; the store lazily seeds a
 * workspace the first time that id is read in the Node runtime (see
 * store.getSession). /demo mints its own clearly-separate sandbox session in a
 * route handler, so we never overwrite an existing cookie.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const id = `ws_s_${crypto.randomUUID().replace(/-/g, "")}`;
  const res = NextResponse.next();
  // Make it visible to this same request's RSC render *and* persist it.
  req.cookies.set(SESSION_COOKIE, id);
  res.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export const config = {
  // App surfaces that need a session. Static assets and the marketing root opt out.
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

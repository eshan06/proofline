import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * CSP notes (accurate — do not overstate):
 *  - style-src keeps 'unsafe-inline': the design uses inline style props
 *    pervasively (exact pixel values). Low risk (style injection, not script).
 *  - script-src keeps 'unsafe-inline' in BOTH dev and prod. Next.js App Router
 *    emits inline hydration/bootstrap scripts (`self.__next_f` pushes) that need
 *    either 'unsafe-inline' or a per-request nonce to execute. We additionally
 *    drop 'unsafe-eval' in prod (only the dev runtime needs it).
 *  - Remaining hardening (TODO): move script-src to a per-request nonce +
 *    'strict-dynamic' to remove 'unsafe-inline'. That requires middleware to set
 *    the nonce on the request CSP header AND handling statically-prerendered
 *    pages (a per-request nonce can't be baked into static HTML), so it must be
 *    browser-QA'd before shipping — it is NOT a drop-in change. There is no
 *    currently-reachable inline-script sink (no dangerouslySetInnerHTML anywhere;
 *    React auto-escapes), so this is a defense-in-depth gap, not a live hole.
 *
 * Self-hosted Geist fonts mean no external font origins.
 */
const isProd = process.env.NODE_ENV === "production";

/**
 * Framing policy. A deployment WITH a database serves real tenant data, so it
 * refuses to be framed at all (clickjacking defense). The stateless demo build
 * (no DATABASE_URL) is the opposite case: it exists to be shown off, embedded
 * in a portfolio or docs page, and holds nothing but a throwaway sandbox — no
 * accounts, no persistence, nothing a clickjack could steal or destroy. So the
 * demo allows framing and the real thing does not.
 *
 * Note this is resolved at BUILD time (next.config is not per-request), which
 * matches how DATABASE_URL is supplied on every supported host — adding a
 * database means redeploying anyway (migrations have to run).
 */
const embeddableDemo = !process.env.DATABASE_URL;

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // `*` = embeddable anywhere (demo only); otherwise no framing at all.
  embeddableDemo ? "frame-ancestors *" : "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // X-Frame-Options has no "allow any origin" value (ALLOW-FROM is dead), so
  // the only way to permit embedding is to omit the header and let the CSP
  // frame-ancestors directive above govern — every current browser honours it.
  ...(embeddableDemo ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Lean container image: only the server + traced deps are copied (see Dockerfile).
  output: "standalone",
  // Next 15 defaults the client router cache for dynamic segments to 0s, so every
  // tab navigation re-fetched the force-dynamic app-shell layout (which re-ran the
  // whole workspace query). Cache visited segments briefly so switching tabs reuses
  // the layout instead of re-rendering it; mutations still invalidate explicitly.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  // The `postgres` driver is Node-only; keep it external so it's never pulled
  // into an edge bundle (e.g. when instrumentation.ts is traced for the edge
  // runtime) — bundling its source there fails to parse.
  serverExternalPackages: ["postgres", "pdf-parse", "mammoth"],
  eslint: { dirs: ["src"] },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

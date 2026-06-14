import type { NextConfig } from "next";

/**
 * Security headers applied to every response. The CSP is intentionally strict;
 * `'unsafe-inline'` on style-src is required because the design uses inline
 * style props pervasively (exact pixel values), and `'unsafe-eval'`/inline on
 * script-src is needed by the Next.js dev runtime — both are tightened in prod
 * below. Self-hosted Geist fonts mean no external font origins.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' ${isProd ? "'unsafe-inline'" : "'unsafe-inline' 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
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

/**
 * Centralised validation of security-critical environment configuration.
 *
 * Called once at server startup (instrumentation.register) so a misconfigured
 * production deploy fails fast and loudly instead of silently shipping an
 * insecure default. The motivating case: INVITE_SECRET signs stateless invite
 * tokens; if it falls back to the well-known dev key, anyone can forge an Admin
 * invite for any workspace. A founder should never be able to ship that by
 * forgetting one env var.
 *
 * Edge-safe: imports only the logger (no Node-only modules), so instrumentation
 * can load it without breaking the edge runtime trace.
 */
import { logger } from "@/server/logger";

/** The insecure fallback used when INVITE_SECRET is unset (dev/test only). */
export const DEV_INVITE_SECRET = "dev-invite-secret-change-in-prod";

/**
 * Throw if production is configured insecurely; warn on misconfigurations that
 * degrade behaviour but aren't security holes. No-op outside production so local
 * dev and the in-memory demo keep working with zero config.
 */
/** True when DATABASE_URL points at a non-local host (mirrors db/client sslConfig). */
function isRemoteDb(url: string): boolean {
  return !/@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(url);
}

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  const warnings: string[] = [];

  // A production boot with no DATABASE_URL is the stateless in-memory demo
  // (e.g. a one-click Vercel deploy): accounts, invites, and sessions all
  // evaporate on restart, so there is nothing durable for a forged invite or a
  // missing key to compromise. In that mode the hard-fails below become loud
  // warnings, so the demo deploys with zero configuration — while any deploy
  // with a real database keeps the strict checks.
  const statelessDemo = !process.env.DATABASE_URL;

  // Hard fail: a forgeable invite-token signing key is a workspace-takeover hole.
  const invite = process.env.INVITE_SECRET;
  if (!invite || invite === DEV_INVITE_SECRET) {
    errors.push(
      "INVITE_SECRET is unset or set to the insecure dev fallback. Invite tokens are HMAC-signed with it, so the known dev key lets anyone forge an Admin invite for any workspace. Generate one with `openssl rand -hex 32`.",
    );
  }

  // Hard fail when UNSET: without a public URL, invite/verification links, OAuth
  // callbacks, and the widget embed are wrong — onboarding/integrations break on
  // day one, so don't let a prod deploy boot half-broken. A localhost value is
  // only a warning: it means someone consciously set it for a local production
  // smoke (docker compose, the Playwright e2e server) rather than forgot it.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    errors.push(
      "NEXT_PUBLIC_APP_URL is unset. Set it to your HTTPS domain — invite/verification email links, OAuth callbacks, and the widget embed snippet derive from it.",
    );
  } else if (appUrl.includes("localhost")) {
    warnings.push(
      "NEXT_PUBLIC_APP_URL points at localhost — fine for a local production smoke, wrong for a real deploy (email links, OAuth callbacks, and the widget embed will point at localhost).",
    );
  }

  // Hard fail: selecting Stripe without its keys/prices silently falls back to a
  // mock that grants paid entitlements for free and ack-and-discards real
  // webhooks — a payment-integrity hazard. Fail fast instead.
  if (process.env.BILLING_PROVIDER === "stripe") {
    const missing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_SCALE"].filter(
      (k) => !process.env[k],
    );
    if (missing.length) {
      errors.push(
        `BILLING_PROVIDER=stripe but missing ${missing.join(", ")}. Without these the app would silently run mock billing (free entitlements, unverified webhooks). Set them or unset BILLING_PROVIDER.`,
      );
    }
  }

  // Hard fail: a remote DB encrypted but NOT CA-verified is MITM-able, and it
  // carries every tenant's data + credentials. Require explicit CA verification
  // (DB_CA_CERT or DB_SSL=verify) — or DB_SSL=disable to consciously opt out.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && isRemoteDb(dbUrl)) {
    const mode = process.env.DB_SSL;
    const hasCa = !!process.env.DB_CA_CERT?.trim();
    if (mode !== "disable" && mode !== "verify" && !hasCa) {
      errors.push(
        "DATABASE_URL is a remote host but TLS is not CA-verified (MITM risk). Set DB_CA_CERT to the provider CA-bundle PEM (e.g. the RDS global bundle) or DB_SSL=verify (with NODE_EXTRA_CA_CERTS). Use DB_SSL=disable only to consciously opt out.",
      );
    }
  }

  // Hard fail: a configured Gmail/Slack channel without TOKEN_ENC_KEY stores
  // third-party OAuth tokens as plaintext at rest.
  const usesChannels = process.env.GMAIL_CLIENT_ID || process.env.SLACK_CLIENT_ID || process.env.SLACK_SIGNING_SECRET;
  if (usesChannels && !process.env.TOKEN_ENC_KEY) {
    errors.push(
      "A Gmail/Slack channel is configured but TOKEN_ENC_KEY is unset — their refresh/bot tokens would be stored unencrypted at rest. Set a 32-byte key (`openssl rand -hex 32`).",
    );
  }

  // Soft warnings: degraded operation, not a security hole.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push(
      "UPSTASH_REDIS_REST_URL/TOKEN are unset — rate limiting is in-process only. On more than one instance each replica has its own (weaker) limits. Configure Upstash for shared limits across instances.",
    );
  }
  if (!process.env.ERROR_WEBHOOK_URL && !process.env.SENTRY_DSN) {
    warnings.push(
      "No error sink configured (ERROR_WEBHOOK_URL / SENTRY_DSN). Production 500s will only appear in stdout logs — nothing will page you. Wire one before relying on alerting.",
    );
  }

  for (const w of warnings) logger.warn("env.config_warning", { message: w });

  if (errors.length) {
    if (statelessDemo) {
      for (const e of errors) logger.warn("env.demo_mode_relaxed", { message: e });
      logger.warn("env.demo_mode", {
        message:
          "No DATABASE_URL: running as the stateless in-memory demo. The warnings above would block a real (database-backed) production deploy.",
      });
      return;
    }
    const message = `Refusing to start: insecure production configuration.\n${errors
      .map((e) => `  • ${e}`)
      .join("\n")}`;
    // Log before throwing so the reason is visible even if the platform only
    // surfaces the process exit code.
    logger.error("env.startup_blocked", { errors });
    throw new Error(message);
  }
}

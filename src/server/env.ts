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
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Hard fail: a forgeable invite-token signing key is a workspace-takeover hole.
  const invite = process.env.INVITE_SECRET;
  if (!invite || invite === DEV_INVITE_SECRET) {
    errors.push(
      "INVITE_SECRET is unset or set to the insecure dev fallback. Invite tokens are HMAC-signed with it, so the known dev key lets anyone forge an Admin invite for any workspace. Generate one with `openssl rand -hex 32`.",
    );
  }

  // Soft warnings: these break behaviour (links/callbacks) but aren't exploitable.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    warnings.push(
      "NEXT_PUBLIC_APP_URL is unset or points at localhost. Invite/verification email links, OAuth callbacks, and the widget embed snippet will be wrong in production.",
    );
  }

  const usesChannels = process.env.GMAIL_CLIENT_ID || process.env.SLACK_CLIENT_ID || process.env.SLACK_SIGNING_SECRET;
  if (usesChannels && !process.env.TOKEN_ENC_KEY) {
    warnings.push(
      "A Gmail/Slack channel is configured but TOKEN_ENC_KEY is unset — their refresh/bot tokens would be stored unencrypted at rest. Set a 32-byte key (`openssl rand -hex 32`).",
    );
  }

  for (const w of warnings) logger.warn("env.config_warning", { message: w });

  if (errors.length) {
    const message = `Refusing to start: insecure production configuration.\n${errors
      .map((e) => `  • ${e}`)
      .join("\n")}`;
    // Log before throwing so the reason is visible even if the platform only
    // surfaces the process exit code.
    logger.error("env.startup_blocked", { errors });
    throw new Error(message);
  }
}

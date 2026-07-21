import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateProductionEnv, DEV_INVITE_SECRET } from "@/server/env";

/**
 * The production env guard is the last line of defence against shipping a
 * forgeable invite-token signing key. These tests pin its fail-fast behaviour.
 */

// Env keys this suite manipulates — cleared before each test so ambient values
// (e.g. a real DATABASE_URL) can't make the hermetic cases flaky.
const MANAGED = [
  "NODE_ENV", "INVITE_SECRET", "NEXT_PUBLIC_APP_URL", "BILLING_PROVIDER",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_SCALE",
  "DATABASE_URL", "DB_SSL", "DB_CA_CERT", "GMAIL_CLIENT_ID", "SLACK_CLIENT_ID",
  "SLACK_SIGNING_SECRET", "TOKEN_ENC_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "ERROR_WEBHOOK_URL", "SENTRY_DSN",
];
const saved: Record<string, string | undefined> = {};
for (const k of MANAGED) saved[k] = process.env[k];

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
}

/** A minimal valid production config; individual tests break one thing at a time. */
function baseProd(): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    INVITE_SECRET: "a".repeat(64),
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    // Silence the soft warnings so they don't clutter test output.
    UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "t",
    ERROR_WEBHOOK_URL: "https://hooks.example.com/x",
  };
}

beforeEach(() => {
  for (const k of MANAGED) delete (process.env as Record<string, string | undefined>)[k];
});

afterEach(() => {
  for (const k of MANAGED) {
    if (saved[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = saved[k];
  }
});

describe("validateProductionEnv", () => {
  it("is a no-op outside production even with no secrets set", () => {
    setEnv({ NODE_ENV: "development", INVITE_SECRET: undefined });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("throws in production when INVITE_SECRET is unset", () => {
    setEnv({ ...baseProd(), INVITE_SECRET: undefined });
    expect(() => validateProductionEnv()).toThrow(/INVITE_SECRET/);
  });

  it("throws in production when INVITE_SECRET is the dev fallback", () => {
    setEnv({ ...baseProd(), INVITE_SECRET: DEV_INVITE_SECRET });
    expect(() => validateProductionEnv()).toThrow(/forge/i);
  });

  it("throws in production when NEXT_PUBLIC_APP_URL is missing", () => {
    setEnv({ ...baseProd(), NEXT_PUBLIC_APP_URL: undefined });
    expect(() => validateProductionEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("only warns when NEXT_PUBLIC_APP_URL is explicitly localhost (local prod smoke)", () => {
    setEnv({ ...baseProd(), NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("throws when BILLING_PROVIDER=stripe but Stripe keys are missing", () => {
    setEnv({ ...baseProd(), BILLING_PROVIDER: "stripe" });
    expect(() => validateProductionEnv()).toThrow(/STRIPE_/);
  });

  it("passes when BILLING_PROVIDER=stripe with all keys + prices", () => {
    setEnv({
      ...baseProd(),
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec",
      STRIPE_PRICE_GROWTH: "price_g", STRIPE_PRICE_SCALE: "price_s",
    });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("throws when a remote DATABASE_URL has no CA verification", () => {
    setEnv({ ...baseProd(), DATABASE_URL: "postgres://u:p@db.rds.amazonaws.com:5432/proofline" });
    expect(() => validateProductionEnv()).toThrow(/CA-verified|MITM/i);
  });

  it("passes a remote DATABASE_URL with DB_CA_CERT set", () => {
    setEnv({ ...baseProd(), DATABASE_URL: "postgres://u:p@db.rds.amazonaws.com:5432/proofline", DB_CA_CERT: "-----BEGIN CERTIFICATE-----" });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("allows a local DATABASE_URL without CA verification", () => {
    setEnv({ ...baseProd(), DATABASE_URL: "postgres://postgres:x@localhost:5432/proofline" });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("throws when a channel is configured without TOKEN_ENC_KEY", () => {
    setEnv({ ...baseProd(), SLACK_SIGNING_SECRET: "shhh" });
    expect(() => validateProductionEnv()).toThrow(/TOKEN_ENC_KEY/);
  });

  it("passes in production with a real INVITE_SECRET and minimal valid config", () => {
    setEnv(baseProd());
    expect(() => validateProductionEnv()).not.toThrow();
  });
});

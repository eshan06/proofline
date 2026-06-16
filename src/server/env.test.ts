import { describe, it, expect, afterEach } from "vitest";
import { validateProductionEnv, DEV_INVITE_SECRET } from "@/server/env";

/**
 * The production env guard is the last line of defence against shipping a
 * forgeable invite-token signing key. These tests pin its fail-fast behaviour.
 */

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  INVITE_SECRET: process.env.INVITE_SECRET,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
}

afterEach(() => {
  setEnv({
    NODE_ENV: saved.NODE_ENV,
    INVITE_SECRET: saved.INVITE_SECRET,
    NEXT_PUBLIC_APP_URL: saved.APP_URL,
  });
});

describe("validateProductionEnv", () => {
  it("is a no-op outside production even with no secrets set", () => {
    setEnv({ NODE_ENV: "development", INVITE_SECRET: undefined });
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it("throws in production when INVITE_SECRET is unset", () => {
    setEnv({ NODE_ENV: "production", INVITE_SECRET: undefined, NEXT_PUBLIC_APP_URL: "https://app.example.com" });
    expect(() => validateProductionEnv()).toThrow(/INVITE_SECRET/);
  });

  it("throws in production when INVITE_SECRET is the dev fallback", () => {
    setEnv({ NODE_ENV: "production", INVITE_SECRET: DEV_INVITE_SECRET, NEXT_PUBLIC_APP_URL: "https://app.example.com" });
    expect(() => validateProductionEnv()).toThrow(/forge/i);
  });

  it("passes in production with a real INVITE_SECRET", () => {
    setEnv({
      NODE_ENV: "production",
      INVITE_SECRET: "a".repeat(64),
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    });
    expect(() => validateProductionEnv()).not.toThrow();
  });
});

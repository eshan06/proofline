import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sessionCookieOptions, isStatelessDemo } from "@/lib/session-cookie";

/**
 * The session cookie's cross-site attributes are what make the embedded demo
 * work (a SameSite=Lax cookie is never sent inside a third-party iframe), so
 * they are pinned here — including the fact that a real, database-backed
 * deployment does NOT get them.
 */

const MANAGED = ["NODE_ENV", "DATABASE_URL"];
const saved: Record<string, string | undefined> = {};
for (const k of MANAGED) saved[k] = process.env[k];

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
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

describe("session cookie policy", () => {
  it("deployed demo (no DATABASE_URL): SameSite=None + Partitioned so a cross-site iframe keeps the session", () => {
    setEnv({ NODE_ENV: "production" });
    const opts = sessionCookieOptions(1800);
    expect(isStatelessDemo()).toBe(true);
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true); // SameSite=None is ignored without Secure
    expect((opts as { partitioned?: boolean }).partitioned).toBe(true);
    expect(opts.httpOnly).toBe(true);
  });

  it("real deployment (DATABASE_URL set): stays SameSite=Lax and unpartitioned", () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://postgres:x@localhost:5432/proofline" });
    const opts = sessionCookieOptions(1800);
    expect(isStatelessDemo()).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect((opts as { partitioned?: boolean }).partitioned).toBeUndefined();
  });

  it("local dev over plain HTTP keeps Lax (SameSite=None requires Secure)", () => {
    setEnv({ NODE_ENV: "development" });
    const opts = sessionCookieOptions(1800);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect((opts as { partitioned?: boolean }).partitioned).toBeUndefined();
  });
});

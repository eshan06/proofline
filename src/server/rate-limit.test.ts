import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

const limit = { capacity: 3, refillPerSec: 1 };

describe("token-bucket rate limiter", () => {
  it("allows up to capacity, then blocks", async () => {
    const key = `test-${Math.round(performance.now())}-a`;
    const t = 1_000_000;
    expect((await rateLimit(key, limit, t)).allowed).toBe(true);
    expect((await rateLimit(key, limit, t)).allowed).toBe(true);
    expect((await rateLimit(key, limit, t)).allowed).toBe(true);
    const blocked = await rateLimit(key, limit, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("refills over time", async () => {
    const key = `test-${Math.round(performance.now())}-b`;
    const t = 2_000_000;
    await rateLimit(key, limit, t);
    await rateLimit(key, limit, t);
    await rateLimit(key, limit, t);
    expect((await rateLimit(key, limit, t)).allowed).toBe(false);
    // 2 seconds later → 2 tokens refilled.
    expect((await rateLimit(key, limit, t + 2000)).allowed).toBe(true);
    expect((await rateLimit(key, limit, t + 2000)).allowed).toBe(true);
    expect((await rateLimit(key, limit, t + 2000)).allowed).toBe(false);
  });

  it("keys are independent", async () => {
    const t = 3_000_000;
    const a = `test-${Math.round(performance.now())}-c`;
    const b = `test-${Math.round(performance.now())}-d`;
    await rateLimit(a, limit, t);
    await rateLimit(a, limit, t);
    await rateLimit(a, limit, t);
    expect((await rateLimit(a, limit, t)).allowed).toBe(false);
    expect((await rateLimit(b, limit, t)).allowed).toBe(true);
  });
});

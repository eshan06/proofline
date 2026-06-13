import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

const limit = { capacity: 3, refillPerSec: 1 };

describe("token-bucket rate limiter", () => {
  it("allows up to capacity, then blocks", () => {
    const key = `test-${Math.round(performance.now())}-a`;
    const t = 1_000_000;
    expect(rateLimit(key, limit, t).allowed).toBe(true);
    expect(rateLimit(key, limit, t).allowed).toBe(true);
    expect(rateLimit(key, limit, t).allowed).toBe(true);
    const blocked = rateLimit(key, limit, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("refills over time", () => {
    const key = `test-${Math.round(performance.now())}-b`;
    const t = 2_000_000;
    rateLimit(key, limit, t);
    rateLimit(key, limit, t);
    rateLimit(key, limit, t);
    expect(rateLimit(key, limit, t).allowed).toBe(false);
    // 2 seconds later → 2 tokens refilled.
    expect(rateLimit(key, limit, t + 2000).allowed).toBe(true);
    expect(rateLimit(key, limit, t + 2000).allowed).toBe(true);
    expect(rateLimit(key, limit, t + 2000).allowed).toBe(false);
  });

  it("keys are independent", () => {
    const t = 3_000_000;
    const a = `test-${Math.round(performance.now())}-c`;
    const b = `test-${Math.round(performance.now())}-d`;
    rateLimit(a, limit, t);
    rateLimit(a, limit, t);
    rateLimit(a, limit, t);
    expect(rateLimit(a, limit, t).allowed).toBe(false);
    expect(rateLimit(b, limit, t).allowed).toBe(true);
  });
});

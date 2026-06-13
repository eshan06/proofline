/**
 * Token-bucket rate limiter. The default store is in-process (survives dev
 * reloads via a global); production swaps the RateStore for Redis/Upstash
 * behind the same interface so limits hold across instances.
 *
 * Used to protect auth (brute-force) and AI endpoints (cost/abuse). Demo AI
 * budget is enforced separately, per-session, in the repository.
 */

export interface RateStore {
  /** Returns the bucket state for a key, creating it full if absent. */
  take(key: string, capacity: number, refillPerSec: number, now: number): { allowed: boolean; remaining: number; retryAfterSec: number };
}

interface Bucket {
  tokens: number;
  updated: number;
}

class MemoryRateStore implements RateStore {
  private buckets: Map<string, Bucket>;
  constructor() {
    const g = globalThis as unknown as { __plRate?: Map<string, Bucket> };
    if (!g.__plRate) g.__plRate = new Map();
    this.buckets = g.__plRate;
  }
  take(key: string, capacity: number, refillPerSec: number, now: number) {
    const b = this.buckets.get(key) ?? { tokens: capacity, updated: now };
    const elapsed = (now - b.updated) / 1000;
    b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
    b.updated = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      this.buckets.set(key, b);
      return { allowed: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
    }
    this.buckets.set(key, b);
    const retryAfterSec = Math.ceil((1 - b.tokens) / refillPerSec);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
}

const store: RateStore = new MemoryRateStore();

export interface RateLimit {
  capacity: number;
  refillPerSec: number;
}

/** Named limits. Tune per endpoint class. */
export const LIMITS = {
  auth: { capacity: 10, refillPerSec: 10 / 60 }, // ~10 attempts/min, refills over a minute
  ai: { capacity: 20, refillPerSec: 20 / 60 }, // ~20 AI calls/min
  api: { capacity: 60, refillPerSec: 1 }, // 60/min general
} as const;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: RateLimit, now = Date.now()): RateResult {
  return store.take(key, limit.capacity, limit.refillPerSec, now);
}

/** Derive a client key from request headers (best-effort IP). */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

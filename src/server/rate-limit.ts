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

/**
 * Derive a client key from request headers, resistant to `x-forwarded-for`
 * spoofing.
 *
 * `x-forwarded-for` is an attacker-appendable list: `client, proxy1, proxy2`.
 * The *leftmost* entry is fully client-controlled (rotate it for a fresh
 * bucket), so we never trust it blindly. Set `RATE_LIMIT_PROXY_HOPS` to the
 * number of trusted proxies in front of the app (e.g. 1 for a single ALB /
 * Vercel edge); we then read the entry that many hops from the right, which is
 * the real client IP your own infrastructure observed. With no value set we
 * fall back to the rightmost entry — the address our immediate upstream
 * appended, which an external client cannot forge.
 */
export function clientKey(req: Request, scope: string): string {
  const hops = Number(process.env.RATE_LIMIT_PROXY_HOPS);
  const xff = req.headers.get("x-forwarded-for");
  let ip = "unknown";
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      const fromRight = Number.isFinite(hops) && hops > 0 ? hops : 1;
      ip = parts[Math.max(0, parts.length - fromRight)] ?? parts[parts.length - 1]!;
    }
  } else {
    ip = req.headers.get("x-real-ip")?.trim() || "unknown";
  }
  return `${scope}:${ip}`;
}

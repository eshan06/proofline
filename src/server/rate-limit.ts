/**
 * Token-bucket rate limiter. The default store is in-process (survives dev
 * reloads via a global); set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * to use a shared Redis store so limits hold across instances. The store is
 * async (a distributed backend is a network round-trip), so rateLimit /
 * enforceRateLimit are awaited.
 *
 * Used to protect auth (brute-force) and AI endpoints (cost/abuse). Demo AI
 * budget is enforced separately, per-session, in the repository.
 */

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateStore {
  /** Consume one token for a key, creating its bucket full if absent. */
  take(key: string, capacity: number, refillPerSec: number, now: number): Promise<RateResult>;
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
  async take(key: string, capacity: number, refillPerSec: number, now: number): Promise<RateResult> {
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

/**
 * Distributed token bucket on Upstash Redis via its REST API — no client lib
 * (one fetch, mirroring the Resend/Stripe/Gmail transports). A single EVAL runs
 * the refill+consume atomically server-side, so it's correct across instances.
 * Fails open (allow) if Redis is unreachable, so an outage degrades to local
 * behavior rather than locking everyone out.
 */
const BUCKET_LUA = `
local d = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local cap = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local tokens = tonumber(d[1])
local updated = tonumber(d[2])
if tokens == nil then tokens = cap; updated = now end
tokens = math.min(cap, tokens + ((now - updated) / 1000) * refill)
local allowed = 0
local retry = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1
else retry = math.ceil((1 - tokens) / refill) end
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'updated', now)
redis.call('PEXPIRE', KEYS[1], 3600000)
return {allowed, math.floor(tokens), retry}`;

class UpstashRateStore implements RateStore {
  constructor(private url: string, private token: string) {}
  async take(key: string, capacity: number, refillPerSec: number, now: number): Promise<RateResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(["EVAL", BUCKET_LUA, "1", key, String(capacity), String(refillPerSec), String(now)]),
      });
      if (!res.ok) throw new Error(`Upstash ${res.status}`);
      const [allowed, remaining, retryAfterSec] = ((await res.json()) as { result: [number, number, number] }).result;
      return { allowed: allowed === 1, remaining, retryAfterSec };
    } catch {
      // Fail open: a rate-limit backend outage must not take down the app.
      return { allowed: true, remaining: capacity, retryAfterSec: 0 };
    }
  }
}

function selectStore(): RateStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashRateStore(url, token);
  if (process.env.REDIS_URL) {
    // A raw redis:// URL needs a TCP client (ioredis) we deliberately don't
    // bundle; the dep-free path is Upstash's REST API. Use in-process meanwhile.
    // Use dynamic import to avoid a circular dependency (logger → rate-limit → logger).
    import("@/server/logger").then(({ logger }) =>
      logger.warn("rate_limit.redis_url_unsupported", { hint: "set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for distributed limits" })
    ).catch(() => {});
  }
  return new MemoryRateStore();
}

const store: RateStore = selectStore();

export interface RateLimit {
  capacity: number;
  refillPerSec: number;
}

/** Named limits. Tune per endpoint class. */
export const LIMITS = {
  auth: { capacity: 10, refillPerSec: 10 / 60 }, // ~10 attempts/min, refills over a minute
  ai: { capacity: 20, refillPerSec: 20 / 60 }, // ~20 AI calls/min
  api: { capacity: 60, refillPerSec: 1 }, // 60/min general
  // New widget conversations (each creates a ticket): tighter than general intake
  // so one IP can't flood a tenant's inbox with throwaway conversations.
  widgetNew: { capacity: 20, refillPerSec: 20 / 600 }, // ~20 burst, then ~2/min
  // KB upload runs synchronous parse + embedding on the request thread — gate it
  // so one privileged seat can't pin CPU/memory with back-to-back heavy uploads.
  upload: { capacity: 10, refillPerSec: 10 / 300 }, // ~10 burst, then ~2/min
} as const;

export function rateLimit(key: string, limit: RateLimit, now = Date.now()): Promise<RateResult> {
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

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily-constructed Drizzle client. Persistence is opt-in: with no
 * DATABASE_URL the app runs entirely on the in-memory repository (tests, demo,
 * zero-setup local dev). When DATABASE_URL is present, the repository layer
 * uses this client. Survives Next.js dev module reloads via a global.
 */

export type Db = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as {
  __plSql?: ReturnType<typeof postgres>;
  __plDb?: Db;
};

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * TLS policy for the connection. Local dev databases (Docker) speak plaintext;
 * managed Postgres (AWS RDS, Supabase, Neon, …) requires TLS but presents a
 * cert signed by a provider CA that isn't in Node's default trust store, so a
 * naive `sslmode=require` still fails verification.
 *
 * Strict verification (recommended in production): set `DB_CA_CERT` to the
 * provider's CA-bundle PEM (e.g. the Amazon RDS global bundle) — `\n`-escaped is
 * fine — and we verify against it. `DB_SSL=verify` forces strict verification
 * (use with `DB_CA_CERT` or `NODE_EXTRA_CA_CERTS`). `DB_SSL=disable` forces TLS
 * off. With none of these, a remote host is encrypted but NOT CA-verified (a
 * weaker posture we warn about once), and a local host is plaintext.
 */
type SslConfig = false | { rejectUnauthorized: boolean; ca?: string };

let warnedInsecureTls = false;
function warnInsecureTls(): void {
  if (warnedInsecureTls) return;
  warnedInsecureTls = true;
  console.warn(
    "[db] Connecting to a remote database with TLS but WITHOUT CA verification " +
      "(vulnerable to MITM). Set DB_CA_CERT (provider CA-bundle PEM) or DB_SSL=verify " +
      "with NODE_EXTRA_CA_CERTS to verify the server certificate.",
  );
}

export function sslConfig(url: string): SslConfig {
  const mode = process.env.DB_SSL;
  if (mode === "disable") return false;
  const ca = process.env.DB_CA_CERT?.replace(/\\n/g, "\n").trim() || undefined;
  if (mode === "verify") return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(url);
  if (isLocal) return false;
  // Remote, no explicit mode: verify against DB_CA_CERT if supplied, else encrypt
  // without verification (and warn — this is the weak default we want surfaced).
  if (ca) return { rejectUnauthorized: true, ca };
  warnInsecureTls();
  return { rejectUnauthorized: false };
}

export function getDb(): Db {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — the Postgres repository is unavailable.");
  }
  if (!g.__plDb) {
    const sql = postgres(process.env.DATABASE_URL, {
      max: Number(process.env.DB_POOL_MAX) || 10,
      idle_timeout: 20,
      // Next.js bundles this for server use; disable prepared statements for
      // compatibility with poolers (PgBouncer/RDS Proxy) in production.
      prepare: false,
      ssl: sslConfig(process.env.DATABASE_URL),
    });
    g.__plSql = sql;
    g.__plDb = drizzle(sql, { schema });
    registerShutdown();
  }
  return g.__plDb;
}

/**
 * Drain the pool on SIGTERM/SIGINT so a deploy/container-stop closes connections
 * cleanly. Registered here (a Node-only module loaded only by server code) on
 * first pool creation, rather than in instrumentation.ts which Next also traces
 * for the edge runtime where the Postgres driver can't be bundled.
 */
let shutdownRegistered = false;
function registerShutdown(): void {
  if (shutdownRegistered || process.env.NEXT_RUNTIME !== "nodejs") return;
  shutdownRegistered = true;
  const handle = (signal: string) => {
    closeDb()
      .catch(() => {})
      .finally(() => process.exit(0));
    void signal;
  };
  process.once("SIGTERM", () => handle("SIGTERM"));
  process.once("SIGINT", () => handle("SIGINT"));
}

/** Raw client for migrations / extension setup. */
export function getSql() {
  getDb();
  return g.__plSql!;
}

/**
 * Close the connection pool if one was opened. Called on graceful shutdown
 * (see src/instrumentation.ts) so in-flight queries drain and sockets close
 * cleanly on deploy/SIGTERM instead of being severed. No-op if never connected.
 */
export async function closeDb(): Promise<void> {
  if (g.__plSql) {
    const sql = g.__plSql;
    g.__plSql = undefined;
    g.__plDb = undefined;
    await sql.end({ timeout: 5 });
  }
}

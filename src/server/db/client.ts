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
 * naive `sslmode=require` still fails verification. We therefore encrypt
 * without strict CA verification for remote hosts. `DB_SSL` overrides:
 * `disable` (force off) or `verify` (strict — set `NODE_EXTRA_CA_CERTS` to the
 * provider CA bundle). Hardening TODO: ship the RDS CA bundle and default to verify.
 */
export function sslConfig(url: string): false | { rejectUnauthorized: boolean } {
  const mode = process.env.DB_SSL;
  if (mode === "disable") return false;
  if (mode === "verify") return { rejectUnauthorized: true };
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(url);
  return isLocal ? false : { rejectUnauthorized: false };
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
  }
  return g.__plDb;
}

/** Raw client for migrations / extension setup. */
export function getSql() {
  getDb();
  return g.__plSql!;
}

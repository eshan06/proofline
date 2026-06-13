import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Migration runner. Ensures the pgvector extension exists (drizzle-kit doesn't
 * create extensions), then applies the generated migrations in ./drizzle.
 * Run with: npm run db:migrate
 *
 * TLS policy mirrors db/client.ts sslConfig (kept inline so this script runs
 * under bare `node --experimental-strip-types` with no local-module imports):
 * remote/managed Postgres needs TLS but presents a provider-CA cert, so encrypt
 * without strict verification unless DB_SSL overrides.
 */
function sslConfig(url: string): false | { rejectUnauthorized: boolean } {
  if (process.env.DB_SSL === "disable") return false;
  if (process.env.DB_SSL === "verify") return { rejectUnauthorized: true };
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(url);
  return isLocal ? false : { rejectUnauthorized: false };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to migrate.");

  const sql = postgres(url, { max: 1, ssl: sslConfig(url) });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] complete");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});

// Database migration runner — plain ESM so it runs on any Node 18+ (no
// --experimental-strip-types, which varies by build). Ensures the pgvector
// extension exists, then applies the SQL migrations in ./drizzle.
//
//   DATABASE_URL=postgres://… npm run db:migrate
//
// Run this from a full repo checkout (CI release step or locally) against the
// target database — not from the slim standalone image.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is required.");
  process.exit(1);
}

// Mirrors db/client.ts sslConfig: managed Postgres needs TLS but presents a
// provider-CA cert, so encrypt without strict verification unless DB_SSL overrides.
function sslConfig(u) {
  if (process.env.DB_SSL === "disable") return false;
  if (process.env.DB_SSL === "verify") return { rejectUnauthorized: true };
  return /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(u) ? false : { rejectUnauthorized: false };
}

const sql = postgres(url, { max: 1, ssl: sslConfig(url) });
try {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("[migrate] complete");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}

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

// Mirrors db/client.ts sslConfig exactly, INCLUDING DB_CA_CERT: a strict-TLS
// runtime (DB_CA_CERT set) must use the same verified channel for migrations,
// or db:migrate would fail / run over an unverified connection.
function sslConfig(u) {
  if (process.env.DB_SSL === "disable") return false;
  const ca = process.env.DB_CA_CERT?.replace(/\\n/g, "\n").trim() || undefined;
  if (process.env.DB_SSL === "verify") return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/.test(u);
  if (isLocal) return false;
  if (ca) return { rejectUnauthorized: true, ca };
  return { rejectUnauthorized: false };
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

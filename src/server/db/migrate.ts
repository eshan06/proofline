import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Migration runner. Ensures the pgvector extension exists (drizzle-kit doesn't
 * create extensions), then applies the generated migrations in ./drizzle.
 * Run with: npm run db:migrate
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to migrate.");

  const sql = postgres(url, { max: 1 });
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

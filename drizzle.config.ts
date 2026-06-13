import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:proofline@localhost:5432/proofline",
  },
  // pgvector + hnsw indexes are created in the migration bootstrap (see db/migrate.ts).
  verbose: true,
  strict: true,
});

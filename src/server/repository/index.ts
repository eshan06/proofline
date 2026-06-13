import { hasDatabase } from "@/server/db/client";
import { MemoryRepository } from "./memory";
import { PgRepository } from "./pg";
import type { Repository } from "./types";

export { NotFoundError } from "./types";
export type { Repository, SessionInfo, UserRecord } from "./types";

/**
 * The single repository instance. Postgres when DATABASE_URL is set, otherwise
 * the in-memory store (tests, demo, zero-setup dev). Survives dev reloads.
 */
const g = globalThis as unknown as { __plRepo?: Repository };

export function repo(): Repository {
  if (!g.__plRepo) {
    g.__plRepo = hasDatabase() ? new PgRepository() : new MemoryRepository();
  }
  return g.__plRepo;
}

export function repoKind(): "postgres" | "memory" {
  return hasDatabase() ? "postgres" : "memory";
}

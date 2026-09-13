import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { assertDatabaseEnvironment } from "@/server/config/cloud-environment";

import * as schema from "./schema";

const globalForDatabase = globalThis as typeof globalThis & {
  databasePool?: Pool;
};

function getPool(): Pool {
  assertDatabaseEnvironment(process.env);

  if (!globalForDatabase.databasePool) {
    globalForDatabase.databasePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5_000,
    });
  }

  return globalForDatabase.databasePool;
}

export function getDatabase() {
  return drizzle(getPool(), { schema });
}

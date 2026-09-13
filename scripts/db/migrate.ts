import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import {
  assertDatabaseEnvironment,
  assertProductionDeployment,
} from "@/server/config/cloud-environment";

async function run(): Promise<void> {
  const connectionString =
    process.env.APP_ENV === "production"
      ? (() => {
          assertProductionDeployment(process.env);
          if (!process.env.NEON_BACKUP_DATABASE_URL) {
            throw new Error(
              "NEON_BACKUP_DATABASE_URL is required for a production migration.",
            );
          }
          return process.env.NEON_BACKUP_DATABASE_URL;
        })()
      : (() => {
          assertDatabaseEnvironment(process.env);
          return process.env.DATABASE_URL as string;
        })();

  const pool = new Pool({ connectionString, max: 1 });

  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});

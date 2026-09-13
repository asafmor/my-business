import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { assertProductionDeployment } from "@/server/config/cloud-environment";

async function run(): Promise<void> {
  assertProductionDeployment(process.env);

  const connectionString = process.env.NEON_BACKUP_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "NEON_BACKUP_DATABASE_URL is required to run database migrations.",
    );
  }

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

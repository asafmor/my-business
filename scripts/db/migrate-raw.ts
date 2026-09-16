/**
 * Applies drizzle/ migrations to whatever Postgres connection string is
 * given via DATABASE_URL, with none of scripts/db/migrate.ts's Neon/
 * production safety assertions (assertDatabaseEnvironment requires a
 * "-pooler" Neon hostname, which a disposable non-Neon target can never
 * have). Only for restore-test.yml's throwaway service-container Postgres.
 * Never use this against a real Development/Production database - use
 * `npm run db:migrate` (scripts/db/migrate.ts) for that.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

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

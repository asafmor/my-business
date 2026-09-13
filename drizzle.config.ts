import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Generation is offline. The migration script validates its own development
  // or production connection target before applying a committed migration.
  dbCredentials: {
    url:
      process.env.NEON_BACKUP_DATABASE_URL ??
      "postgresql://invalid:invalid@invalid.invalid:5432/invalid",
  },
} satisfies Config;

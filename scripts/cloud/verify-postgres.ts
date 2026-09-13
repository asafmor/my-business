import { Client } from "pg";

import { assertDatabaseEnvironment } from "../../src/server/config/cloud-environment";

assertDatabaseEnvironment(process.env);
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query<{ connected: number }>(
    "select 1 as connected",
  );

  if (result.rows[0]?.connected !== 1) {
    throw new Error("PostgreSQL returned an unexpected connectivity result.");
  }

  console.log("Server-side PostgreSQL connectivity verified.");
} finally {
  await client.end().catch(() => undefined);
}

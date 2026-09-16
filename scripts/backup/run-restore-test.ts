/**
 * Monthly scheduled restore test (SPEC.md #36 / PLAN.md
 * 21-scheduled-restore-testing): pick the latest verified B2 database
 * backup, restore it into a throwaway PostgreSQL target (a GitHub Actions
 * service container - see .github/workflows/restore-test.yml), and run a
 * handful of integrity checks beyond schema-only validation. On success,
 * record a `restore_test` row in the real `backup_runs` table so the app
 * can show when a restore last actually succeeded.
 *
 * 21.1: picking/downloading/verifying/restoring the backup reuses
 * restore-database.ts's exported functions directly - this script only
 * adds what's new: a throwaway target instead of a real one (handled by the
 * workflow, not this script) and the 21.2 integrity checks below.
 *
 * Safety: exactly like restore-database.ts, the restore target is always
 * RESTORE_TARGET_DATABASE_URL. The *success record*, however, is written
 * with NEON_BACKUP_DATABASE_URL - the real backup-tracking database - since
 * the throwaway container is destroyed when the job ends and isn't where
 * operational history belongs. These two databases must never be the same.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";

import {
  recordBackupRun,
  formatErrorWithCause,
  withBackupRunRecorder,
} from "./record-run";
import {
  downloadDump,
  expectedTables,
  listDatabaseBackups,
  resolveBackupKey,
  runPgRestore,
  validateRestoredSchema,
  verifyDumpSha256,
} from "./restore-database";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type QueryableDatabase = { query(sql: string): Promise<unknown> };

// 21.2 representative-records-readable: a restored table being empty (e.g.
// Development has few documents) is not a failure - only a query error is.
export async function checkRepresentativeRecordsReadable(
  database: QueryableDatabase,
  tables: readonly string[] = ["documents", "expenses"],
): Promise<void> {
  for (const table of tables) {
    await database.query(`select * from "${table}" limit 5`);
  }
}

export type ForeignKeyRelation = {
  child: string;
  column: string;
  parent: string;
  parentColumn: string;
};

// 21.2 foreign-keys-consistent: the schema's real FK constraints should
// already prevent orphans in a correctly restored dump, so this is a
// "did the restore complete correctly" check, not a routine expectation of
// failure - a handful of hardcoded relations, not a generic constraint
// introspector (see src/server/db/schema.ts for the source of truth).
export const foreignKeyRelations: ForeignKeyRelation[] = [
  {
    child: "document_files",
    column: "document_id",
    parent: "documents",
    parentColumn: "id",
  },
  {
    child: "expenses",
    column: "document_id",
    parent: "documents",
    parentColumn: "id",
  },
  {
    child: "expenses",
    column: "category_id",
    parent: "categories",
    parentColumn: "id",
  },
  {
    child: "extractions",
    column: "document_id",
    parent: "documents",
    parentColumn: "id",
  },
  {
    child: "processing_tasks",
    column: "document_id",
    parent: "documents",
    parentColumn: "id",
  },
  {
    child: "reports",
    column: "document_id",
    parent: "documents",
    parentColumn: "id",
  },
  {
    child: "reports",
    column: "file_id",
    parent: "document_files",
    parentColumn: "id",
  },
];

type CountableDatabase = {
  query(sql: string): Promise<{ rows: { count: string }[] }>;
};

export async function checkForeignKeysConsistent(
  database: CountableDatabase,
  relations: readonly ForeignKeyRelation[] = foreignKeyRelations,
): Promise<void> {
  const violations: string[] = [];
  for (const relation of relations) {
    const result = await database.query(
      `select count(*) as count from "${relation.child}" c ` +
        `where c."${relation.column}" is not null ` +
        `and not exists (select 1 from "${relation.parent}" p where p."${relation.parentColumn}" = c."${relation.column}")`,
    );
    const orphanCount = Number(result.rows[0]?.count ?? 0);
    if (orphanCount > 0) {
      violations.push(
        `${relation.child}.${relation.column} -> ${relation.parent}.${relation.parentColumn} (${orphanCount} orphan row(s))`,
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `Restored database has foreign-key violations: ${violations.join("; ")}.`,
    );
  }
}

// 21.2 latest-schema-compatible: validateRestoredSchema (imported above)
// already checks every current-schema table is queryable against the
// restored dump. A full column-level schema diff is out of scope here
// (YAGNI) - "current schema's tables are queryable against the restored
// dump" is the practical definition of compatibility this script uses.

async function main(): Promise<void> {
  const targetUrl = required("RESTORE_TARGET_DATABASE_URL");
  const neonBackupUrl = required("NEON_BACKUP_DATABASE_URL");
  if (targetUrl === neonBackupUrl || targetUrl === process.env.DATABASE_URL) {
    throw new Error(
      "RESTORE_TARGET_DATABASE_URL must not be the same as DATABASE_URL or NEON_BACKUP_DATABASE_URL - it must point at a throwaway target.",
    );
  }

  const bucket = required("B2_BUCKET");
  const client = new S3Client({
    credentials: {
      accessKeyId: required("B2_ACCESS_KEY_ID"),
      secretAccessKey: required("B2_SECRET_ACCESS_KEY"),
    },
    endpoint: required("B2_ENDPOINT"),
    forcePathStyle: true,
    region: required("B2_REGION"),
  });

  const requested = process.argv[2];
  const backups = await listDatabaseBackups(client, bucket);
  const key = resolveBackupKey(requested, backups);
  const outFile = join(tmpdir(), `my-business-restore-test-${Date.now()}.dump`);

  try {
    await downloadDump(client, bucket, key, outFile);
    await verifyDumpSha256(client, bucket, key, outFile);
    await runPgRestore(targetUrl, outFile);

    const pool = new Pool({ connectionString: targetUrl, max: 1 });
    try {
      await validateRestoredSchema(pool, expectedTables);
      await checkRepresentativeRecordsReadable(pool);
      await checkForeignKeysConsistent(pool);
    } finally {
      await pool.end();
    }

    // 21.3: only after every check above passes - a row's mere existence
    // means "verified success", same convention as the other backup kinds.
    const ranAt = new Date();
    await withBackupRunRecorder(neonBackupUrl, (database) =>
      recordBackupRun(database, {
        kind: "restore_test",
        ranAt,
        detail: `restored ${key} into throwaway target and passed integrity checks`,
      }),
    );

    console.log(`Restore test passed for ${key}.`);
  } finally {
    rmSync(outFile, { force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      formatErrorWithCause(error),
    );
    process.exitCode = 1;
  });
}

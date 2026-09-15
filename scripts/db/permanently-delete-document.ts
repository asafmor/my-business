import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { assertDatabaseEnvironment } from "@/server/config/cloud-environment";
import {
  auditEvents,
  documentFiles,
  documents,
  expenses,
  extractions,
  processingTasks,
  reports,
} from "@/server/db/schema";

/**
 * Deliberate, separate permanent-deletion operation (SPEC.md #49). Not wired
 * into the normal document detail UI — archive is the normal "delete".
 *
 * Only removes database rows; original files in object storage are left in
 * place (independent backup retention may still hold a copy per SPEC.md #49)
 * and must be cleaned up separately if desired.
 *
 * Usage: npm run db:permanently-delete-document -- <documentId>
 */
async function run(): Promise<void> {
  const documentId = process.argv[2];
  if (!documentId) {
    throw new Error("Usage: db:permanently-delete-document -- <documentId>");
  }

  assertDatabaseEnvironment(process.env);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool);

  try {
    await db.transaction(async (transaction) => {
      const [document] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1)
        .for("update");
      if (!document) throw new Error(`Document ${documentId} not found.`);
      if (document.status !== "ARCHIVED") {
        throw new Error(
          "Only archived documents can be permanently deleted. Archive it first.",
        );
      }

      const [expense] = await transaction
        .select({ id: expenses.id })
        .from(expenses)
        .where(eq(expenses.documentId, documentId))
        .limit(1);

      await transaction
        .delete(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "DOCUMENT"),
            eq(auditEvents.entityId, documentId),
          ),
        );
      if (expense) {
        await transaction
          .delete(auditEvents)
          .where(
            and(
              eq(auditEvents.entityType, "EXPENSE"),
              eq(auditEvents.entityId, expense.id),
            ),
          );
      }
      await transaction
        .delete(reports)
        .where(eq(reports.documentId, documentId));
      await transaction
        .delete(processingTasks)
        .where(eq(processingTasks.documentId, documentId));
      await transaction
        .delete(extractions)
        .where(eq(extractions.documentId, documentId));
      await transaction
        .delete(expenses)
        .where(eq(expenses.documentId, documentId));
      await transaction
        .delete(documentFiles)
        .where(eq(documentFiles.documentId, documentId));
      await transaction.delete(documents).where(eq(documents.id, documentId));
    });
    console.log(`Permanently deleted document ${documentId}.`);
  } finally {
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Permanent deletion failed.",
  );
  process.exitCode = 1;
});

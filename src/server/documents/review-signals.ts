import "server-only";

import { inArray, sql } from "drizzle-orm";

import type { JsonObject } from "../../domain/documents/types";
import type { getDatabase } from "../db/client";
import { documents, extractions } from "../db/schema";

// An exact-hash duplicate (SPEC.md #8) of any other non-archived document.
// Fuzzy duplicate detection (supplier/date/amount) is explicitly deferred.
// Shared by inbox-query-repository.ts and monthly-report-repository.ts.
export const isDuplicateExpr = sql<boolean>`exists (
  select 1 from documents as other_document
  where other_document.sha256 = ${documents.sha256}
    and other_document.id <> ${documents.id}
    and other_document.status <> 'ARCHIVED'
)`;

/** Attaches each document's latest extraction's reviewReasons, for display via attention-reasons.ts. */
export async function attachReviewReasons<T extends { id: string }>(
  database: ReturnType<typeof getDatabase>,
  rows: T[],
): Promise<(T & { reviewReasons: string[] })[]> {
  if (rows.length === 0) return [];

  const extractionRows = await database
    .select({
      createdAt: extractions.createdAt,
      documentId: extractions.documentId,
      normalizedResult: extractions.normalizedResult,
    })
    .from(extractions)
    .where(
      inArray(
        extractions.documentId,
        rows.map((row) => row.id),
      ),
    );

  const latest = new Map<
    string,
    { createdAt: Date; normalizedResult: JsonObject }
  >();
  for (const extraction of extractionRows) {
    const current = latest.get(extraction.documentId);
    if (!current || extraction.createdAt > current.createdAt) {
      latest.set(extraction.documentId, extraction);
    }
  }

  return rows.map((row) => {
    const reviewReasons = latest.get(row.id)?.normalizedResult.reviewReasons;
    return {
      ...row,
      reviewReasons: Array.isArray(reviewReasons)
        ? (reviewReasons as string[])
        : [],
    };
  });
}

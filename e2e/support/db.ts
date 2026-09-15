import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  categories,
  documentFiles,
  documents,
  expenses,
} from "../../src/server/db/schema";

// Direct Drizzle access against Development, mirroring scripts/db/*.ts.
// Seeding bypasses the AI call entirely (no OpenAI cost, deterministic) -
// see the 23-testing scope note in CONTRIBUTING.md.
let pool: Pool | undefined;

function db() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return drizzle(pool);
}

// The ORIGINAL document_files row this module seeds can never be deleted
// (drizzle/0000_good_mojo.sql's immutability trigger blocks UPDATE/DELETE on
// kind='ORIGINAL' rows - see deleteSeededDocument below), so it must have a
// *real* backing R2 object from the moment it's created, or every future
// `npm run db:check-consistency` run reports it as permanently missing.
// Mirrors the R2 client construction in scripts/db/check-consistency.ts.
function r2Client(): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
  });
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type SeededDocument = { id: string; supplierName: string };

/** Inserts a document + original file + expense directly, skipping AI extraction. */
export async function seedReviewableDocument(
  overrides: {
    status?: "FAILED" | "NEEDS_REVIEW" | "READY";
    supplierName?: string;
  } = {},
): Promise<SeededDocument> {
  const database = db();
  const id = randomUUID();
  const sha256 = randomUUID().replaceAll("-", "").padEnd(64, "0");
  const supplierName =
    overrides.supplierName ?? `E2E Supplier ${id.slice(0, 8)}`;

  await database.insert(documents).values({
    id,
    sha256,
    status: overrides.status ?? "NEEDS_REVIEW",
    transactionDate: "2026-09-01",
    type: "RECEIPT",
  });
  const objectKey = `documents/${id}/original`;
  const bucket = process.env.R2_BUCKET ?? "e2e";
  const body = new TextEncoder().encode(`e2e placeholder for ${id}`);
  await r2Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucket,
      ContentType: "application/pdf",
      Key: objectKey,
      Metadata: { sha256 },
    }),
  );
  await database.insert(documentFiles).values({
    bucket,
    documentId: id,
    kind: "ORIGINAL",
    mimeType: "application/pdf",
    objectKey,
    sha256,
    sizeBytes: body.byteLength,
    storageProvider: "R2",
  });
  await database.insert(expenses).values({
    currency: "ILS",
    documentId: id,
    subtotal: "100.00",
    supplierName,
    total: "117.00",
    transactionDate: "2026-09-01",
    vat: "17.00",
  });

  return { id, supplierName };
}

/**
 * Cleans up after a seeded test document. The ORIGINAL document_files row is
 * genuinely immutable (drizzle/0000_good_mojo.sql's
 * document_files_prevent_original_mutation trigger blocks UPDATE and DELETE
 * on it by design, per SPEC.md's document-retention guarantee), so the row
 * cannot be deleted - only archiving the document is possible. The R2
 * placeholder object created in seedReviewableDocument is left in place to
 * match (db:check-consistency would otherwise report this row as a
 * permanently missing R2 object forever - it isn't optional cleanup).
 * ponytail: leaves a small ARCHIVED row + placeholder object per e2e run in
 * Development; fine at this suite's size, revisit with a dedicated e2e-only
 * bucket/prefix if it ever grows enough to matter.
 */
export async function deleteSeededDocument(id: string): Promise<void> {
  const database = db();
  await database.delete(expenses).where(eq(expenses.documentId, id));
  await database
    .update(documents)
    .set({ status: "ARCHIVED" })
    .where(eq(documents.id, id));
}

export async function anyActiveCategory(): Promise<{
  id: string;
  name: string;
} | null> {
  const database = db();
  const [category] = await database
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
    .limit(1);

  return category ?? null;
}

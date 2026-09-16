"use server";

import { revalidatePath } from "next/cache";

import { DrizzleDocumentDetailRepository } from "../../../server/documents/document-detail-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleDocumentDetailRepository();

/* The table acts in place, so an action answers rather than redirects. */
export type DocumentActionResult = { error: string | null };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ids arrive from the browser, so they are checked before they reach a query. */
function validIds(ids: readonly string[]): string[] {
  return ids.filter((id) => uuidPattern.test(id));
}

function done(): DocumentActionResult {
  revalidatePath("/documents");
  revalidatePath("/");
  return { error: null };
}

export async function setDocumentsCategoryAction(
  documentIds: readonly string[],
  categoryId: string,
): Promise<DocumentActionResult> {
  await requireSession();
  if (!uuidPattern.test(categoryId)) return { error: "Pick a category." };

  const ids = validIds(documentIds);
  if (ids.length === 0) return { error: "Select at least one document." };

  await repository.setCategory(ids, categoryId);
  for (const id of ids) revalidatePath(`/documents/${id}`);
  return done();
}

export async function markDocumentsReviewedAction(
  documentIds: readonly string[],
): Promise<DocumentActionResult> {
  await requireSession();
  const ids = validIds(documentIds);
  if (ids.length === 0) return { error: "Select at least one document." };

  // Sequential on purpose: each call takes a row lock, and a batch here is a
  // page of documents, not a migration.
  for (const id of ids) {
    await repository.markReviewed(id);
    revalidatePath(`/documents/${id}`);
  }
  return done();
}

export async function archiveDocumentsAction(
  documentIds: readonly string[],
): Promise<DocumentActionResult> {
  await requireSession();
  const ids = validIds(documentIds);
  if (ids.length === 0) return { error: "Select at least one document." };

  for (const id of ids) {
    await repository.archive(id);
    revalidatePath(`/documents/${id}`);
  }
  return done();
}

export async function unarchiveDocumentsAction(
  documentIds: readonly string[],
): Promise<DocumentActionResult> {
  await requireSession();
  const ids = validIds(documentIds);
  if (ids.length === 0) return { error: "Select at least one document." };

  for (const id of ids) {
    await repository.unarchive(id);
    revalidatePath(`/documents/${id}`);
  }
  return done();
}

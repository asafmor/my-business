"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { documentEditInputSchema } from "../../../../domain/validation";
import { getBackgroundProcessingService } from "../../../../server/documents/background-processing-runtime";
import { DrizzleDocumentDetailRepository } from "../../../../server/documents/document-detail-repository";
import { dispatchDueDocumentProcessing } from "../../../../server/documents/processing-dispatcher";
import { requireSession } from "../../../../server/auth/service";

export type DocumentEditFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

const repository = new DrizzleDocumentDetailRepository();

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function saveDocumentEditAction(
  documentId: string,
  _previousState: DocumentEditFormState,
  formData: FormData,
): Promise<DocumentEditFormState> {
  await requireSession();

  const parsed = documentEditInputSchema.safeParse({
    businessUsePercentage:
      emptyToNull(formData.get("businessUsePercentage")) ?? "100",
    categoryId: emptyToNull(formData.get("categoryId")),
    currency: emptyToNull(formData.get("currency"))?.toUpperCase() ?? null,
    documentId,
    documentNumber: emptyToNull(formData.get("documentNumber")),
    documentType: formData.get("documentType"),
    notes: emptyToNull(formData.get("notes")),
    paymentMethod: emptyToNull(formData.get("paymentMethod")),
    subtotal: emptyToNull(formData.get("subtotal")),
    supplierName: emptyToNull(formData.get("supplierName")),
    total: emptyToNull(formData.get("total")),
    transactionDate: emptyToNull(formData.get("transactionDate")),
    vat: emptyToNull(formData.get("vat")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  await repository.saveEdit(parsed.data);
  // The list shows supplier, date, total and category, so an edit changes a row
  // there too - archiving already revalidates it and saving must as well.
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/");
  return { error: null, fieldErrors: {} };
}

export async function markReviewedAction(documentId: string): Promise<void> {
  await requireSession();
  await repository.markReviewed(documentId);
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/");
}

export async function reprocessDocumentAction(
  documentId: string,
): Promise<void> {
  await requireSession();
  const queued = await getBackgroundProcessingService().retry(documentId);
  if (queued) dispatchDueDocumentProcessing();
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/");
}

export async function archiveDocumentAction(documentId: string): Promise<void> {
  await requireSession();
  await repository.archive(documentId);
  revalidatePath("/documents");
  redirect("/documents");
}

/* Restoring keeps the reader on the document, since the point of undoing an
   archive is usually to carry on working with it. */
export async function unarchiveDocumentAction(
  documentId: string,
): Promise<void> {
  await requireSession();
  await repository.unarchive(documentId);
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/");
}

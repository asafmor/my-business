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
  /** Counts successful saves so the form can tell one from the next. */
  saved: number;
};

const repository = new DrizzleDocumentDetailRepository();

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/* "45" and "45.5" are what people type; the ledger stores "45.00" and "45.50". */
function normalizeMoney(value: string | null): string | null {
  if (value === null) return null;
  const plain = value.replace(/[,\s]/g, "");
  return /^-?\d+(?:\.\d{1,2})?$/.test(plain) ? Number(plain).toFixed(2) : value;
}

// The zod messages describe the schema; these describe the fix.
const fieldMessages: Record<string, string> = {
  businessUsePercentage: "Enter a percentage between 0 and 100.",
  currency: "Use a three-letter code such as ILS or USD.",
  subtotal: "Enter an amount such as 280.00.",
  total: "Enter an amount such as 280.00.",
  transactionDate: "Enter a valid date.",
  vat: "Enter an amount such as 42.71.",
};

export async function saveDocumentEditAction(
  documentId: string,
  previousState: DocumentEditFormState,
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
    subtotal: normalizeMoney(emptyToNull(formData.get("subtotal"))),
    supplierName: emptyToNull(formData.get("supplierName")),
    total: normalizeMoney(emptyToNull(formData.get("total"))),
    transactionDate: emptyToNull(formData.get("transactionDate")),
    vat: normalizeMoney(emptyToNull(formData.get("vat"))),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = fieldMessages[key] ?? issue.message;
      }
    }
    return {
      error: "Some fields need attention before this can be saved.",
      fieldErrors,
      saved: previousState.saved,
    };
  }

  await repository.saveEdit(parsed.data);
  // The list shows supplier, date, total and category, so an edit changes a row
  // there too - archiving already revalidates it and saving must as well.
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/");
  return { error: null, fieldErrors: {}, saved: previousState.saved + 1 };
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

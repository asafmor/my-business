import { notFound } from "next/navigation";

import {
  archiveDocumentAction,
  markReviewedAction,
  reprocessDocumentAction,
  saveDocumentEditAction,
} from "./actions";
import { DocumentEditForm } from "../../../../components/documents/document-edit-form";
import { formatAuditChange } from "../../../../domain/documents/audit-change";
import { formatDate, formatDateTime, formatMoney, humanizeEnumValue } from "../../../../lib/format";
import { parseObjectKey } from "../../../../server/storage/object-keys";
import { createPrivateReadUrl } from "../../../../server/storage/private-access";
import { getR2ObjectStorage } from "../../../../server/storage/object-storage";
import { DrizzleDocumentDetailRepository } from "../../../../server/documents/document-detail-repository";
import { requireSession } from "../../../../server/auth/service";

const repository = new DrizzleDocumentDetailRepository();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();

  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const detail = await repository.getDetail(id);
  if (!detail) notFound();

  const originalFile = detail.files.find((file) => file.kind === "ORIGINAL") ?? null;
  const previewUrl = originalFile
    ? await createPrivateReadUrl(getR2ObjectStorage(), {
        authorize: () => {},
        key: parseObjectKey(originalFile.objectKey),
      }).then((signed) => signed.url)
    : null;

  const latestExtraction = detail.extractions[0] ?? null;
  const reviewReasons = Array.isArray(latestExtraction?.normalizedResult.reviewReasons)
    ? (latestExtraction.normalizedResult.reviewReasons as string[])
    : [];

  const values = {
    businessUsePercentage: detail.expense?.businessUsePercentage ?? "100",
    categoryId: detail.expense?.categoryId ?? null,
    currency: detail.expense?.currency ?? null,
    documentNumber: detail.expense?.documentNumber ?? null,
    documentType: detail.document.type,
    notes: detail.expense?.notes ?? null,
    paymentMethod: detail.expense?.paymentMethod ?? null,
    subtotal: detail.expense?.subtotal ?? null,
    supplierName: detail.expense?.supplierName ?? null,
    total: detail.expense?.total ?? null,
    transactionDate: detail.expense?.transactionDate ?? detail.document.transactionDate,
    vat: detail.expense?.vat ?? null,
  };

  const manualFields = new Set([...detail.manualDocumentFields, ...detail.manualExpenseFields]);
  const categoryNameById = Object.fromEntries(
    detail.categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="page document-detail">
      <h1 className="page-heading">{detail.expense?.supplierName ?? "Document"}</h1>

      {detail.document.status === "NEEDS_REVIEW" && (
        <p className="content-state content-state--warning">
          Needs review{reviewReasons.length > 0 ? `: ${reviewReasons.map(humanizeEnumValue).join(", ")}` : ""}
        </p>
      )}
      {detail.document.status === "FAILED" && (
        <p className="content-state content-state--warning">
          Processing failed. Reprocess to try again, or edit the fields below manually.
        </p>
      )}

      <div className="document-detail__layout">
        <div className="document-detail__preview">
          {previewUrl ? (
            originalFile?.mimeType.startsWith("image/") ? (
              <a href={previewUrl} rel="noreferrer" target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Document preview (tap to open full size)" src={previewUrl} />
              </a>
            ) : (
              <a href={previewUrl} rel="noreferrer" target="_blank">
                Open original file
              </a>
            )
          ) : (
            <p className="content-state">No file on record.</p>
          )}
        </div>

        <div className="document-detail__fields">
          <DocumentEditForm
            action={saveDocumentEditAction.bind(null, id)}
            categories={detail.categories}
            manualFields={manualFields}
            values={values}
          />

          <div className="document-detail__actions">
            <form action={markReviewedAction.bind(null, id)}>
              <button className="button button--secondary" type="submit">
                Mark reviewed
              </button>
            </form>
            <form action={reprocessDocumentAction.bind(null, id)}>
              <button className="button button--secondary" type="submit">
                Reprocess
              </button>
            </form>
            <form action={archiveDocumentAction.bind(null, id)}>
              <button className="button button--secondary" type="submit">
                Archive
              </button>
            </form>
          </div>
        </div>
      </div>

      <details className="document-detail__advanced">
        <summary>Extraction history</summary>
        <ul className="data-list">
          {detail.extractions.map((extraction) => (
            <li className="data-list__item" key={extraction.id}>
              {extraction.provider}/{extraction.model} · {formatDateTime(extraction.createdAt)}
            </li>
          ))}
          {detail.extractions.length === 0 && <li className="data-list__item">None yet.</li>}
        </ul>
      </details>

      <details className="document-detail__advanced">
        <summary>Raw extraction (debug)</summary>
        <pre>{JSON.stringify(latestExtraction?.rawResult ?? null, null, 2)}</pre>
      </details>

      <details className="document-detail__advanced">
        <summary>File metadata</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>MIME type</th>
              <th>Size</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {detail.files.map((file) => (
              <tr key={file.id}>
                <td>{humanizeEnumValue(file.kind)}</td>
                <td>{file.mimeType}</td>
                <td>{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                <td>{formatDateTime(file.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="document-detail__advanced">
        <summary>Audit history</summary>
        <ul className="data-list">
          {detail.auditEvents.map((event) => {
            const change = formatAuditChange(event, categoryNameById);
            return (
              <li className="data-list__item" key={event.id}>
                {formatDateTime(event.createdAt)} · {humanizeEnumValue(event.action)}
                {event.field ? ` · ${event.field}` : ""} · {humanizeEnumValue(event.source)}
                {change ? ` (${change})` : ""}
              </li>
            );
          })}
          {detail.auditEvents.length === 0 && <li className="data-list__item">No audit events.</li>}
        </ul>
      </details>

      <p className="content-state">
        Category: {detail.categoryName ?? "Uncategorized"} · Total: {formatMoney(values.total, detail.expense?.currency ?? null)} · Date: {formatDate(values.transactionDate)}
      </p>
    </div>
  );
}

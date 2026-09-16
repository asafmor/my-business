import {
  Archive,
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveDocumentEditAction } from "./actions";
import { DocumentActions } from "../../../../components/documents/document-actions";
import { DocumentActivity } from "../../../../components/documents/document-activity";
import {
  DocumentDetails,
  type DocumentValues,
} from "../../../../components/documents/document-details";
import { DocumentPreview } from "../../../../components/documents/document-preview";
import { DocumentTechnical } from "../../../../components/documents/document-technical";
import { ProcessingWatcher } from "../../../../components/documents/processing-watcher";
import { LocalDateTime } from "../../../../components/ui/local-date-time";
import {
  failureReasonSentence,
  reviewReasonField,
  reviewReasonSentence,
} from "../../../../domain/documents/attention-reasons";
import { statusTone } from "../../../../domain/documents/status-tone";
import {
  defaultCurrency,
  formatDateLong,
  formatMoney,
  humanizeEnumValue,
} from "../../../../lib/format";
import { parseObjectKey } from "../../../../server/storage/object-keys";
import { createPrivateReadUrl } from "../../../../server/storage/private-access";
import { getR2ObjectStorage } from "../../../../server/storage/object-storage";
import { DrizzleDocumentDetailRepository } from "../../../../server/documents/document-detail-repository";
import { requireSession } from "../../../../server/auth/service";

const repository = new DrizzleDocumentDetailRepository();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* Audit field names differ from form field names for two fields. */
const formFieldByAuditField: Record<string, string> = {
  category: "categoryId",
  type: "documentType",
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

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

  const originalFile =
    detail.files.find((file) => file.kind === "ORIGINAL") ?? null;
  const previewUrl = originalFile
    ? await createPrivateReadUrl(getR2ObjectStorage(), {
        authorize: () => {},
        key: parseObjectKey(originalFile.objectKey),
      }).then((signed) => signed.url)
    : null;

  const status = detail.document.status;
  const latestExtraction = detail.extractions[0] ?? null;
  const reviewReasons = strings(
    latestExtraction?.normalizedResult.reviewReasons,
  );
  const anomalies = strings(latestExtraction?.normalizedResult.anomalies);
  const failure =
    typeof latestExtraction?.normalizedResult.failure === "string"
      ? failureReasonSentence(latestExtraction.normalizedResult.failure)
      : null;

  const values: DocumentValues = {
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
    transactionDate:
      detail.expense?.transactionDate ?? detail.document.transactionDate,
    vat: detail.expense?.vat ?? null,
  };

  /* Review reasons flag the field they are about; the rest go in the banner.
     Once a document is reviewed the reasons are history, not a to-do. */
  const needsReview = status === "NEEDS_REVIEW";
  const flagged: Record<string, string> = {};
  const generalReasons: string[] = [];
  if (needsReview) {
    for (const reason of reviewReasons) {
      const field = reviewReasonField(reason);
      if (field) flagged[field] ??= reviewReasonSentence(reason);
      else generalReasons.push(reviewReasonSentence(reason));
    }
  }
  const flaggedCount = Object.keys(flagged).length;

  const edited = [
    ...detail.manualDocumentFields,
    ...detail.manualExpenseFields,
  ].map((field) => formFieldByAuditField[field] ?? field);
  const categoryNameById = Object.fromEntries(
    detail.categories.map((category) => [category.id, category.name]),
  );

  const name = values.supplierName ?? "Supplier not detected";
  const currency = values.currency ?? defaultCurrency;
  const meta = [
    humanizeEnumValue(detail.document.type),
    values.documentNumber ? `No. ${values.documentNumber}` : null,
    values.transactionDate ? formatDateLong(values.transactionDate) : null,
    detail.categoryName ?? "Uncategorised",
  ].filter((item): item is string => item !== null);

  const reading = status === "UPLOADED" || status === "PROCESSING";

  return (
    <div className="page record">
      <ProcessingWatcher documentId={id} status={status} />

      <header className="record-header">
        <Link className="record-header__back" href="/documents">
          <ArrowLeft aria-hidden size={13} strokeWidth={2.2} />
          Documents
        </Link>
        <div className="record-header__row">
          <div className="record-header__identity">
            <div className="record-header__title-row">
              <h2
                className={`record-header__title${values.supplierName ? "" : " is-empty"}`}
              >
                {name}
              </h2>
              <span
                className={`status-badge status-badge--${statusTone(status)}`}
              >
                {humanizeEnumValue(status)}
              </span>
            </div>
            <p className="record-header__meta">
              {meta.map((item, index) => (
                <span className="record-header__meta-item" key={index}>
                  {item}
                </span>
              ))}
              {detail.document.reviewedAt ? (
                <span className="record-header__meta-item record-header__meta-item--reviewed">
                  Reviewed <LocalDateTime value={detail.document.reviewedAt} />
                </span>
              ) : null}
            </p>
            {/* A phone wraps the meta line; the review gets its own chip there. */}
            {detail.document.reviewedAt ? (
              <span className="record-header__reviewed">
                <CircleCheck aria-hidden size={12} strokeWidth={2.2} />
                Reviewed <LocalDateTime value={detail.document.reviewedAt} />
              </span>
            ) : null}
          </div>
          <div className="record-header__amount">
            <span className="lbl">Total</span>
            <span
              className={`record-header__value num${values.total ? "" : " is-empty"}`}
            >
              {formatMoney(values.total, values.total ? currency : null)}
            </span>
            {values.vat ? (
              <span className="record-header__sub">
                incl. VAT{" "}
                <span className="num">{formatMoney(values.vat, currency)}</span>
              </span>
            ) : null}
          </div>
        </div>
        <DocumentActions
          documentId={id}
          name={name}
          reviewed={detail.document.reviewedAt !== null}
          status={status}
        />
      </header>

      {reading ? (
        <div
          aria-live="polite"
          className="record-banner record-banner--info"
          role="status"
        >
          <LoaderCircle
            aria-hidden
            className="record-banner__icon button__spinner"
            size={16}
            strokeWidth={2}
          />
          <div className="record-banner__body">
            <p className="record-banner__title">Reading the document…</p>
            <p>
              The fields fill in on their own when it is done, usually within a
              minute.
            </p>
          </div>
        </div>
      ) : null}

      {needsReview ? (
        <div className="record-banner record-banner--warning">
          <CircleAlert
            aria-hidden
            className="record-banner__icon"
            size={16}
            strokeWidth={2}
          />
          <div className="record-banner__body">
            <p className="record-banner__title">Needs your review</p>
            {generalReasons.length + anomalies.length > 0 ? (
              <ul className="record-banner__list">
                {generalReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
                {anomalies.map((anomaly) => (
                  <li key={anomaly}>{anomaly}</li>
                ))}
              </ul>
            ) : null}
            <p>
              {flaggedCount > 0
                ? `${flaggedCount} ${flaggedCount === 1 ? "field is" : "fields are"} flagged in the details. `
                : ""}
              Check the details against the original, correct what is wrong,
              then mark it reviewed.
            </p>
          </div>
        </div>
      ) : null}

      {status === "FAILED" ? (
        <div className="record-banner record-banner--danger" role="alert">
          <TriangleAlert
            aria-hidden
            className="record-banner__icon"
            size={16}
            strokeWidth={2}
          />
          <div className="record-banner__body">
            <p className="record-banner__title">Reading failed</p>
            <p>
              {failure ? `${failure} ` : ""}
              Read it again, or fill in the details by hand.
            </p>
          </div>
        </div>
      ) : null}

      {status === "ARCHIVED" ? (
        <div className="record-banner record-banner--neutral">
          <Archive
            aria-hidden
            className="record-banner__icon"
            size={16}
            strokeWidth={2}
          />
          <div className="record-banner__body">
            <p className="record-banner__title">Archived</p>
            <p>
              Not counted in reports and hidden from the documents list. Restore
              it to bring it back.
            </p>
          </div>
        </div>
      ) : null}

      <div className="record-layout">
        <div className="record-layout__preview">
          <DocumentPreview file={originalFile} name={name} url={previewUrl} />
        </div>
        <div className="record-layout__main">
          <DocumentDetails
            action={saveDocumentEditAction.bind(null, id)}
            categories={detail.categories}
            edited={edited}
            flagged={flagged}
            values={values}
          />
          <DocumentActivity
            categoryNameById={categoryNameById}
            events={detail.auditEvents}
          />
          <DocumentTechnical
            documentId={id}
            extractions={detail.extractions}
            files={detail.files}
          />
        </div>
      </div>
    </div>
  );
}

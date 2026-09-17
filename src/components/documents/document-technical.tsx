import { reviewReasonSentence } from "../../domain/documents/attention-reasons";
import type { DocumentFile, Extraction } from "../../domain/documents/types";
import { formatBytes, humanizeEnumValue } from "../../lib/format";
import { countOf, fileKindLabel } from "../../lib/labels";
import { CopyButton } from "../ui/copy-button";
import { LocalDateTime } from "../ui/local-date-time";

function Json({ label, value }: { label: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <details className="tech-json">
      <summary className="disclosure__summary tech-json__summary">
        {label}
        <span className="tech-json__size num">{formatBytes(text.length)}</span>
      </summary>
      <div className="tech-json__body">
        <div className="tech-json__tools">
          <CopyButton label={label} value={text} />
        </div>
        <pre className="code-block" dir="ltr">
          {text}
        </pre>
      </div>
    </details>
  );
}

/**
 * The debugging drawer: extraction runs, the AI's raw and normalised output,
 * and the file records. Folded by default - it exists for the day something
 * reads wrong, not for the everyday visit.
 */
export function DocumentTechnical({
  documentId,
  extractions,
  files,
}: {
  documentId: string;
  extractions: Extraction[];
  files: DocumentFile[];
}) {
  const latest = extractions[0] ?? null;

  return (
    <details className="tech-card">
      <summary className="disclosure__summary tech-card__summary">
        <span>
          <span className="tech-card__title">פרטים טכניים</span>
          <span className="tech-card__note">
            הרצות חילוץ, פלט ה־AI הגולמי ורשומות הקבצים
          </span>
        </span>
      </summary>

      <div className="tech-card__body">
        <section className="tech-section">
          <h3 className="lbl">הרצות חילוץ</h3>
          {extractions.length === 0 ? (
            <p className="detail-card__empty">עדיין לא נקרא.</p>
          ) : (
            <ol className="tech-runs">
              {extractions.map((extraction, index) => {
                const result = extraction.normalizedResult;
                const failure =
                  typeof result.failure === "string" ? result.failure : null;
                const reasons = Array.isArray(result.reviewReasons)
                  ? result.reviewReasons.filter(
                      (reason): reason is string => typeof reason === "string",
                    )
                  : [];
                const confidence =
                  typeof result.confidence === "number"
                    ? `${Math.round(result.confidence * 100)}%`
                    : null;
                return (
                  <li className="tech-run" key={extraction.id}>
                    <span className="tech-run__index num">
                      {extractions.length - index}
                    </span>
                    <div className="tech-run__body">
                      <div className="tech-run__head">
                        <span className="tech-run__model">
                          {extraction.provider} · {extraction.model}
                        </span>
                        <LocalDateTime
                          className="tech-run__time"
                          value={extraction.createdAt}
                        />
                      </div>
                      <div className="tech-run__meta">
                        <span>
                          סכימה{" "}
                          <span className="num">
                            {extraction.schemaVersion}
                          </span>
                        </span>
                        {confidence ? (
                          <span>
                            ביטחון <span className="num">{confidence}</span>
                          </span>
                        ) : null}
                        {failure ? (
                          <span className="status-badge status-badge--error">
                            {humanizeEnumValue(failure)}
                          </span>
                        ) : reasons.length === 0 ? (
                          <span className="status-badge status-badge--success">
                            נקי
                          </span>
                        ) : (
                          <span className="status-badge status-badge--warning">
                            {countOf(
                              reasons.length,
                              "סיבת בדיקה אחת",
                              "סיבות לבדיקה",
                            )}
                          </span>
                        )}
                      </div>
                      {reasons.length > 0 ? (
                        <ul className="tech-run__reasons">
                          {reasons.map((reason) => (
                            <li key={reason}>
                              <span className="num">{reason}</span> —{" "}
                              {reviewReasonSentence(reason)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {latest ? (
          <section className="tech-section">
            <h3 className="lbl">פלט ההרצה האחרונה</h3>
            <Json label="תוצאה מנורמלת" value={latest.normalizedResult} />
            <Json label="פלט המודל הגולמי" value={latest.rawResult} />
          </section>
        ) : null}

        <section className="tech-section">
          <h3 className="lbl">קבצים</h3>
          {files.length === 0 ? (
            <p className="detail-card__empty">אין קובץ רשום.</p>
          ) : (
            <ul className="tech-files">
              {files.map((file) => (
                <li className="tech-file" key={file.id}>
                  <div className="tech-file__head">
                    <span className="tech-file__kind">
                      {fileKindLabel(file.kind)}
                    </span>
                    <span className="tech-file__meta">
                      {file.mimeType} ·{" "}
                      <span className="num">{formatBytes(file.sizeBytes)}</span>{" "}
                      · {file.storageProvider}
                    </span>
                  </div>
                  <div className="tech-file__row">
                    <span className="tech-file__label">הועלה</span>
                    <LocalDateTime value={file.createdAt} />
                  </div>
                  <div className="tech-file__row">
                    <span className="tech-file__label">SHA-256</span>
                    <span className="tech-hash num" title={file.sha256}>
                      {file.sha256}
                    </span>
                    <CopyButton label="SHA-256" value={file.sha256} />
                  </div>
                  <div className="tech-file__row">
                    <span className="tech-file__label">מפתח אובייקט</span>
                    <span className="tech-hash num" title={file.objectKey}>
                      {file.objectKey}
                    </span>
                    <CopyButton label="מפתח האובייקט" value={file.objectKey} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tech-section">
          <h3 className="lbl">מזהים</h3>
          <div className="tech-file__row">
            <span className="tech-file__label">מזהה מסמך</span>
            <span className="tech-hash num">{documentId}</span>
            <CopyButton label="מזהה המסמך" value={documentId} />
          </div>
        </section>
      </div>
    </details>
  );
}

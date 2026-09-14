/**
 * Reusable, AI-provider-agnostic review rules layered on top of the
 * extraction-time checks already performed in
 * `src/server/ai/document-analyzer.ts` (missing/invalid fields, totals
 * reconciliation). These plug into `DocumentProcessingService`'s
 * `reviewRules` hook and can also be re-run after a manual edit.
 *
 * Most 10.3 review conditions (missing amount/date, invalid totals,
 * unclear supplier, unsupported file) are already produced during AI
 * normalization or surfaced via the distinct `FAILED` document status.
 * "Suspicious VAT calculation" was not covered anywhere, so it lives here.
 */
export type VatReviewInput = {
  subtotal: string | null;
  vat: string | null;
};

// ponytail: flat plausibility ceiling (no VAT/sales-tax rate exceeds ~30%
// anywhere this app is used); swap for a per-currency rate table if V2
// needs to support jurisdictions with higher rates.
const maxPlausibleVatRate = 0.3;

export function suspiciousVatReasons(input: VatReviewInput): string[] {
  if (input.vat === null || input.subtotal === null) return [];
  const vat = Number(input.vat);
  const subtotal = Number(input.subtotal);
  if (vat < 0) return ["SUSPICIOUS_VAT"];
  if (subtotal <= 0) return vat > 0 ? ["SUSPICIOUS_VAT"] : [];
  return vat / subtotal > maxPlausibleVatRate ? ["SUSPICIOUS_VAT"] : [];
}

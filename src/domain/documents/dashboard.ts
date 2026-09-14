/**
 * Current month as "YYYY-MM", matching the `to_char(transaction_date,
 * 'YYYY-MM')` convention used for month filtering elsewhere (see
 * DocumentListQuery.month in query.ts).
 */
export function currentReportingMonth(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

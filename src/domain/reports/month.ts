import { currentReportingMonth } from "../documents/dashboard";

const isoMonthPattern = /^\d{4}-\d{2}$/;

/** Parses a `?month=YYYY-MM` search param, falling back to the current month. */
export function parseReportMonth(value: string | undefined | null): string {
  return value && isoMonthPattern.test(value) ? value : currentReportingMonth();
}

/** Shifts a "YYYY-MM" month by `delta` months (negative moves back). */
export function shiftReportMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

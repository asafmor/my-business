/** Turns a SCREAMING_SNAKE_CASE enum value into "Title Case" for display. */
export function humanizeEnumValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) =>
      word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

/** An expense with no currency recorded is in the ledger's own currency. */
export const defaultCurrency = "ILS";

const currencySymbols: Record<string, string> = {
  EUR: "€",
  GBP: "£",
  ILS: "₪",
  USD: "$",
};

/** Falls back to the ISO code, which is still readable next to a number. */
export function currencySymbol(currency: string): string {
  return currencySymbols[currency] ?? currency;
}

export function formatMoney(
  value: string | null,
  currency: string | null,
): string {
  if (value === null) return "—";
  // Grouped everywhere, so a cell and a footer total scan as the same number.
  const amount = Number(value);
  const text = Number.isNaN(amount)
    ? value
    : amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
  return currency ? `${currencySymbol(currency)} ${text}` : text;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date =
    typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

/*
 * Storage sizes, in the decimal units the cloud providers bill in - a 10 GB
 * free tier means 10,000,000,000 bytes, not 10 GiB, and a meter that rounds
 * the other way reads low against the invoice.
 */
export function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Math.max(0, value);
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("en-CA");
}

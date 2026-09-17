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

/** The app serves Israel: its numbers, dates and clock are Israel's. */
export const locale = "he-IL";
export const timeZone = "Asia/Jerusalem";

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
    : amount.toLocaleString(locale, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
  return currency ? `${currencySymbol(currency)} ${text}` : text;
}

/** A calendar date the short way Israel writes it: "05.04.2024". */
export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date =
    typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: typeof value === "string" ? "UTC" : timeZone,
    year: "numeric",
  }).format(date);
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

/** A moment in Israel's clock, the short way: "05.04.2024, 14:32". */
export function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  const { time } = dateParts(value, timeZone);
  return `${formatDate(value)}, ${time}`;
}

// Spelled out here rather than asked of the locale: ICU builds disagree on
// abbreviations, and a date should read the same on every machine.
const months = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function dateParts(value: Date, zone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "numeric",
    timeZone: zone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${Number(part("day"))} ב${months[Number(part("month")) - 1]} ${part("year")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/** A calendar date the way a person writes it: "5 באפריל 2024". */
export function formatDateLong(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return dateParts(date, "UTC").date;
}

/** A "YYYY-MM" reporting month as a person says it: "אפריל 2024". */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  const name = months[Number(monthNumber) - 1];
  return name ? `${name} ${year}` : month;
}

/**
 * A moment with its clock time: "5 באפריל 2024, 14:32". A server render has
 * no idea where the reader is, so it passes Israel's zone and lets
 * LocalDateTime redo it in the browser's own zone.
 */
export function formatDateTimeLong(value: Date, zone?: string): string {
  const { date, time } = dateParts(value, zone);
  return `${date}, ${time}`;
}

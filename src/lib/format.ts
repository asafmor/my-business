/** Turns a SCREAMING_SNAKE_CASE enum value into "Title Case" for display. */
export function humanizeEnumValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function formatMoney(value: string | null, currency: string | null): string {
  if (value === null) return "—";
  return currency ? `${currency} ${value}` : value;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

export function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("en-CA");
}

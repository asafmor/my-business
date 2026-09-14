import "server-only";

import { redactSecrets } from "./redact";

type LogFields = Record<string, string | number | boolean | null | undefined>;

function redactFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      typeof value === "string" ? redactSecrets(value) : value,
    ]),
  ) as LogFields;
}

function write(
  level: "error" | "warn",
  event: string,
  fields: LogFields,
): void {
  console[level](
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...redactFields(fields),
    }),
  );
}

/**
 * Logs a failure as a structured JSON line (console.error), redacting any
 * secret-shaped text first. `event` should be a "<area>.<thing>" name (see
 * security-events.ts for the same convention).
 */
export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  write("error", event, { ...fields, error: message });
}

/** Same as logError but for non-fatal, still-actionable conditions. */
export function logWarning(event: string, fields: LogFields = {}): void {
  write("warn", event, fields);
}

import "server-only";

// Strips `scheme://user:pass@` credentials out of connection-string-shaped
// text. Same regex approach as scripts/backup/record-run.ts's
// redactConnectionString, ported here because scripts/ isn't importable
// from src/.
const connectionStringCredentials = /[a-z][a-z0-9+.-]*:\/\/[^\s@/]+@/gi;

// Defensive backstop for secret-shaped substrings that might end up inside
// a logged error message or stack trace (a driver error echoing a bearer
// token, an Authorization header value). The primary defense is simply
// never passing raw secrets into logged messages in the first place.
const bearerToken = /\b(bearer|api[-_]?key)\s+[a-z0-9._-]{8,}/gi;
const authorizationHeader = /(authorization["']?\s*[:=]\s*["']?)[^"'\n]*/gi;

/** Backstop redaction for secrets that could leak into a logged string. */
export function redactSecrets(message: string): string {
  return message
    .replace(
      connectionStringCredentials,
      (match) => `${match.slice(0, match.indexOf("://") + 3)}[redacted]@`,
    )
    .replace(
      authorizationHeader,
      (_match, prefix: string) => `${prefix}[redacted]`,
    )
    .replace(bearerToken, (_match, scheme: string) => `${scheme} [redacted]`);
}

import "server-only";

type SecurityEvent = "login_failed";

export function logSecurityEvent(event: SecurityEvent): void {
  console.warn(
    JSON.stringify({
      event: `security.${event}`,
      timestamp: new Date().toISOString(),
    }),
  );
}

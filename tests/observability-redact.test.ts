import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { redactSecrets } from "../src/server/observability/redact";

describe("redactSecrets", () => {
  it("strips credentials from a connection string", () => {
    expect(
      redactSecrets(
        "connect failed: postgres://baduser:s3cr3tpass@host:5432/db is unreachable",
      ),
    ).toBe("connect failed: postgres://[redacted]@host:5432/db is unreachable");
  });

  it("redacts a bearer/API-key-looking token", () => {
    expect(redactSecrets("request failed: Bearer sk-abc123XYZ789")).toBe(
      "request failed: Bearer [redacted]",
    );
  });

  it("redacts an Authorization header value", () => {
    expect(
      redactSecrets('headers: {"Authorization": "Bearer sk-abc123"}'),
    ).toBe('headers: {"Authorization": "[redacted]"}');
  });

  it("leaves messages with no secrets untouched", () => {
    expect(redactSecrets("getaddrinfo ENOTFOUND host")).toBe(
      "getaddrinfo ENOTFOUND host",
    );
  });
});

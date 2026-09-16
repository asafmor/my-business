import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));

import { PgDialect } from "drizzle-orm/pg-core";

import { getDatabase } from "../src/server/db/client";
import { DrizzleDocumentUploadRepository } from "../src/server/documents/upload-repository";

/** Renders the predicate handed to `.where()` so it can be asserted as SQL. */
function captureLookupWhere(): {
  get: () => { params: unknown[]; sql: string };
} {
  let captured: unknown;
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn((condition: unknown) => {
      captured = condition;
      return chain;
    }),
    then: (resolve: (value: unknown) => void) => resolve([]),
  };
  vi.mocked(getDatabase).mockReturnValue({
    select: vi.fn(() => chain),
  } as unknown as ReturnType<typeof getDatabase>);

  return { get: () => new PgDialect().sqlToQuery(captured as never) };
}

describe("DrizzleDocumentUploadRepository.findDocumentIdBySha256", () => {
  it("ignores archived documents so they cannot warn a new upload as a duplicate", async () => {
    const where = captureLookupWhere();

    await new DrizzleDocumentUploadRepository().findDocumentIdBySha256("abc");

    const query = where.get();
    expect(query.sql).toContain(`"documents"."status" <> `);
    expect(query.params).toContain("ARCHIVED");
  });
});

import { describe, expect, it } from "vitest";

import { pinStrictSslMode } from "../src/lib/postgres-url";

describe("pinStrictSslMode", () => {
  it("names the strict mode pg already applies, so pg 9 cannot weaken it", () => {
    expect(
      pinStrictSslMode(
        "postgresql://h/db?channel_binding=require&sslmode=require",
      ),
    ).toBe("postgresql://h/db?channel_binding=require&sslmode=verify-full");
    expect(pinStrictSslMode("postgresql://h/db?sslmode=prefer&x=1")).toBe(
      "postgresql://h/db?sslmode=verify-full&x=1",
    );
  });

  it("leaves modes with different semantics, and absent modes, alone", () => {
    expect(pinStrictSslMode("postgresql://h/db?sslmode=disable")).toBe(
      "postgresql://h/db?sslmode=disable",
    );
    expect(pinStrictSslMode("postgresql://h/db")).toBe("postgresql://h/db");
  });
});

import { describe, expect, it } from "vitest";

import { suspiciousVatReasons } from "../src/domain/expenses/review-rules";

describe("suspiciousVatReasons", () => {
  it("passes plausible VAT rates", () => {
    expect(suspiciousVatReasons({ subtotal: "100.00", vat: "17.00" })).toEqual(
      [],
    );
  });

  it("flags VAT far above any plausible rate", () => {
    expect(suspiciousVatReasons({ subtotal: "100.00", vat: "90.00" })).toEqual([
      "SUSPICIOUS_VAT",
    ]);
  });

  it("flags negative VAT", () => {
    expect(suspiciousVatReasons({ subtotal: "100.00", vat: "-5.00" })).toEqual([
      "SUSPICIOUS_VAT",
    ]);
  });

  it("flags positive VAT on a zero or negative subtotal", () => {
    expect(suspiciousVatReasons({ subtotal: "0.00", vat: "5.00" })).toEqual([
      "SUSPICIOUS_VAT",
    ]);
  });

  it("is silent when either value is unknown", () => {
    expect(suspiciousVatReasons({ subtotal: null, vat: "17.00" })).toEqual([]);
    expect(suspiciousVatReasons({ subtotal: "100.00", vat: null })).toEqual([]);
  });
});

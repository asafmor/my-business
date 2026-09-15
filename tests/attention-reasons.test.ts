import { describe, expect, it } from "vitest";

import { attentionReasons } from "../src/domain/documents/attention-reasons";

const base = { isDuplicate: false, lastErrorCode: null, reviewReasons: [] };

describe("attentionReasons", () => {
  it("returns no reasons when nothing is wrong", () => {
    expect(attentionReasons(base)).toEqual([]);
  });

  it("humanizes known review reasons into SPEC.md-style sentences", () => {
    expect(
      attentionReasons({
        ...base,
        reviewReasons: ["MISSING_TOTAL", "SUSPICIOUS_VAT"],
      }),
    ).toEqual([
      "Amount could not be determined.",
      "VAT differs from the expected calculation.",
    ]);
  });

  it("falls back to a humanized enum value for unmapped review reasons", () => {
    expect(
      attentionReasons({ ...base, reviewReasons: ["SOME_FUTURE_REASON"] }),
    ).toEqual(["Some Future Reason."]);
  });

  it("leads with the duplicate warning when the document is a duplicate", () => {
    expect(
      attentionReasons({
        ...base,
        isDuplicate: true,
        reviewReasons: ["MISSING_VAT"],
      }),
    ).toEqual(["Possible duplicate detected.", "VAT could not be determined."]);
  });

  it("humanizes a known failure code", () => {
    expect(
      attentionReasons({ ...base, lastErrorCode: "STORAGE_FAILURE" }),
    ).toEqual(["The original file could not be read."]);
  });

  it("falls back to a humanized enum value for an unmapped failure code", () => {
    expect(
      attentionReasons({ ...base, lastErrorCode: "SOME_NEW_ERROR" }),
    ).toEqual(["Some New Error."]);
  });
});

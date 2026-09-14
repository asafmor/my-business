import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));

import { developmentR2Bucket } from "../src/server/config/cloud-environment";
import {
  checkStorageConfiguration,
  statusBadgeTone,
} from "../src/server/settings/status";

const configuredEnvironment = {
  APP_ENV: "development",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: developmentR2Bucket,
};

describe("statusBadgeTone", () => {
  it("maps ok to success and not-ok to error", () => {
    expect(statusBadgeTone(true)).toBe("success");
    expect(statusBadgeTone(false)).toBe("error");
  });
});

describe("checkStorageConfiguration", () => {
  it("reports ok when required R2 variables are present and valid", () => {
    expect(checkStorageConfiguration(configuredEnvironment)).toEqual({
      detail: "R2 storage is configured.",
      ok: true,
    });
  });

  it("reports not ok with a reason when variables are missing", () => {
    const result = checkStorageConfiguration({ APP_ENV: "development" });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Missing R2 variables");
  });
});

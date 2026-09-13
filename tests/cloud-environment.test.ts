import { describe, expect, it } from "vitest";

import {
  assertCloudEnvironment,
  assertProductionDatabaseEnvironment,
} from "../src/server/config/cloud-environment";

const productionEnvironment = {
  VERCEL_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://production.example/database",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "rotem",
  AUTH_PASSWORD_HASH: "$2b$12$example-password-hash-not-a-real-credential",
  AUTH_SESSION_SECRET: "a-long-enough-secret-value-for-production",
};

describe("production-only cloud environment", () => {
  it("accepts the configured production boundary", () => {
    expect(() => assertCloudEnvironment(productionEnvironment)).not.toThrow();
  });

  it("allows deliberate local database access when APP_ENV is production", () => {
    expect(() =>
      assertProductionDatabaseEnvironment({
        APP_ENV: "production",
        DATABASE_URL: productionEnvironment.DATABASE_URL,
      }),
    ).not.toThrow();
  });

  it("rejects production credentials in a Vercel Preview deployment", () => {
    expect(() =>
      assertCloudEnvironment({
        ...productionEnvironment,
        VERCEL_ENV: "preview",
      }),
    ).toThrow("Cloud resources are disabled outside Vercel Production");
  });

  it("rejects a different R2 bucket", () => {
    expect(() =>
      assertCloudEnvironment({
        ...productionEnvironment,
        R2_BUCKET: "another-bucket",
      }),
    ).toThrow("R2_BUCKET must identify the production bucket rotem");
  });

  it("rejects B2 credentials in the application runtime", () => {
    expect(() =>
      assertCloudEnvironment({
        ...productionEnvironment,
        B2_SECRET_ACCESS_KEY: "must-not-be-here",
      }),
    ).toThrow("B2 backup credentials cannot be exposed");
  });
});

import { describe, expect, it } from "vitest";

import {
  assertCloudEnvironment,
  assertDatabaseEnvironment,
  developmentNeonProjectId,
  developmentR2Bucket,
  productionNeonProjectId,
} from "../src/server/config/cloud-environment";

const productionEnvironment = {
  VERCEL_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://production.example-pooler/database",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "rotem",
  AUTH_PASSWORD_HASH: "$2b$12$example-password-hash-not-a-real-credential",
  AUTH_SESSION_SECRET: "a-long-enough-secret-value-for-production",
  OPENAI_API_KEY: "development-only-test-key",
};

const developmentEnvironment = {
  VERCEL_ENV: "development",
  APP_ENV: "development",
  DATABASE_URL: "postgresql://development.example-pooler/database",
  NEON_PROJECT_ID: developmentNeonProjectId,
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: developmentR2Bucket,
  AUTH_PASSWORD_HASH: "$2b$12$example-password-hash-not-a-real-credential",
  AUTH_SESSION_SECRET: "a-long-enough-secret-value-for-development",
  OPENAI_API_KEY: "development-only-test-key",
};

describe("cloud environment isolation", () => {
  it("accepts the configured production boundary", () => {
    expect(() => assertCloudEnvironment(productionEnvironment)).not.toThrow();
  });

  it("rejects a local process configured as the production application", () => {
    expect(() =>
      assertDatabaseEnvironment({
        APP_ENV: "production",
        DATABASE_URL: productionEnvironment.DATABASE_URL,
      }),
    ).toThrow("Production application resources require VERCEL_ENV=production");
  });

  it("accepts the configured development boundary", () => {
    expect(() => assertCloudEnvironment(developmentEnvironment)).not.toThrow();
  });

  it("requires the designated development Neon project", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        NEON_PROJECT_ID: undefined,
      }),
    ).toThrow(
      `NEON_PROJECT_ID must identify the development project ${developmentNeonProjectId}`,
    );
  });

  it("requires a development password hash", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        AUTH_PASSWORD_HASH: undefined,
      }),
    ).toThrow("Missing application variable: AUTH_PASSWORD_HASH");
  });

  it("rejects a Preview deployment", () => {
    expect(() =>
      assertCloudEnvironment({
        ...productionEnvironment,
        VERCEL_ENV: "preview",
      }),
    ).toThrow("VERCEL_ENV=preview cannot be used with APP_ENV=production");
  });

  it("rejects a different production R2 bucket", () => {
    expect(() =>
      assertCloudEnvironment({
        ...productionEnvironment,
        R2_BUCKET: "another-bucket",
      }),
    ).toThrow("R2_BUCKET must identify the production bucket rotem");
  });

  it("rejects the production Neon project in development", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        NEON_PROJECT_ID: productionNeonProjectId,
      }),
    ).toThrow("Development cannot use the production Neon project");
  });

  it("rejects the production R2 bucket in development", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        R2_BUCKET: "rotem",
      }),
    ).toThrow("Development cannot use the production R2 bucket");
  });

  it("rejects development resources in a production Vercel deployment", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        VERCEL_ENV: "production",
      }),
    ).toThrow("VERCEL_ENV=production cannot be used with APP_ENV=development");
  });

  it("rejects a direct database variable in either application runtime", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        NEON_BACKUP_DATABASE_URL: "postgresql://development.example/database",
      }),
    ).toThrow("Direct database credentials cannot be exposed");
  });

  it("rejects an unpooled database URL in development", () => {
    expect(() =>
      assertCloudEnvironment({
        ...developmentEnvironment,
        DATABASE_URL: "postgresql://development.example/database",
      }),
    ).toThrow("DATABASE_URL must use the pooled Neon connection");
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

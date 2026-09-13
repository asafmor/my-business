import { assertCloudEnvironment } from "../../src/server/config/cloud-environment";

const applicationRuntimeEnvironment: Record<string, string | undefined> = {
  APP_ENV: process.env.APP_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  // Authentication setup belongs to its later issue. Supply a validation-only
  // value so this check can exercise the full runtime boundary without adding
  // an application secret to the cloud provisioning worksheet.
  AUTH_SESSION_SECRET:
    process.env.AUTH_SESSION_SECRET ?? "cloud-foundation-validation-only-value",
};

assertCloudEnvironment(applicationRuntimeEnvironment);

console.log("Production-only cloud environment boundary verified.");

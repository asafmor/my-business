type Environment = Record<string, string | undefined>;

type AppEnvironment = "development" | "production";

export const developmentNeonProjectId = "young-poetry-39424785";
export const developmentR2Bucket = "my-business-development";
export const productionNeonProjectId = "royal-mode-75259763";
export const productionR2Bucket = "rotem";

const b2RuntimeVariables = [
  "B2_ENDPOINT",
  "B2_REGION",
  "B2_ACCESS_KEY_ID",
  "B2_SECRET_ACCESS_KEY",
  "B2_BUCKET",
  "B2_BUCKET_ID",
] as const;

const requiredR2Variables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

const directDatabaseRuntimeVariables = [
  "DATABASE_URL_UNPOOLED",
  "NEON_BACKUP_DATABASE_URL",
  "PGDATABASE",
  "PGHOST",
  "PGHOST_UNPOOLED",
  "PGPASSWORD",
  "PGUSER",
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NO_SSL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_USER",
] as const;

function getAppEnvironment(environment: Environment): AppEnvironment {
  if (
    environment.APP_ENV === "development" ||
    environment.APP_ENV === "production"
  ) {
    return environment.APP_ENV;
  }

  throw new Error("APP_ENV must be either development or production.");
}

function assertVercelEnvironment(
  environment: Environment,
  appEnvironment: AppEnvironment,
): void {
  if (!environment.VERCEL_ENV) return;

  if (environment.VERCEL_ENV !== appEnvironment) {
    throw new Error(
      `VERCEL_ENV=${environment.VERCEL_ENV} cannot be used with APP_ENV=${appEnvironment}.`,
    );
  }
}

function assertNoDirectDatabaseRuntimeVariables(
  environment: Environment,
): void {
  const exposedVariables = directDatabaseRuntimeVariables.filter(
    (name) => environment[name],
  );
  if (exposedVariables.length > 0) {
    throw new Error(
      `Direct database credentials cannot be exposed to the application runtime: ${exposedVariables.join(", ")}.`,
    );
  }
}

function assertPooledDatabaseUrl(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    !url.hostname.includes("-pooler")
  ) {
    throw new Error("DATABASE_URL must use the pooled Neon connection.");
  }
}

export function assertProductionDeployment(environment: Environment): void {
  if (getAppEnvironment(environment) !== "production") {
    throw new Error("APP_ENV must be production for a production operation.");
  }
  assertVercelEnvironment(environment, "production");
}

export function assertDatabaseEnvironment(environment: Environment): void {
  const appEnvironment = getAppEnvironment(environment);
  assertVercelEnvironment(environment, appEnvironment);
  assertNoDirectDatabaseRuntimeVariables(environment);

  if (
    appEnvironment === "production" &&
    environment.VERCEL_ENV !== "production"
  ) {
    throw new Error(
      "Production application resources require VERCEL_ENV=production.",
    );
  }

  if (!environment.DATABASE_URL) {
    throw new Error("Missing application variable: DATABASE_URL.");
  }
  assertPooledDatabaseUrl(environment.DATABASE_URL);

  if (appEnvironment === "development") {
    if (environment.NEON_PROJECT_ID === productionNeonProjectId) {
      throw new Error("Development cannot use the production Neon project.");
    }
    if (environment.NEON_PROJECT_ID !== developmentNeonProjectId) {
      throw new Error(
        `NEON_PROJECT_ID must identify the development project ${developmentNeonProjectId}.`,
      );
    }
  }
}

export function assertR2Environment(environment: Environment): void {
  const appEnvironment = getAppEnvironment(environment);
  assertVercelEnvironment(environment, appEnvironment);

  if (
    appEnvironment === "production" &&
    environment.VERCEL_ENV !== "production"
  ) {
    throw new Error(
      "Production application resources require VERCEL_ENV=production.",
    );
  }

  const missingVariables = requiredR2Variables.filter(
    (name) => !environment[name],
  );
  if (missingVariables.length > 0) {
    throw new Error(`Missing R2 variables: ${missingVariables.join(", ")}.`);
  }

  const expectedBucket =
    appEnvironment === "development" ? developmentR2Bucket : productionR2Bucket;
  if (
    appEnvironment === "development" &&
    environment.R2_BUCKET === productionR2Bucket
  ) {
    throw new Error("Development cannot use the production R2 bucket.");
  }
  if (environment.R2_BUCKET !== expectedBucket) {
    throw new Error(
      `R2_BUCKET must identify the ${appEnvironment} bucket ${expectedBucket}.`,
    );
  }
}

export function assertCloudEnvironment(environment: Environment): void {
  assertDatabaseEnvironment(environment);
  assertR2Environment(environment);

  if (!environment.AUTH_SESSION_SECRET) {
    throw new Error("Missing application variable: AUTH_SESSION_SECRET.");
  }

  if (!environment.AUTH_PASSWORD_HASH) {
    throw new Error("Missing application variable: AUTH_PASSWORD_HASH.");
  }

  if (!environment.OPENAI_API_KEY) {
    throw new Error("Missing application variable: OPENAI_API_KEY.");
  }

  const exposedB2Variables = b2RuntimeVariables.filter(
    (name) => environment[name],
  );
  if (exposedB2Variables.length > 0) {
    throw new Error(
      `B2 backup credentials cannot be exposed to the application runtime: ${exposedB2Variables.join(", ")}.`,
    );
  }
}

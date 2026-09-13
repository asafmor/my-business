import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? ".env.vercel-production.local");
const destinationPath = resolve(process.argv[3] ?? ".env.cloud.local");

process.loadEnvFile(sourcePath);

const pooledUrl = process.env.DATABASE_URL;
const directUrl = process.env.DATABASE_URL_UNPOOLED;

if (!pooledUrl || !directUrl) {
  throw new Error(
    "The Vercel environment must contain pooled and unpooled Neon URLs.",
  );
}

if (!new URL(pooledUrl).hostname.includes("-pooler")) {
  throw new Error("DATABASE_URL is not a pooled Neon endpoint.");
}

if (new URL(directUrl).hostname.includes("-pooler")) {
  throw new Error("DATABASE_URL_UNPOOLED is not a direct Neon endpoint.");
}

let worksheet = await readFile(destinationPath, "utf8");

function replaceBlank(name: string, value: string): void {
  const pattern = new RegExp(`^${name}=$`, "m");
  if (!pattern.test(worksheet)) {
    throw new Error(
      `${name} is missing or already set in the destination worksheet.`,
    );
  }
  worksheet = worksheet.replace(pattern, `${name}=${value}`);
}

replaceBlank("DATABASE_URL", pooledUrl);
replaceBlank("NEON_BACKUP_DATABASE_URL", directUrl);

const temporaryPath = `${destinationPath}.tmp`;
await writeFile(temporaryPath, worksheet, { encoding: "utf8", mode: 0o600 });
await rename(temporaryPath, destinationPath);
await chmod(destinationPath, 0o600);

console.log("Neon pooled and direct URLs copied to the ignored worksheet.");

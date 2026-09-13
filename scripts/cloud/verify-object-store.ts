import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { assertR2Environment } from "../../src/server/config/cloud-environment";

type Target = "r2" | "b2";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const target = process.argv[2] as Target | undefined;
if (target !== "r2" && target !== "b2") {
  throw new Error("Choose an object-store target: r2 or b2.");
}

if (target === "r2") {
  assertR2Environment(process.env);
}

const prefix = target.toUpperCase();
const endpoint =
  target === "r2"
    ? `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`
    : required("B2_ENDPOINT");
const bucket = required(`${prefix}_BUCKET`);
const key =
  target === "r2"
    ? "health/cloud-foundation.txt"
    : "backup/verification/cloud-foundation.txt";
const body = `my-business cloud verification ${randomUUID()}`;
const client = new S3Client({
  region: target === "r2" ? "auto" : required("B2_REGION"),
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: required(`${prefix}_ACCESS_KEY_ID`),
    secretAccessKey: required(`${prefix}_SECRET_ACCESS_KEY`),
  },
});

await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "text/plain",
  }),
);

const metadata = await client.send(
  new HeadObjectCommand({ Bucket: bucket, Key: key }),
);
if (metadata.ContentLength !== Buffer.byteLength(body)) {
  throw new Error(`${prefix} returned an unexpected object size.`);
}

const downloaded = await client.send(
  new GetObjectCommand({ Bucket: bucket, Key: key }),
);
if ((await downloaded.Body?.transformToString()) !== body) {
  throw new Error(`${prefix} returned different object content.`);
}

const listed = await client.send(
  new ListObjectsV2Command({ Bucket: bucket, Prefix: key }),
);
if (!listed.Contents?.some((object) => object.Key === key)) {
  throw new Error(`${prefix} verification object was not returned by listing.`);
}

const unsignedResponse = await fetch(
  `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`,
);
if (unsignedResponse.ok) {
  throw new Error(`${prefix} verification object is publicly readable.`);
}

console.log(
  `${prefix} private object write, metadata, list, and read verified.`,
);

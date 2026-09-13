import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { assertProductionR2Environment } from "../config/cloud-environment";

import type { ObjectKey } from "./object-keys";

export const signedReadUrlLifetimeSeconds = 60;

export type ObjectMetadata = {
  bucket: string;
  key: ObjectKey;
  contentType?: string;
  eTag?: string;
  lastModified?: Date;
  sha256?: string;
  sizeBytes?: number;
};

export type ImmutableObjectUpload = {
  body: Uint8Array;
  contentType: string;
  key: ObjectKey;
  sha256: string;
};

export type StoredImmutableObject = {
  bucket: string;
  contentType: string;
  key: ObjectKey;
  sha256: string;
  sizeBytes: number;
};

export type SignedReadUrl = {
  expiresAt: Date;
  url: string;
};

export interface ObjectStorage {
  putImmutableObject(
    input: ImmutableObjectUpload,
  ): Promise<StoredImmutableObject>;
  objectExists(key: ObjectKey): Promise<boolean>;
  getObjectMetadata(key: ObjectKey): Promise<ObjectMetadata | null>;
  createSignedReadUrl(key: ObjectKey): Promise<SignedReadUrl>;
  deleteObjectInternally(key: ObjectKey): Promise<void>;
}

export class ObjectAlreadyExistsError extends Error {
  constructor(key: ObjectKey) {
    super(`Refusing to overwrite immutable object: ${key}`);
  }
}

export type R2Configuration = {
  accountId: string;
  accessKeyId: string;
  bucket: string;
  secretAccessKey: string;
};

type S3ClientLike = {
  send(command: unknown): Promise<unknown>;
};

export type R2ObjectStorageDependencies = {
  createClient(configuration: R2Configuration): S3ClientLike;
  signReadUrl(
    client: S3ClientLike,
    command: GetObjectCommand,
    options: { expiresIn: number },
  ): Promise<string>;
};

const defaultDependencies: R2ObjectStorageDependencies = {
  createClient(configuration) {
    return new S3Client({
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
      endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      region: "auto",
    }) as unknown as S3ClientLike;
  },
  signReadUrl(client, command, options) {
    return getSignedUrl(client as never, command, options);
  },
};

function isMissingObjectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const response = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    response.$metadata?.httpStatusCode === 404 ||
    response.name === "NoSuchKey" ||
    response.name === "NotFound"
  );
}

function isPreconditionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const response = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    response.$metadata?.httpStatusCode === 412 ||
    response.name === "PreconditionFailed"
  );
}

function assertSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Object SHA-256 must be a lowercase 64-character digest.");
  }
}

export class R2ObjectStorage implements ObjectStorage {
  private connection?: { bucket: string; client: S3ClientLike };

  constructor(
    private readonly getConfiguration: () => R2Configuration,
    private readonly dependencies: R2ObjectStorageDependencies = defaultDependencies,
  ) {}

  async putImmutableObject(
    input: ImmutableObjectUpload,
  ): Promise<StoredImmutableObject> {
    assertSha256(input.sha256);
    if (await this.objectExists(input.key)) {
      throw new ObjectAlreadyExistsError(input.key);
    }

    const { bucket, client } = this.getConnection();
    try {
      await client.send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: bucket,
          ContentType: input.contentType,
          IfNoneMatch: "*",
          Key: input.key,
          Metadata: { sha256: input.sha256 },
        }),
      );
    } catch (error) {
      if (isPreconditionFailure(error)) {
        throw new ObjectAlreadyExistsError(input.key);
      }
      throw error;
    }

    return {
      bucket,
      contentType: input.contentType,
      key: input.key,
      sha256: input.sha256,
      sizeBytes: input.body.byteLength,
    };
  }

  async objectExists(key: ObjectKey): Promise<boolean> {
    return (await this.getObjectMetadata(key)) !== null;
  }

  async getObjectMetadata(key: ObjectKey): Promise<ObjectMetadata | null> {
    const { bucket, client } = this.getConnection();
    try {
      const response = (await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      )) as {
        ContentLength?: number;
        ContentType?: string;
        ETag?: string;
        LastModified?: Date;
        Metadata?: Record<string, string>;
      };
      return {
        bucket,
        contentType: response.ContentType,
        eTag: response.ETag,
        key,
        lastModified: response.LastModified,
        sha256: response.Metadata?.sha256,
        sizeBytes: response.ContentLength,
      };
    } catch (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      throw error;
    }
  }

  async createSignedReadUrl(key: ObjectKey): Promise<SignedReadUrl> {
    const { bucket, client } = this.getConnection();
    const url = await this.dependencies.signReadUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: signedReadUrlLifetimeSeconds },
    );

    return {
      expiresAt: new Date(Date.now() + signedReadUrlLifetimeSeconds * 1_000),
      url,
    };
  }

  // This is for deliberate server-side recovery/retention work, never a route.
  async deleteObjectInternally(key: ObjectKey): Promise<void> {
    const { bucket, client } = this.getConnection();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  private getConnection(): { bucket: string; client: S3ClientLike } {
    if (!this.connection) {
      const configuration = this.getConfiguration();
      this.connection = {
        bucket: configuration.bucket,
        client: this.dependencies.createClient(configuration),
      };
    }

    return this.connection;
  }
}

export function getR2ObjectStorage(
  environment: Record<string, string | undefined> = process.env,
): R2ObjectStorage {
  return new R2ObjectStorage(() => {
    assertProductionR2Environment(environment);
    return {
      accountId: environment.R2_ACCOUNT_ID as string,
      accessKeyId: environment.R2_ACCESS_KEY_ID as string,
      bucket: environment.R2_BUCKET as string,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY as string,
    };
  });
}

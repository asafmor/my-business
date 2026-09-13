import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { documentOriginalObjectKey } from "../src/server/storage/object-keys";
import {
  getR2ObjectStorage,
  ObjectAlreadyExistsError,
  R2ObjectStorage,
  signedReadUrlLifetimeSeconds,
} from "../src/server/storage/object-storage";

const key = documentOriginalObjectKey("de305d54-75b4-431b-adb2-eb6b9e546013");
const sha256 = "a".repeat(64);
const configuration = {
  accountId: "account",
  accessKeyId: "key",
  bucket: "rotem",
  secretAccessKey: "secret",
};

function createStorage(send: ReturnType<typeof vi.fn>) {
  const client = {
    send: send as unknown as (command: unknown) => Promise<unknown>,
  };
  const createClient = vi.fn(() => client);
  const signReadUrl = vi
    .fn()
    .mockResolvedValue("https://signed.example/object");
  return {
    createClient,
    signReadUrl,
    storage: new R2ObjectStorage(() => configuration, {
      createClient,
      signReadUrl,
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("R2 object storage", () => {
  it("defers production configuration validation until storage is used", async () => {
    const storage = getR2ObjectStorage({});

    await expect(storage.objectExists(key)).rejects.toThrow(
      "APP_ENV must be production",
    );
  });

  it("initializes configuration lazily and exposes object metadata", async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 42,
      ContentType: "application/pdf",
      Metadata: { sha256 },
    });
    const getConfiguration = vi.fn(() => configuration);
    const storage = new R2ObjectStorage(getConfiguration, {
      createClient: () => ({
        send: send as unknown as (command: unknown) => Promise<unknown>,
      }),
      signReadUrl: vi.fn() as never,
    });

    expect(getConfiguration).not.toHaveBeenCalled();
    await expect(storage.objectExists(key)).resolves.toBe(true);
    await expect(storage.getObjectMetadata(key)).resolves.toMatchObject({
      bucket: "rotem",
      contentType: "application/pdf",
      key,
      sha256,
      sizeBytes: 42,
    });
    expect(getConfiguration).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("writes immutable objects with a conditional request and persisted metadata", async () => {
    const missing = Object.assign(new Error("missing"), {
      $metadata: { httpStatusCode: 404 },
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce({});
    const { storage } = createStorage(send);

    await expect(
      storage.putImmutableObject({
        body: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
        key,
        sha256,
      }),
    ).resolves.toEqual({
      bucket: "rotem",
      contentType: "application/pdf",
      key,
      sha256,
      sizeBytes: 3,
    });

    const command = send.mock.calls[1][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: "rotem",
      ContentType: "application/pdf",
      IfNoneMatch: "*",
      Key: key,
      Metadata: { sha256 },
    });
  });

  it("refuses a known existing object before sending a replacement", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 3 });
    const { storage } = createStorage(send);

    await expect(
      storage.putImmutableObject({
        body: new Uint8Array([1, 2, 3]),
        contentType: "application/pdf",
        key,
        sha256,
      }),
    ).rejects.toBeInstanceOf(ObjectAlreadyExistsError);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("creates only short-lived signed reads and supports internal deletion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
    const send = vi.fn().mockResolvedValue({});
    const { signReadUrl, storage } = createStorage(send);

    await expect(storage.createSignedReadUrl(key)).resolves.toEqual({
      expiresAt: new Date("2026-09-13T12:01:00.000Z"),
      url: "https://signed.example/object",
    });
    expect(signReadUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: signedReadUrlLifetimeSeconds },
    );

    await storage.deleteObjectInternally(key);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });
});

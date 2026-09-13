import "server-only";

export const allowedFileMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedFileMimeType = (typeof allowedFileMimeTypes)[number];

// Large enough for scanned PDFs while limiting a single server upload to 10 MiB.
export const maximumUploadBytes = 10 * 1024 * 1024;

export class FileValidationError extends Error {}

export type UploadFileInput = {
  bytes: Uint8Array;
  mimeType?: string;
};

export type ValidatedUploadFile = {
  mimeType: AllowedFileMimeType;
  sizeBytes: number;
};

function matches(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

export function detectFileMimeType(
  bytes: Uint8Array,
): AllowedFileMimeType | null {
  if (matches(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (
    matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matches(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }

  return null;
}

function isAllowedMimeType(value: string): value is AllowedFileMimeType {
  return allowedFileMimeTypes.some((mimeType) => mimeType === value);
}

export function validateUploadFile(
  input: UploadFileInput,
): ValidatedUploadFile {
  const { bytes } = input;
  if (bytes.byteLength === 0) {
    throw new FileValidationError("File must not be empty.");
  }

  if (bytes.byteLength > maximumUploadBytes) {
    throw new FileValidationError("File exceeds the maximum upload size.");
  }

  const detectedMimeType = detectFileMimeType(bytes);
  if (!detectedMimeType) {
    throw new FileValidationError("File type is not supported.");
  }

  const declaredMimeType = input.mimeType?.trim().toLowerCase();
  if (declaredMimeType && !isAllowedMimeType(declaredMimeType)) {
    throw new FileValidationError("Declared file type is not supported.");
  }

  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    throw new FileValidationError(
      "Declared file type does not match file bytes.",
    );
  }

  return { mimeType: detectedMimeType, sizeBytes: bytes.byteLength };
}

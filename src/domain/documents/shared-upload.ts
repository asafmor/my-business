import { z } from "zod";

import { idSchema } from "../validation";

/*
 * A share-target POST ingests on the server, so its files never pass through
 * the browser's upload code. The results ride back on the redirect URL so the
 * upload tray can adopt them and show a share exactly as it shows a file
 * chosen on the upload page.
 *
 * One `shared` param per file: status, document id, message, then the file
 * name last, because the name is the only part that may contain the separator.
 */
export type SharedUploadResult = {
  documentId?: string;
  fileName: string;
  message?: string;
  status: "duplicate" | "failed" | "rejected" | "uploaded";
};

const separator = "|";
const maximumFileNameLength = 255;

// The URL is user-editable, so what comes back off it is validated like any
// other untrusted input rather than trusted because this app wrote it.
const sharedUploadSchema = z.object({
  documentId: idSchema.optional(),
  fileName: z.string().min(1).max(maximumFileNameLength),
  message: z.string().max(500).optional(),
  status: z.enum(["duplicate", "failed", "rejected", "uploaded"]),
});

export function encodeSharedUploads(
  results: readonly SharedUploadResult[],
): string {
  const params = new URLSearchParams();
  for (const result of results) {
    params.append(
      "shared",
      [
        result.status,
        result.documentId ?? "",
        result.message ?? "",
        result.fileName.slice(0, maximumFileNameLength),
      ].join(separator),
    );
  }
  return params.toString();
}

export function decodeSharedUploads(
  values: readonly string[],
): SharedUploadResult[] {
  return values.flatMap((value) => {
    const [status, documentId, message, ...name] = value.split(separator);
    const parsed = sharedUploadSchema.safeParse({
      documentId: documentId || undefined,
      fileName: name.join(separator),
      message: message || undefined,
      status,
    });
    return parsed.success ? [parsed.data] : [];
  });
}

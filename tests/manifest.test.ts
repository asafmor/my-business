import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import manifest from "../src/app/manifest";
import { allowedFileMimeTypes } from "../src/server/storage/file-validation";

describe("web app manifest", () => {
  it("meets the members Chromium requires to offer installation", () => {
    const value = manifest();

    expect(value.name).toBeTruthy();
    expect(value.start_url).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.icons?.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(value.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("offers the share sheet exactly the file types ingestion accepts", () => {
    const share = manifest().share_target;

    expect(share?.action).toBe("/share-target");
    expect(share?.method).toBe("POST");
    expect(share?.enctype).toBe("multipart/form-data");

    const files = [share?.params.files ?? []].flat();
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("files");
    /*
     * Wider than ingestion accepts, on purpose: Chrome drops a shared file it
     * cannot match to a form field, and Android apps routinely hand out a PDF
     * as application/octet-stream. Magic-byte validation is what keeps the
     * wider net safe, so the real types must all still be offered.
     */
    const accept = [files[0]?.accept ?? []].flat();
    expect(accept).toEqual(expect.arrayContaining([...allowedFileMimeTypes]));
    expect(accept).toContain("application/octet-stream");

    // A link-only share must reach the server too, so it can explain itself.
    expect(share?.params.text).toBe("text");
  });
});

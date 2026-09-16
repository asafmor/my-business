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
    // The share sheet must not advertise a type the uploader would refuse.
    const accept = [files[0]?.accept ?? []].flat();
    expect(accept.filter((type) => !type.startsWith("."))).toEqual([
      ...allowedFileMimeTypes,
    ]);
  });
});

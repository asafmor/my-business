import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import manifest from "../src/app/manifest";
import { allowedFileMimeTypes } from "../src/server/storage/file-validation";

describe("web app manifest", () => {
  it("meets the members Chromium requires to offer installation", () => {
    const value = manifest();

    expect(value.name).toBeTruthy();
    /*
     * The mint fingerprint ignores share_target, so name is the lever that
     * forces a new WebAPK. If it ever goes back to matching short_name, a
     * share_target change silently stops reaching devices.
     */
    expect(value.name).not.toBe(value.short_name);
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
     * Chromium builds the MimeTypeFilter it matches shared files against by
     * splitting each accept entry on "/". A bare extension like ".pdf" has no
     * "/" and can poison the filter so no file matches at all — the app still
     * shows in the share sheet (that comes from the Android intent filter) but
     * every shared file is silently dropped. Proven on device: text params
     * arrived while files did not, and files are the only ones filtered.
     */
    const accept = [files[0]?.accept ?? []].flat();
    expect(accept.some((entry) => entry.startsWith("."))).toBe(false);
    expect(accept.every((entry) => entry.includes("/"))).toBe(true);

    // Every type ingestion accepts must still be reachable, exactly or by wildcard.
    const covered = (type: string) =>
      accept.some(
        (entry) =>
          entry === type ||
          (entry.endsWith("/*") && type.startsWith(entry.slice(0, -1))),
      );
    expect(allowedFileMimeTypes.filter((type) => !covered(type))).toEqual([]);

    // A link-only share must reach the server too, so it can explain itself.
    expect(share?.params.text).toBe("text");
  });
});

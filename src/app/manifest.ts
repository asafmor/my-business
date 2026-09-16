import type { MetadataRoute } from "next";

import { allowedFileMimeTypes } from "../server/storage/file-validation";

/*
 * Installing the app on Android is what registers it as a share target, so the
 * manifest has to satisfy Chromium's install criteria: name, 192px and 512px
 * icons, a start URL inside the scope, and a non-browser display mode. No
 * service worker is needed — Chrome dropped that requirement in M108 (mobile)
 * and this app is useless offline anyway, so there is nothing to cache.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f0f0f3",
    description: "Private document and expense management.",
    display: "standalone",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    id: "/",
    /*
     * "Documents" is not decoration. Google's WebAPK minting server keys the
     * built APK on a manifest fingerprint that does not track share_target, so
     * editing the share target alone returns the same cached APK forever —
     * even across uninstall and reinstall. Changing a fingerprinted field is
     * what forces a fresh mint and carries the share template below onto the
     * device. short_name is untouched, so the home screen label still reads
     * "My Business".
     *
     * Consequence: any future share_target change needs this string (or
     * another fingerprinted member) nudged as well, or it will not ship.
     */
    name: "My Business Share",
    scope: "/",
    /*
     * Mirrors the shape of Google's Scrapbook demo, the reference share target
     * that is known to work: wildcards, real MIME types, and no bare file
     * extensions. Chromium parses each accept entry by splitting on "/" to
     * build the MimeTypeFilter it matches shared files against, so an entry
     * like ".pdf" is not merely useless, it can poison the filter so nothing
     * matches at all. That fits the symptom exactly: the app still appears in
     * the share sheet, because the Android intent filter is built separately
     * from the MIME types, yet every shared file is dropped before the POST
     * body is assembled.
     *
     * image/* is wider than ingestion accepts, which is fine: uploadDocumentFiles
     * sniffs magic bytes, so a shared GIF or HEIC is refused with a message
     * rather than stored.
     *
     * title/text/url are declared so a link-only share still reaches the server
     * and can say what it was.
     *
     * The ?v= marker is the important part for debugging. A WebAPK bakes this
     * action URL in at mint time, so the version the device posts to is the
     * version of the template it actually holds — the one thing that was
     * impossible to tell from the server while three rounds were spent unsure
     * whether a manifest change had reached the phone at all. Bump it with any
     * share_target change, alongside name, which is what forces the re-mint.
     */
    share_target: {
      action: "/share-target?v=7",
      enctype: "multipart/form-data",
      method: "POST",
      params: {
        files: [{ name: "files", accept: ["image/*", "application/pdf"] }],
        text: "text",
        title: "title",
        url: "url",
      },
    },
    short_name: "My Business",
    start_url: "/",
    theme_color: "#4a3a80",
  };
}

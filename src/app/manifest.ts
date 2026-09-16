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
    name: "My Business Documents",
    scope: "/",
    /*
     * Deliberately wider than what ingestion accepts. Chrome resolves a shared
     * file's type through the content resolver and matches it against this
     * list to choose a form field; a file it cannot place is dropped from the
     * POST body silently, which is a share that arrives with zero parts and no
     * way to tell why. Plenty of Android apps hand out a PDF as
     * application/octet-stream, so the four real types are not enough on their
     * own, and the extensions cover resolvers that report no type at all.
     *
     * Widening costs nothing in safety: uploadDocumentFiles sniffs magic bytes
     * and refuses anything whose content is not actually a JPEG, PNG, WebP or
     * PDF, so a file that should not be here is refused with a message instead
     * of vanishing.
     *
     * title/text/url are declared so a share that carries a link rather than a
     * file still reaches the server, where it can say so.
     */
    share_target: {
      action: "/share-target",
      enctype: "multipart/form-data",
      method: "POST",
      params: {
        files: [
          {
            name: "files",
            accept: [
              ...allowedFileMimeTypes,
              "application/octet-stream",
              ".jpg",
              ".jpeg",
              ".png",
              ".webp",
              ".pdf",
            ],
          },
        ],
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

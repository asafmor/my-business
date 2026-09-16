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
    name: "My Business",
    scope: "/",
    /*
     * MIME types only. Android hands Chrome a content URI whose type it
     * resolves through the content resolver, and Chrome matches that type
     * against this list to decide which form field a shared file belongs in;
     * a file it cannot place is dropped from the POST body without a word.
     * Extensions cost nothing in the Android intent filter (which is
     * MIME-based) and only add entries that matching can trip over.
     */
    share_target: {
      action: "/share-target",
      enctype: "multipart/form-data",
      method: "POST",
      params: {
        files: [{ name: "files", accept: [...allowedFileMimeTypes] }],
      },
    },
    short_name: "My Business",
    start_url: "/",
    theme_color: "#4a3a80",
  };
}

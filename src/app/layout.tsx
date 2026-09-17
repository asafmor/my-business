import type { Metadata, Viewport } from "next";
import { Heebo, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { appName } from "../lib/labels";

import "./globals.css";

/* Heebo carries Hebrew and Latin in one face; Archivo had no Hebrew glyphs. */
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: appName,
  description: "ניהול מסמכים והוצאות פרטי.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#4a3a80",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${heebo.variable} ${plexMono.variable}`}
      /* globals.css sets scroll-behavior: smooth; this tells the router to
         keep it rather than warn and fight it on navigation. */
      data-scroll-behavior="smooth"
      dir="rtl"
      lang="he"
    >
      {/* Extensions (ColorZilla, password managers) stamp attributes on body
          before React hydrates; that mismatch is theirs, not ours. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

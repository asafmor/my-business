import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
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
  title: "My Business",
  description: "Private document and expense management.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${archivo.variable} ${plexMono.variable}`}
      /* globals.css sets scroll-behavior: smooth; this tells the router to
         keep it rather than warn and fight it on navigation. */
      data-scroll-behavior="smooth"
      lang="en"
    >
      {/* Extensions (ColorZilla, password managers) stamp attributes on body
          before React hydrates; that mismatch is theirs, not ours. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

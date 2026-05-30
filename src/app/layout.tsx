import type { Metadata } from "next";
import { Amiri, Cormorant_Garamond, Spectral } from "next/font/google";

import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

const body = Spectral({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

const arabic = Amiri({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ask Prophetic Traditions",
  description:
    "Search the six canonical hadith collections with cited, bilingual evidence — not fatwā.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${arabic.variable}`}>
      <body>{children}</body>
    </html>
  );
}

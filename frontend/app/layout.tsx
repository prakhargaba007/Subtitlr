import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

function getSiteUrl() {
  const fallback = "https://www.kililabs.io";
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";

  try {
    const url = new URL(raw || fallback);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

const siteUrl = getSiteUrl();

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kili",
    template: "%s | Kili",
  },
  description:
    "Upload a video or audio file and get accurate SRT/VTT subtitles or AI dubs in 60+ languages—fast.",
  keywords: [
    "AI subtitles",
    "subtitle generator",
    "SRT generator",
    "VTT generator",
    "video transcription",
    "audio transcription",
    "speech to text",
    "auto captions",
    "subtitle translator",
    "multilingual subtitles",
    "AI dubbing",
    "AI video dubbing",
    "automatic dubbing",
    "dub video online",
    "dubbing software",
    "cheap dubbing",
    "low cost dubbing",
    "free dubbing",
    "dubbing free",
    "free AI dubbing",
    "voice dubbing",
    "video localization",
    "caption editor",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body
        className={`${manrope.variable} ${inter.variable} bg-surface font-body text-on-surface antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

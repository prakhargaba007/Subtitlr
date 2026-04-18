import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

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
  title: "Kili | Subtitles & Dubbing in Seconds",
  description:
    "Upload a video or audio file and get accurate SRT/VTT subtitles or AI dubs in 60+ languages—fast.",
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

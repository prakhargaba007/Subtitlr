import type { Metadata } from "next";
import { Providers } from "../providers";
import "../globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TempUserInit from "@/components/TempUserInit";

export const metadata: Metadata = {
  title: "Subtitlr | The Intelligent Canvas for Transcription",
  description:
    "High-precision transcription meets editorial elegance. Turn video & audio into subtitles in seconds.",
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TempUserInit />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TempUserInit from "@/components/TempUserInit";

export const metadata: Metadata = {
  title: "Dubbing Studio | The Intelligent Canvas for Transcription",
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
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TempUserInit from "@/components/TempUserInit";

export const metadata: Metadata = {
  title: "Kili | Subtitles & Dubbing in Seconds",
  description:
    "Upload a video or audio file and get accurate SRT/VTT subtitles or AI dubs in 60+ languages—fast.",
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
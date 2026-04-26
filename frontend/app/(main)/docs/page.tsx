import type { Metadata } from "next";
import DocsComingSoonClient from "./DocsComingSoonClient";

export const metadata: Metadata = {
  title: "Docs",
  description: "Documentation for uploading, transcribing, dubbing, and exporting with Kili.",
  alternates: { canonical: "/docs" },
  keywords: ["docs", "subtitle docs", "transcription docs", "AI dubbing docs", "SRT export", "VTT export"],
};

export default function DocsPage() {
  return <DocsComingSoonClient />;
}


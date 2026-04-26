import AiToolsComingSoon from "@/components/dashboard/AiToolsComingSoon";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product",
  description: "Explore Kili’s transcription, subtitles, and dubbing workflows.",
  alternates: { canonical: "/product" },
  keywords: ["subtitle editor", "caption editor", "video transcription tool", "AI dubbing tool", "localization tool"],
};

export default function ProductPage() {
  return (
    <div className="pt-20 md:pt-28">
      <AiToolsComingSoon pageKey="ai-tools" source="navbar-product" />
    </div>
  );
}

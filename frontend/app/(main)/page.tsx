import type { Metadata } from "next";
import Script from "next/script";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import LanguageListSection from "@/components/LanguageListSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import TestimonialsSection from "@/components/TestimonialsSection";

export const metadata: Metadata = {
  title: "Subtitles & AI Dubbing in Seconds",
  description:
    "Upload a video or audio file and get accurate SRT/VTT subtitles or AI dubs in 60+ languages—fast.",
  keywords: [
    "AI subtitles",
    "subtitle generator",
    "SRT generator",
    "VTT generator",
    "AI dubbing",
    "AI video dubbing",
    "automatic dubbing",
    "cheap dubbing",
    "low cost dubbing",
    "free AI dubbing",
    "dubbing free",
    "video transcription",
    "speech to text",
    "multilingual subtitles",
  ],
  alternates: { canonical: "/" },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.kililabs.io/#organization",
        name: "Kili",
        url: "https://www.kililabs.io/",
        logo: "https://www.kililabs.io/apple-touch-icon.png",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.kililabs.io/#software",
        name: "Kili",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://www.kililabs.io/",
        offers: {
          "@type": "Offer",
          url: "https://www.kililabs.io/pricing",
        },
      },
    ],
  };

  return (
    <>
      <Script
        id="ld-json-kili"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative pt-32">
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <PricingSection />
        <LanguageListSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
    </>
  );
}

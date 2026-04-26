import type { Metadata } from "next";
import PricingPlansGrid from "@/components/PricingPlansGrid";
import PricingFAQ from "@/components/PricingFAQ";
import FadingCircle from "@/components/FadingCircle";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans and credits for transcription and dubbing. Compare monthly and yearly billing.",
  alternates: { canonical: "/pricing" },
  keywords: [
    "transcription pricing",
    "subtitle pricing",
    "AI dubbing pricing",
    "cheap AI dubbing",
    "low cost AI dubbing",
    "free dubbing",
    "caption credits",
    "SRT pricing",
    "VTT pricing",
  ],
};

export default function PricingPage() {
  return (
    <main className="relative pt-32 pb-24">
      <div aria-hidden className="pointer-events-none absolute left-40 top-40 -translate-x-1/2 -translate-y-[15%] -z-10">
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div aria-hidden className="pointer-events-none absolute right-20 top-92 translate-x-1/4 translate-y-1/4 z-[1000px] opacity-90">
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>
      <div className="max-w-7xl mx-auto px-8">
        <PricingPlansGrid variant="page" />
        <PricingFAQ />
      </div>
    </main>
  );
}

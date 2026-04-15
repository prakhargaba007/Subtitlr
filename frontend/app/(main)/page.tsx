import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import LanguageListSection from "@/components/LanguageListSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import TestimonialsSection from "@/components/TestimonialsSection";

export default function Home() {
  return (
    <>
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

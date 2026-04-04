import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main className="relative pt-32">
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
    </>
  );
}

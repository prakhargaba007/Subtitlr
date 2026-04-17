import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function CTASection() {
  return (
    <section className="max-w-5xl mx-auto px-8 mb-40">
      <div className="bg-linear-to-br from-primary to-primary-container rounded-5xl p-16 text-center text-on-primary relative overflow-hidden">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <h2 className="font-headline font-bold mb-8 relative z-10 text-h3 md:text-h2">
          Ready to break the friction?
        </h2>
        <p className="text-on-primary/80 text-body-lg mb-10 max-w-xl mx-auto relative z-10">
          Join 50,000+ creators and studios turning audio into high-quality
          captions effortlessly.
        </p>

        <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6 relative z-10">
          <Link href="/dashboard">
            <Button variant="surface" size="lg">
              Start Free Trial
            </Button>
          </Link>
          <Button variant="ghost-inverse" size="lg">
            View All Features
          </Button>
        </div>
      </div>
    </section>
  );
}

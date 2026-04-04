import { Button } from "@/components/ui/Button";

export default function PricingSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-32" id="pricing">
      <div className="text-center mb-16">
        <h2 className="font-headline font-bold mb-4 text-h3 md:text-h2">Transparent Pricing</h2>
        <p className="text-on-surface-variant text-body">Choose the plan that fits your production scale.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Hobby */}
        <div className="bg-surface-container-lowest p-10 rounded-4xl border border-outline-variant/10 hover:shadow-xl transition-all">
          <h3 className="font-headline text-h4 font-bold mb-2">Hobby</h3>
          <div className="font-bold mb-6 text-h3">
            $0<span className="text-body font-normal text-on-surface-variant">/mo</span>
          </div>
          <ul className="space-y-4 mb-10 text-on-surface-variant text-sm">
            {["60 mins per month", "Standard speed", "SRT Export"].map((f) => (
              <li key={f} className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="md" className="w-full rounded-xl">
            Start Free
          </Button>
        </div>

        {/* Creator — highlighted */}
        <div className="bg-surface-container-lowest p-10 rounded-4xl border-2 border-primary relative editorial-glow transform scale-105 shadow-2xl">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
            Most Popular
          </div>
          <h3 className="font-headline text-h4 font-bold mb-2">Creator</h3>
          <div className="font-bold mb-6 text-h3">
            $29<span className="text-body font-normal text-on-surface-variant">/mo</span>
          </div>
          <ul className="space-y-4 mb-10 text-on-surface-variant text-sm">
            {["600 mins per month", "Turbo speed", "All export formats", "AI Translation"].map((f) => (
              <li key={f} className="flex items-center space-x-3">
                <span
                  className="material-symbols-outlined text-primary text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            size="md"
            className="w-full rounded-xl hover:scale-[1.02]"
            style={{ boxShadow: "0 10px 30px -8px rgba(57,44,193,0.3)" }}
          >
            Get Started
          </Button>
        </div>

        {/* Production */}
        <div className="bg-surface-container-lowest p-10 rounded-4xl border border-outline-variant/10 hover:shadow-xl transition-all">
          <h3 className="font-headline text-h4 font-bold mb-2">Production</h3>
          <div className="font-bold mb-6 text-h3">
            $99<span className="text-body font-normal text-on-surface-variant">/mo</span>
          </div>
          <ul className="space-y-4 mb-10 text-on-surface-variant text-sm">
            {["Unlimited minutes", "Priority processing", "Custom dictionaries"].map((f) => (
              <li key={f} className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="md" className="w-full rounded-xl">
            Contact Sales
          </Button>
        </div>

      </div>
    </section>
  );
}

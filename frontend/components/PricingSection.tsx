export default function PricingSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-32" id="pricing">
      <div className="text-center mb-16">
        <h2 className="font-headline text-4xl font-bold mb-4">Transparent Pricing</h2>
        <p className="text-on-surface-variant">Choose the plan that fits your production scale.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Hobby */}
        <div className="bg-surface-container-lowest p-10 rounded-[2rem] border border-outline-variant/10 hover:shadow-xl transition-all">
          <h3 className="font-headline text-xl font-bold mb-2">Hobby</h3>
          <div className="text-4xl font-bold mb-6">
            $0<span className="text-base font-normal text-on-surface-variant">/mo</span>
          </div>
          <ul className="space-y-4 mb-10 text-on-surface-variant text-sm">
            {["60 mins per month", "Standard speed", "SRT Export"].map((f) => (
              <li key={f} className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-xl border border-primary/20 text-primary font-bold hover:bg-primary/5 transition-all">
            Start Free
          </button>
        </div>

        {/* Creator — highlighted */}
        <div className="bg-surface-container-lowest p-10 rounded-[2rem] border-2 border-primary relative editorial-glow transform scale-105 shadow-2xl">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
            Most Popular
          </div>
          <h3 className="font-headline text-xl font-bold mb-2">Creator</h3>
          <div className="text-4xl font-bold mb-6">
            $29<span className="text-base font-normal text-on-surface-variant">/mo</span>
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
          <button
            className="w-full py-3 rounded-xl text-white font-bold hover:scale-[1.02] transition-all"
            style={{
              background: "#392cc1",
              boxShadow: "0 10px 30px -8px rgba(57,44,193,0.3)",
            }}
          >
            Get Started
          </button>
        </div>

        {/* Production */}
        <div className="bg-surface-container-lowest p-10 rounded-[2rem] border border-outline-variant/10 hover:shadow-xl transition-all">
          <h3 className="font-headline text-xl font-bold mb-2">Production</h3>
          <div className="text-4xl font-bold mb-6">
            $99<span className="text-base font-normal text-on-surface-variant">/mo</span>
          </div>
          <ul className="space-y-4 mb-10 text-on-surface-variant text-sm">
            {["Unlimited minutes", "Priority processing", "Custom dictionaries"].map((f) => (
              <li key={f} className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-xl border border-primary/20 text-primary font-bold hover:bg-primary/5 transition-all">
            Contact Sales
          </button>
        </div>

      </div>
    </section>
  );
}

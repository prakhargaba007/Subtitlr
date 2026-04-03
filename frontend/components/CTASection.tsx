export default function CTASection() {
  return (
    <section className="max-w-5xl mx-auto px-8 mb-40">
      <div className="bg-gradient-to-br from-primary to-primary-container rounded-[3rem] p-16 text-center text-on-primary relative overflow-hidden">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <h2 className="font-headline text-4xl md:text-5xl font-bold mb-8 relative z-10">
          Ready to break the friction?
        </h2>
        <p className="text-on-primary/80 text-lg mb-10 max-w-xl mx-auto relative z-10">
          Join 50,000+ creators and studios turning audio into high-quality
          captions effortlessly.
        </p>

        <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6 relative z-10">
          <button className="bg-surface-container-lowest text-primary px-10 py-4 rounded-2xl font-headline font-bold hover:bg-surface transition-all">
            Start Free Trial
          </button>
          <button className="text-on-primary font-headline font-bold border border-on-primary/30 px-10 py-4 rounded-2xl hover:bg-white/10 transition-all">
            View All Features
          </button>
        </div>
      </div>
    </section>
  );
}

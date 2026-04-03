export default function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-40 text-center relative z-10">
      <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
          v2.0 Now Live
        </span>
      </div>

      <h1 className="font-headline text-[3.5rem] md:text-[5rem] leading-[1.1] font-bold text-on-surface mb-8 tracking-tighter max-w-4xl mx-auto">
        Turn Video &amp; Audio into{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          Subtitles
        </span>{" "}
        in Seconds
      </h1>

      <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-12 font-light leading-relaxed">
        The intelligent canvas for creators. High-precision transcription meets editorial elegance. No friction,
        just pure content flow.
      </p>

      <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 mb-16">
        <button className="w-full md:w-auto bg-gradient-to-r from-primary to-primary-container text-on-primary px-10 py-5 rounded-2xl font-headline font-bold text-lg flex items-center justify-center space-x-3 shadow-xl hover:shadow-primary/20 transition-all">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            upload_file
          </span>
          <span>Upload File</span>
        </button>
        <button className="w-full md:w-auto px-10 py-5 rounded-2xl font-headline font-bold text-lg text-primary border border-primary/20 hover:bg-primary/5 transition-all">
          Live Demo
        </button>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-200/50 max-w-3xl mx-auto opacity-60">
        <p className="text-xs font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-6">
          Trusted by Creators &amp; Teams
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm font-headline font-semibold text-slate-500">
          <span className="whitespace-nowrap">YouTube</span>
          <span className="text-slate-300">•</span>
          <span className="whitespace-nowrap">Netflix</span>
          <span className="text-slate-300">•</span>
          <span className="whitespace-nowrap">Amazon Prime Video</span>
          <span className="text-slate-300">•</span>
          <span className="whitespace-nowrap">Meta</span>
          <span className="text-slate-300">•</span>
          <span className="whitespace-nowrap">Google</span>
        </div>
      </div>
    </section>
  );
}

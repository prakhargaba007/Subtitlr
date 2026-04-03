export default function FeaturesSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-40">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        <div className="md:col-span-2 bg-surface-container-lowest p-10 rounded-[2rem] editorial-glow border border-outline-variant/10 overflow-hidden relative group">
          <div className="relative z-10">
            <span className="bg-secondary/10 text-secondary group-hover:text-gray-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-6 inline-block">
              Editorial Precision
            </span>
            <h3 className="font-headline text-3xl font-bold mb-4 max-w-md">Smart Context Engine</h3>
            <p className="text-on-surface-variant group-hover:text-gray-300 max-w-sm mb-8">
              AI that understands punctuation, speaker shifts, and industry-specific jargon.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="absolute right-0 bottom-0 w-[100%] opacity-20 group-hover:opacity-90 transition-opacity pointer-events-none"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBszvSUoBi0dK37R6bs-LDRLCrzXZvVyHqbdUBeSBvNCSxuMllp8HsccsovK04jgyBPgHasEXLpNauIhGZUeCGveFS1I_SSGys0qKwI75Y8ptTNSaMng1ePOhyNPRFXD_G965LQ6wUnOWUqcQeRrzsuC6OnvSUUCivfSkbpyRHb-qSQnAwZRivb4lPc2LfwHNXVG8AtZheISEtmTczgbQko4EdWiWR92Mf6ApR0IWYN6mkPnR17BnFd38yIfC64WX4gxKgO_firwoU"
            alt="Abstract flowing wave patterns"
          />
        </div>

        <div className="bg-primary p-10 rounded-[2rem] text-on-primary flex flex-col justify-between shadow-2xl shadow-primary/20">
          <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            language
          </span>
          <div>
            <h3 className="font-headline text-2xl font-bold mb-2">Global Scale</h3>
            <p className="text-primary-fixed opacity-80 text-sm">
              Transcribe in 60+ languages with regional dialect recognition built-in.
            </p>
          </div>
        </div>

        <div className="bg-surface-container-low p-10 rounded-[2rem] flex flex-col justify-between border border-outline-variant/20">
          <div className="flex -space-x-3 mb-6">
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-200" />
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-300" />
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-slate-400" />
          </div>
          <div>
            <h3 className="font-headline text-2xl font-bold mb-2">Team Sync</h3>
            <p className="text-on-surface-variant text-sm">
              Collaborative workspace for production teams to edit and review in real-time.
            </p>
          </div>
        </div>

        <div className="md:col-span-2 bg-surface-container-lowest p-10 rounded-[2rem] editorial-glow border border-outline-variant/10 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <h3 className="font-headline text-3xl font-bold mb-4">API First</h3>
            <p className="text-on-surface-variant mb-6">
              Integrate Subtitlr directly into your workflow with our developer-friendly SDK.
            </p>
            <button className="text-primary font-bold flex items-center space-x-2 group">
              <span>Read Documentation</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
          <div className="flex-1 w-full bg-on-background/5 rounded-xl p-4 font-mono text-xs text-on-surface-variant border border-outline-variant/10">
            <div className="flex space-x-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <code>
              curl -X POST https://api.subtitlr.ai/v1/jobs \<br />
              {` -H "Authorization: Bearer $API_KEY"`}
            </code>
          </div>
        </div>

      </div>
    </section>
  );
}

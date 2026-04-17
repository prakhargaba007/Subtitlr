export default function FeaturesSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-40">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        <div className="md:col-span-2 bg-surface-container-lowest p-10 rounded-[2rem] editorial-glow border border-outline-variant/10 overflow-hidden relative group">
          <div className="relative z-10">
            <span className="bg-secondary/10 text-secondary group-hover:text-gray-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-6 inline-block">
              Editorial Precision
            </span>
            <h3 className="font-headline text-3xl font-bold mb-4 max-w-md group-hover:text-gray-50">Smart Context Engine</h3>
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
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-blue-100 flex items-center justify-center text-blue-600"><span className="material-symbols-outlined text-sm">person</span></div>
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-green-100 flex items-center justify-center text-green-600"><span className="material-symbols-outlined text-sm">person</span></div>
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-purple-100 flex items-center justify-center text-purple-600"><span className="material-symbols-outlined text-sm">person</span></div>
          </div>
          <div>
            <h3 className="font-headline text-2xl font-bold mb-2">Team Sync</h3>
            <p className="text-on-surface-variant text-sm">
              Collaborative workspace for production teams to edit and review in real-time.
            </p>
          </div>
        </div>

        <div className="md:col-span-2 bg-surface-container-lowest p-10 rounded-[2rem] editorial-glow border border-outline-variant/10 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
          <div className="flex-1 relative z-10">
            <h3 className="font-headline text-3xl font-bold mb-4">Reels &amp; TikTok Ready</h3>
            <p className="text-on-surface-variant mb-6">
              Stand out with word-level caption styling, active word highlighting, and dynamic presets built for the feed.
            </p>
            <button className="text-primary font-bold flex items-center space-x-2 group">
              <span>View Presets</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                edit
              </span>
            </button>
          </div>
          <div className="flex-1 w-full bg-surface-container-low rounded-xl p-8 border border-outline-variant/10 flex items-center justify-center relative z-10 shadow-inner">
            <div className="text-center font-headline font-bold text-2xl sm:text-3xl tracking-wide">
              <span className="text-on-surface-variant/40">This is </span>
              <span className="text-primary bg-primary/10 px-3 py-1 rounded-xl shadow-sm border border-primary/20">dynamic</span>
              <span className="text-on-surface-variant/40"> styling</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-8 py-20 mb-40 relative">
      <div className="text-center mb-24">
        <h2 className="font-headline text-3xl font-bold mb-4">The Frictionless Journey</h2>
        <div className="h-1 w-12 bg-primary mx-auto rounded-full" />
      </div>

      {/* Connector SVG */}
      <div className="path-container hidden lg:block">
        <svg fill="none" height="100%" viewBox="0 0 1200 400" width="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M150 200C300 200 300 100 450 100" stroke="#c7c4d8" strokeDasharray="6 6" strokeWidth="2" />
          <path d="M450 100C600 100 600 300 750 300" stroke="#392cc1" strokeOpacity="0.3" strokeWidth="2" />
          <path d="M750 300C900 300 900 200 1050 200" stroke="#c7c4d8" strokeDasharray="6 6" strokeWidth="2" />
          <circle cx="150" cy="200" fill="#392cc1" r="4" />
          <circle cx="450" cy="100" fill="#392cc1" r="4" />
          <circle cx="750" cy="300" fill="#392cc1" r="4" />
          <circle cx="1050" cy="200" fill="#392cc1" r="4" />
        </svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
        {/* Step 1 */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-surface-container-lowest editorial-glow flex items-center justify-center mb-8 border border-outline-variant/10 group hover:border-primary/30 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
          </div>
          <h3 className="font-headline text-xl font-semibold mb-2">Upload</h3>
          <p className="text-on-surface-variant text-sm font-light">Drag any media format into the workspace.</p>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center text-center lg:-mt-[50px]">
          <div className="w-20 h-20 rounded-3xl bg-surface-container-lowest editorial-glow flex items-center justify-center mb-8 border border-outline-variant/10 group hover:border-primary/30 transition-all relative">
            <div className="absolute -inset-2 bg-primary/5 rounded-full blur-xl" />
            <span className="material-symbols-outlined text-primary text-3xl relative">sync_alt</span>
          </div>
          <h3 className="font-headline text-xl font-semibold mb-2">Auto-Conversion</h3>
          <p className="text-on-surface-variant text-sm font-light">Optimized for processing speed.</p>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col items-center text-center lg:mt-[100px]">
          <div className="w-20 h-20 rounded-3xl bg-surface-container-lowest editorial-glow flex items-center justify-center mb-8 border border-outline-variant/10 group hover:border-primary/30 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
          </div>
          <h3 className="font-headline text-xl font-semibold mb-2">AI Generation</h3>
          <p className="text-on-surface-variant text-sm font-light">99% accuracy in over 60 languages.</p>
        </div>

        {/* Step 4 */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-surface-container-lowest editorial-glow flex items-center justify-center mb-8 border border-outline-variant/10 group hover:border-primary/30 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl">file_download</span>
          </div>
          <h3 className="font-headline text-xl font-semibold mb-2">Download</h3>
          <p className="text-on-surface-variant text-sm font-light">Export to SRT, VTT, or TXT instantly.</p>
        </div>
      </div>
    </section>
  );
}

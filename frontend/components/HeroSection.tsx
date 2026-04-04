import FadingCircle from "@/components/FadingCircle";
import LogoLoop from "./reactBit/LogoLoop";

export default function HeroSection() {
  return (
    <section className="max-w-9xl mx-auto px-8 mb-40 text-center relative z-10 overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute left-20 top-0 -translate-x-1/2 -translate-y-[15%] -z-10"
      >
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90"
      >
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>
      <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
          v2.0 Now Live
        </span>
      </div>

      <h1 className="font-headline text-[3.5rem] md:text-[5rem] leading-[1.1] font-bold text-on-surface mb-8 tracking-tighter max-w-4xl mx-auto">
        Turn Video &amp; Audio into{" "}
        <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
          Subtitles
        </span>{" "}
        in Seconds
      </h1>

      <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-12 font-light leading-relaxed">
        The intelligent canvas for creators. High-precision transcription meets editorial elegance. No friction,
        just pure content flow.
      </p>

      <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 mb-16">
        <button className="w-full md:w-auto bg-linear-to-r from-primary to-primary-container text-on-primary px-10 py-5 rounded-2xl font-headline font-bold text-lg flex items-center justify-center space-x-3 shadow-xl hover:shadow-primary/20 transition-all">
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
        <div className="max-w-xl mx-auto flex justify-center items-center">
          <LogoLoop
            logos={[
              { src: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg", alt: "Microsoft", href: "https://microsoft.com" },
              { src: "https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg", alt: "Spotify", href: "https://spotify.com" },
              { src: "https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg", alt: "IBM", href: "https://ibm.com" },
              { src: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg", alt: "Google", href: "https://google.com" },
              { src: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg", alt: "Nike", href: "https://nike.com" },
            ]}
            speed={70}
            direction="left"
            logoHeight={28}
            gap={42}
            fadeOut
            fadeOutColor="#fff"
            ariaLabel="Trusted by these companies"
            className="w-full"
          />
        </div>
      </div>
    </section>
  );
}

import FadingCircle from "@/components/FadingCircle";
import LogoLoop from "./reactBit/LogoLoop";
import { Button } from "@/components/ui/Button";
import UploadButton from "@/components/UploadButton";

const isDirectUploadEnabled = true;

export default function HeroSection() {
  return (
    <section className="max-w-9xl mx-auto px-8 mb-40 text-center relative z-10 overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute left-40 top-0 -translate-x-1/2 -translate-y-[15%] -z-10"
      >
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-20 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90"
      >
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>
      <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
          v2.0 Now Live
        </span>
      </div>

      <h1 className="font-headline text-h1 md:text-display leading-[1.1] font-bold text-on-surface mb-8 tracking-tighter max-w-4xl mx-auto">
        Turn Video &amp; Audio into{" "}
        <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">
          Subtitles
        </span>{" "}
        in Seconds
      </h1>

      <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto mb-12 font-light leading-relaxed">
        The intelligent canvas for creators. High-precision transcription meets editorial elegance. No friction,
        just pure content flow.
      </p>

      {isDirectUploadEnabled ? (
        <div className="max-w-2xl mx-auto mb-16">
          <div className="group relative cursor-pointer">
            <div className="absolute -inset-1 bg-linear-to-r from-primary/10 to-secondary/10 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-white/80 backdrop-blur-sm border-2 border-dashed border-primary/20 rounded-[2.5rem] p-12 transition-all hover:border-primary/40 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl [font-variation-settings:'FILL'_1]">
                  add_circle
                </span>
              </div>
              <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">Drop files to begin</h3>
              <p className="text-on-surface-variant text-sm font-light">
                or click to browse your workspace (MP4, MOV, MP3, WAV)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 mb-16">
        <UploadButton />
          <Button variant="outline" size="xl" className="w-full md:w-auto">
            Live Demo
          </Button>
        </div>
      )}

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

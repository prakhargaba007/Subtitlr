"use client";

import { useState } from "react";
import FadingCircle from "@/components/FadingCircle";
import LogoLoop from "./reactBit/LogoLoop";
import UploadCard from "@/components/UploadCard";

export default function HeroSection() {
  const [mode, setMode] = useState<"subtitles" | "dubbing">("dubbing");
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);

  const handleSample = async () => {
    if (sampleLoading) return;
    setSampleLoading(true);
    try {
      const res = await fetch("/sample.mp4");
      if (!res.ok) throw new Error("Failed to load sample video");
      const blob = await res.blob();
      const file = new File([blob], "sample.mp4", { type: blob.type || "video/mp4" });
      setSampleFile(file);
    } finally {
      setSampleLoading(false);
    }
  };

  return (
    <section className="max-w-9xl mx-auto px-8 mb-40 text-center relative z-10 overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute left-40 top-0 -translate-x-1/2 -translate-y-[15%] -z-10">
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div aria-hidden className="pointer-events-none absolute right-20 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90">
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>

      <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">Launch Date - 18th April 2026</span>
      </div>

      <h1 className="font-headline text-h1 md:text-display leading-[1.1] font-bold text-on-surface mb-8 tracking-tight max-w-4xl mx-auto transition-all duration-300">
        Turn Video &amp; Audio into{" "}
        <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">
          {mode === "dubbing" ? "Dubs" : "Subtitles"}
        </span>{" "}
        in Seconds
      </h1>

      <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto mb-10 font-light leading-relaxed">
        Upload a video, get accurate SRT/VTT captions in 60+ languages in under a minute.
      </p>

      <div className="max-w-3xl mx-auto mb-4">
        <UploadCard onModeChange={setMode} selectedFile={sampleFile} onSelectedFileChange={setSampleFile} />
      </div>

      <div className="flex justify-center mb-16">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleSample}
            disabled={sampleLoading}
            className="text-sm font-headline font-medium text-primary hover:text-primary/80 disabled:text-primary/60 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
          <span className="material-symbols-outlined text-sm">play_circle</span>
            {sampleLoading ? "Loading sample…" : "No video? Try the sample"}
          </button>
          {/* <p className="text-xs text-on-surface-variant/70">
            Sample video is from the Rennrat YouTube channel.
          </p> */}
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-200/50 max-w-3xl mx-auto opacity-60">
        <p className="text-xs font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-6">
          Built for creators on YouTube, TikTok, and Reels
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

"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FadingCircle from "@/components/FadingCircle";
import LogoLoop from "./reactBit/LogoLoop";
import { setPendingFile } from "@/utils/fileStore";

const ACCEPTED_MIME = new Set([
  "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
  "video/webm", "video/x-matroska", "video/3gpp", "video/3gpp2",
  "video/x-flv", "video/x-ms-wmv", "video/ogg",
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/webm",
  "audio/x-m4a", "audio/m4a", "audio/x-flac",
]);

export default function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setError(null);

      if (!ACCEPTED_MIME.has(file.type)) {
        setError("Unsupported file type. Please upload a video or audio file (MP4, MOV, MP3, WAV…).");
        return;
      }

      setPendingFile(file);
      router.push(
        `/processing?name=${encodeURIComponent(file.name)}&size=${file.size}`
      );
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    // reset so the same file can be re-selected if needed
    e.target.value = "";
  };

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

      <h1 className="font-headline text-h1 md:text-display leading-[1.1] font-bold text-on-surface mb-8 tracking-tight max-w-4xl mx-auto">
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

      {/* Upload zone */}
      <div className="max-w-2xl mx-auto mb-16">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={onInputChange}
        />

        <div
          className="group relative cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Upload video or audio file"
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <div
            className={[
              "absolute -inset-1 rounded-[2.5rem] blur opacity-75 transition duration-1000",
              dragOver
                ? "bg-linear-to-r from-primary/30 to-secondary/30 opacity-100"
                : "bg-linear-to-r from-primary/10 to-secondary/10 group-hover:opacity-100 group-hover:duration-200",
            ].join(" ")}
          />
          <div
            className={[
              "relative bg-white/80 backdrop-blur-sm border-2 border-dashed rounded-[2.5rem] p-12 transition-all flex flex-col items-center justify-center",
              dragOver
                ? "border-primary/70 bg-primary/5"
                : "border-primary/20 hover:border-primary/40",
            ].join(" ")}
          >
            <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-4xl [font-variation-settings:'FILL'_1]">
                {dragOver ? "file_upload" : "add_circle"}
              </span>
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">
              {dragOver ? "Drop to upload" : "Drop files to begin"}
            </h3>
            <p className="text-on-surface-variant text-sm font-light">
              or click to browse your workspace (MP4, MOV, MP3, WAV)
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500 font-medium">{error}</p>
        )}
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

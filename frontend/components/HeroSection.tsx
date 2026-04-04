"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import FadingCircle from "@/components/FadingCircle";
import LogoLoop from "./reactBit/LogoLoop";
import { setPendingFile, setPendingLanguage } from "@/utils/fileStore";
import axiosInstance from "@/utils/axios";

// ── Accepted MIME types ───────────────────────────────────────────────────────

const ACCEPTED_MIME = new Set([
  "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
  "video/webm", "video/x-matroska", "video/3gpp", "video/3gpp2",
  "video/x-flv", "video/x-ms-wmv", "video/ogg",
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/webm",
  "audio/x-m4a", "audio/m4a", "audio/x-flac",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiLanguage {
  value: string;
  label: string;
  isoCode: string | null;
}

const AUTO_DETECT: ApiLanguage = { value: "", label: "Auto-detect", isoCode: null };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Searchable language dropdown ──────────────────────────────────────────────

function LanguagePicker({
  languages,
  value,
  onChange,
}: {
  languages: ApiLanguage[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? languages.filter((l) => l.label.toLowerCase().includes(q)) : languages;
  }, [languages, query]);

  const selected = languages.find((l) => l.value === value) ?? AUTO_DETECT;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (lang: ApiLanguage) => {
    onChange(lang.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/60 border border-outline-variant/30 rounded-2xl text-sm font-body text-on-surface hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-base shrink-0">language</span>
          <span className="truncate">{selected.label}</span>
        </span>
        <span
          className={`material-symbols-outlined text-on-surface-variant text-lg shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-outline-variant/10">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-on-surface-variant text-base">search</span>
              <input
                autoFocus
                type="text"
                placeholder="Search language…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <ul className="max-h-52 overflow-y-auto py-1.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-on-surface-variant text-center">No results</li>
            ) : (
              filtered.map((lang) => (
                <li key={lang.value}>
                  <button
                    type="button"
                    onClick={() => pick(lang)}
                    className={[
                      "w-full text-left px-4 py-2.5 text-sm font-body transition-colors flex items-center gap-3",
                      lang.value === value
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-on-surface hover:bg-surface-container-low",
                    ].join(" ")}
                  >
                    {lang.value === value && (
                      <span className="material-symbols-outlined text-primary text-base">check</span>
                    )}
                    <span className={lang.value === value ? "" : "ml-[22px]"}>{lang.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("");
  const [languages, setLanguages] = useState<ApiLanguage[]>([AUTO_DETECT]);

  // Fetch supported languages
  useEffect(() => {
    axiosInstance
      .get<{ languages: ApiLanguage[] }>("/api/subtitles/languages")
      .then((res) => setLanguages([AUTO_DETECT, ...res.data.languages]))
      .catch(() => { });
  }, []);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_MIME.has(file.type)) {
      setError("Unsupported file type. Please upload a video or audio file (MP4, MOV, MP3, WAV…).");
      return;
    }
    setSelectedFile(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]); e.target.value = "";
  };

  const handleNext = () => {
    if (!selectedFile) return;
    setPendingFile(selectedFile);
    setPendingLanguage(language);
    router.push(`/processing?name=${encodeURIComponent(selectedFile.name)}&size=${selectedFile.size}`);
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
        <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">v2.0 Now Live</span>
      </div>

      <h1 className="font-headline text-h1 md:text-display leading-[1.1] font-bold text-on-surface mb-8 tracking-tight max-w-4xl mx-auto">
        Turn Video &amp; Audio into{" "}
        <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">Subtitles</span>{" "}
        in Seconds
      </h1>

      <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto mb-12 font-light leading-relaxed">
        The intelligent canvas for creators. High-precision transcription meets editorial elegance. No friction,
        just pure content flow.
      </p>

      {/* ── Two-column upload card ── */}
      <div className="max-w-3xl mx-auto mb-16">
        <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={onInputChange} />

        <div className="relative">
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-linear-to-r from-primary/10 to-secondary/10 rounded-4xl blur opacity-75" />

          <div className="relative bg-white/80 backdrop-blur-sm border border-white/60 rounded-4xl overflow-hidden shadow-xl shadow-indigo-100/40">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] ">

              {/* ── Left: drop zone ── */}
              <div
                className={[
                  "group cursor-pointer border-r border-outline-variant/10 p-10 flex flex-col items-center justify-center gap-5 transition-all min-h-[260px]",
                  dragOver ? "bg-primary/5" : "hover:bg-primary/2",
                ].join(" ")}
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                role="button"
                tabIndex={0}
                aria-label="Upload video or audio file"
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              >
                {selectedFile ? (
                  /* File selected state */
                  <>
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-3xl [font-variation-settings:'FILL'_1]">
                        {selectedFile.type.startsWith("video/") ? "movie" : "music_note"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-headline font-bold text-on-surface text-base truncate max-w-[260px]" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-on-surface-variant">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setError(null); }}
                      className="flex items-center gap-1.5 text-xs font-headline font-semibold text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      Change file
                    </button>
                  </>
                ) : (
                  /* Empty state */
                  <>
                    <div
                      className={[
                        "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                        dragOver ? "bg-primary text-on-primary scale-110" : "bg-primary/8 text-primary group-hover:scale-105",
                      ].join(" ")}
                    >
                      <span className="material-symbols-outlined text-4xl [font-variation-settings:'FILL'_1]">
                        {dragOver ? "file_upload" : "cloud_upload"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-headline text-xl font-bold text-on-surface">
                        {dragOver ? "Drop to upload" : "Drop your file here"}
                      </h3>
                      <p className="text-on-surface-variant text-sm font-light">
                        or <span className="text-primary font-semibold">click to browse</span> — MP4, MOV, MP3, WAV
                      </p>
                    </div>

                    {/* Format chips */}
                    <div className="flex gap-2 flex-wrap justify-center">
                      {["MP4", "MOV", "MP3", "WAV", "WEBM"].map((fmt) => (
                        <span key={fmt} className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant text-[11px] font-headline font-bold rounded-lg">
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── Right: language + action ── */}
              <div className="flex flex-col gap-4 p-6 bg-surface-container-lowest/50">

                {/* Language label */}
                <div>
                  <p className="text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                    Subtitle Language
                  </p>
                  <LanguagePicker
                    languages={languages}
                    value={language}
                    onChange={setLanguage}
                  />
                  <p className="mt-2 text-[11px] text-on-surface-variant/60 leading-relaxed">
                    {language === ""
                      ? "Whisper will detect the language automatically."
                      : `Transcribing in ${languages.find((l) => l.value === language)?.label ?? language}.`}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-outline-variant/10" />

                {/* Generate button */}
                <button
                  onClick={handleNext}
                  disabled={!selectedFile}
                  className={[
                    "w-full flex items-center justify-center gap-2 py-3.5 font-headline font-bold text-sm rounded-2xl transition-all",
                    selectedFile
                      ? "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/25"
                      : "bg-surface-container text-on-surface-variant cursor-not-allowed",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Generate Subtitles
                </button>

                {/* Upload another hint */}
                {!selectedFile && (
                  <p className="text-[11px] text-center text-on-surface-variant/50">
                    Select a file to get started
                  </p>
                )}

                {error && (
                  <p className="text-xs text-red-500 font-medium text-center">{error}</p>
                )}
              </div>

            </div>
          </div>
        </div>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e0e3e5; border-radius: 10px; }
      `}</style>
    </section>
  );
}

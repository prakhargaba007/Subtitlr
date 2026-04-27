"use client";

import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  setPendingFile,
  setPendingLanguage,
  setPendingMode,
  setPendingSourceLanguage,
  setPendingTargetLanguage,
  setPendingYoutubeUrl,
} from "@/utils/fileStore";
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

export interface ApiLanguage {
  lang_name: string;
  label: string;
  iso_code: string | null;
  sub: { isEnable: boolean; provider: string | null };
  dub: { isEnable: boolean; provider: string | null };
}

const AUTO_DETECT: ApiLanguage = {
  lang_name: "",
  label: "Auto-detect",
  iso_code: null,
  sub: { isEnable: true, provider: null },
  dub: { isEnable: false, provider: null },
};

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

  const selected = languages.find((l) => l.lang_name === value) ?? AUTO_DETECT;

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
    onChange(lang.lang_name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
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

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
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

          <ul className="max-h-52 overflow-y-auto py-1.5 upload-card-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-on-surface-variant text-center">No results</li>
            ) : (
              filtered.map((lang, idx) => (
                <li key={`${lang.lang_name}::${lang.label}::${lang.iso_code ?? "x"}::${idx}`}>
                  <button
                    type="button"
                    onClick={() => pick(lang)}
                    className={[
                      "w-full text-left px-4 py-2.5 text-sm font-body transition-colors flex items-center gap-3",
                      lang.lang_name === value
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-on-surface hover:bg-surface-container-low",
                    ].join(" ")}
                  >
                    {lang.lang_name === value && (
                      <span className="material-symbols-outlined text-primary text-base">check</span>
                    )}
                    <span className={lang.lang_name === value ? "" : "ml-[22px]"}>{lang.label}</span>
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

// ── UploadCard ────────────────────────────────────────────────────────────────

function UploadCardFallback() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-1 bg-linear-to-r from-primary/10 to-secondary/10 rounded-4xl blur opacity-75" />
      <div className="relative bg-white/80 backdrop-blur-sm border border-white/60 rounded-4xl overflow-hidden shadow-xl shadow-indigo-100/40 min-h-[320px] animate-pulse" />
    </div>
  );
}

function UploadCardInner({
  basePath = "",
  onModeChange,
  selectedFile: selectedFileProp,
  onSelectedFileChange,
}: {
  basePath?: string;
  onModeChange?: (mode: "subtitles" | "dubbing") => void;
  selectedFile?: File | null;
  onSelectedFileChange?: (file: File | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalSelectedFile, setInternalSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
  const [languageBundle, setLanguageBundle] = useState<{
    mode: "subtitles" | "dubbing";
    languages: ApiLanguage[];
  } | null>(null);
  const selectedFile = selectedFileProp ?? internalSelectedFile;

  const urlMode = (searchParams.get("mode") || "dubbing").toLowerCase();
  const [mode, setMode] = useState<"subtitles" | "dubbing">(urlMode === "subtitles" ? "subtitles" : "dubbing");

  const langReady =
    languageBundle !== null && languageBundle.mode === mode;
  const languages =
    langReady && languageBundle ? languageBundle.languages : [];

  useEffect(() => {
    if (onModeChange) onModeChange(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    const q = mode === "subtitles" ? "subtitles" : "dubbing";
    let cancelled = false;
    axiosInstance
      .get<{ languages: ApiLanguage[] }>(`/api/subtitles/languages?mode=${q}`)
      .then((res) => {
        if (cancelled) return;
        const incoming = (() => {
          const d = res.data as unknown as { languages?: unknown } | unknown[];
          if (Array.isArray(d)) return d;
          const langs = (d as { languages?: unknown })?.languages;
          return Array.isArray(langs) ? langs : [];
        })();

        const raw: ApiLanguage[] = incoming
          .map((l) => {
            const obj =
              typeof l === "object" && l !== null ? (l as Record<string, unknown>) : null;
            if (!obj) return null;

            const lang_name =
              typeof obj.lang_name === "string"
                ? obj.lang_name
                : typeof obj.value === "string"
                  ? obj.value
                  : null;
            if (!lang_name || !lang_name.trim()) return null;

            const label =
              typeof obj.label === "string" && obj.label.trim() ? obj.label : lang_name;

            const iso_code =
              typeof obj.iso_code === "string"
                ? obj.iso_code
                : typeof obj.isoCode === "string"
                  ? obj.isoCode
                  : null;

            const dubbingProvider =
              typeof obj.dubbingTts === "string" ? obj.dubbingTts : null;

            return {
              lang_name,
              label,
              iso_code,
              sub: { isEnable: q === "subtitles", provider: q === "subtitles" ? "whisper" : null },
              dub: { isEnable: q === "dubbing", provider: q === "dubbing" ? dubbingProvider : null },
            };
          })
          .filter((x): x is ApiLanguage => Boolean(x));

        if (q === "subtitles") {
          const next = [AUTO_DETECT, ...raw];
          setLanguageBundle({ mode: "subtitles", languages: next });
          setLanguage((prev) => (prev && raw.some((l) => l.lang_name === prev) ? prev : ""));
        } else {
          setLanguageBundle({ mode: "dubbing", languages: raw });
          setLanguage((prev) => {
            if (prev && raw.some((l) => l.lang_name === prev)) return prev;
            return raw[0]?.lang_name || "";
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (q === "subtitles") {
          setLanguageBundle({ mode: "subtitles", languages: [AUTO_DETECT] });
        } else {
          setLanguageBundle({ mode: "dubbing", languages: [] });
          setLanguage("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_MIME.has(file.type)) {
      setError("Unsupported file type. Please upload a video or audio file (MP4, MOV, MP3, WAV…).");
      return;
    }
    setInternalSelectedFile(file);
    onSelectedFileChange?.(file);
  }, [onSelectedFileChange]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile],
  );
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const isValidYoutubeUrl = (raw: string): boolean => {
    const v = raw.trim();
    if (!v) return false;
    try {
      const u = new URL(v);
      const host = (u.hostname || "").toLowerCase();
      return (
        host === "youtube.com" ||
        host === "www.youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtu.be" ||
        host === "www.youtu.be"
      );
    } catch {
      return false;
    }
  };

  const ensureAuthenticatedOrRedirect = async (nextPath: string): Promise<boolean> => {
    // If auth check is already running, don't duplicate requests.
    if (authChecking) return false;

    setAuthChecking(true);
    try {
      // `GET /api/user/profile` is protected by backend auth middleware.
      await axiosInstance.get("/api/user/profile");
      return true;
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 401) {
        if (typeof window !== "undefined") {
          localStorage.setItem("redirectAfterLogin", nextPath);
        }
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        return false;
      }
      // Non-auth error: let the user try again.
      setError("Could not verify login status. Please try again.");
      return false;
    } finally {
      setAuthChecking(false);
    }
  };

  const handleNext = async () => {
    const safeLang = language ?? "";
    if (mode === "dubbing" && !safeLang.trim()) {
      setError("Please choose a dubbing target language.");
      return;
    }

    const yt = youtubeUrl.trim();
    if (mode === "dubbing" && yt) {
      if (!isValidYoutubeUrl(yt)) {
        setError("Please enter a valid YouTube video URL.");
        return;
      }
      setError(null);
      setPendingYoutubeUrl(yt);
      setPendingMode(mode);
      setPendingTargetLanguage(safeLang);
      setPendingSourceLanguage(""); // auto
      const nextPath = `${basePath}/processing?name=${encodeURIComponent("youtube")}&size=0`;
      const ok = await ensureAuthenticatedOrRedirect(nextPath);
      if (!ok) return;
      router.push(nextPath);
      return;
    }

    if (!selectedFile) {
      setError("No file attached. Please upload a file to continue.");
      return;
    }

    setPendingFile(selectedFile);
    setPendingMode(mode);
    if (mode === "subtitles") {
      setPendingLanguage(safeLang);
    } else {
      // For dubbing we treat the picker as *target language* for now
      setPendingTargetLanguage(safeLang);
      setPendingSourceLanguage(""); // auto
    }
    const nextPath = `${basePath}/processing?name=${encodeURIComponent(selectedFile.name)}&size=${selectedFile.size}`;
    const ok = await ensureAuthenticatedOrRedirect(nextPath);
    if (!ok) return;
    router.push(nextPath);
  };

  const selectedLangRow = langReady ? languages.find((l) => l.lang_name === language) : undefined;
  const dubProvider = selectedLangRow?.dub?.provider;
  const dubbingTtsLabel =
    dubProvider === "sarvam"
      ? "Sarvam TTS"
      : dubProvider === "inworld"
        ? "Inworld TTS (voice catalog)"
        : "your configured dubbing TTS provider";

  const canProceed =
    langReady &&
    (mode !== "dubbing" || (language ?? "").trim()) &&
    (mode === "dubbing" ? Boolean(selectedFile || youtubeUrl.trim()) : Boolean(selectedFile));

  return (
    <>
      <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={onInputChange} />

      <div className="relative">
        <div className="absolute -inset-1 bg-linear-to-r from-primary/10 to-secondary/10 rounded-4xl blur opacity-75" />

        <div className="relative bg-white/80 backdrop-blur-sm border border-white/60 rounded-4xl shadow-xl shadow-indigo-100/40">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">

            {/* ── Left: drop zone or YouTube link ── */}
            <div className="flex flex-col border-r border-outline-variant/10 min-h-[260px]">
              <div
                className={[
                  "group cursor-pointer flex-1 p-10 flex flex-col items-center justify-center gap-5 transition-all",
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
                  <>
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-3xl [font-variation-settings:'FILL'_1]">
                        {selectedFile.type.startsWith("video/") ? "movie" : "music_note"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p
                        className="font-headline font-bold text-on-surface text-base truncate max-w-[260px]"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-on-surface-variant">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInternalSelectedFile(null);
                        onSelectedFileChange?.(null);
                        setError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-headline font-semibold text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      Change file
                    </button>
                  </>
                ) : mode === "dubbing" && youtubeUrl.trim() ? (
                  <>
                    <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600">
                      <span className="material-symbols-outlined text-3xl [font-variation-settings:'FILL'_1]">
                        link
                      </span>
                    </div>
                    <div className="space-y-1 w-full max-w-[280px]">
                      <p className="text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant text-center">
                        YouTube link
                      </p>
                      <p
                        className="font-headline font-bold text-on-surface text-sm break-all line-clamp-3 text-center"
                        title={youtubeUrl.trim()}
                      >
                        {youtubeUrl.trim()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setYoutubeUrl("");
                        setError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-headline font-semibold text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                      Clear link
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className={[
                        "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                        dragOver
                          ? "bg-primary text-on-primary scale-110"
                          : "bg-primary/8 text-primary group-hover:scale-105",
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
                    <div className="flex gap-2 flex-wrap justify-center">
                      {["MP4", "MOV", "MP3", "WAV", "WEBM"].map((fmt) => (
                        <span
                          key={fmt}
                          className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant text-[11px] font-headline font-bold rounded-lg"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                    {/* {mode === "dubbing" && (
                      <div
                        className="w-full max-w-[320px] mt-2 flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <span className="h-px bg-outline-variant/20 flex-1" />
                          <span className="text-xs font-headline font-semibold text-on-surface-variant shrink-0">or</span>
                          <span className="h-px bg-outline-variant/20 flex-1" />
                        </div>
                        <input
                          value={youtubeUrl}
                          onChange={(e) => {
                            const next = e.target.value;
                            setYoutubeUrl(next);
                            if (next.trim()) {
                              setInternalSelectedFile(null);
                              onSelectedFileChange?.(null);
                            }
                          }}
                          placeholder="Paste a YouTube video URL"
                          className="w-full h-[46px] px-4 rounded-2xl bg-white border border-outline-variant/15 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm cursor-text"
                          inputMode="url"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                        <p className="text-[11px] text-on-surface-variant/60 text-center leading-relaxed">
                          Dub from a link instead of uploading a file.
                        </p>
                      </div>
                    )} */}
                  </>
                )}
              </div>
            </div>

            {/* ── Right: language + action ── */}
            <div className="flex flex-col gap-4 p-6 bg-surface-container-lowest/50">
              <div className="flex bg-surface-container-low rounded-xl p-1 w-full mb-2">
                <button
                  type="button"
                  onClick={() => setMode("subtitles")}
                  className={`flex-1 px-4 py-1.5 text-sm font-headline font-semibold rounded-lg transition-colors ${mode === "subtitles" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  Subtitles
                </button>
                <button
                  type="button"
                  onClick={() => setMode("dubbing")}
                  className={`flex-1 px-4 py-1.5 text-sm font-headline font-semibold rounded-lg transition-colors ${mode === "dubbing" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  Dubbing
                </button>
              </div>

              <div>
                <p className="text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  {mode === "dubbing" ? "Dubbing Language (Target)" : "Subtitle Language"}
                </p>
                {!langReady ? (
                  <div className="relative w-full">
                    <div className="h-[46px] w-full rounded-2xl bg-surface-container-low/50 border border-outline-variant/15 animate-pulse" />
                  </div>
                ) : mode === "dubbing" && languages.length === 0 ? (
                  <p className="text-sm text-red-600/90 py-2">Could not load dubbing languages. Try again later.</p>
                ) : (
                  <LanguagePicker languages={languages} value={language} onChange={setLanguage} />
                )}
                <p className="mt-2 text-[11px] text-on-surface-variant/60 leading-relaxed">
                  {mode === "dubbing"
                    ? language
                      ? `Dubbing to ${selectedLangRow?.label ?? language}. This target is set up for ${dubbingTtsLabel}. Source speech is auto-detected.`
                      : "Pick a dubbing target from the list. Indic languages use Sarvam TTS when configured; other listed languages map to the Inworld voice catalog when Inworld is your TTS backend."
                    : language === ""
                      ? "Whisper will detect the language automatically."
                      : `Transcribing in ${selectedLangRow?.label ?? language} (Whisper).`}
                </p>
              </div>

              <div className="border-t border-outline-variant/10" />

              <button
                onClick={handleNext}
                disabled={!canProceed || authChecking}
                className={[
                  "w-full flex items-center justify-center gap-2 py-3.5 font-headline font-bold text-sm rounded-2xl transition-all",
                  canProceed
                    ? "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/25"
                    : "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.99]",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                {authChecking
                  ? "Checking…"
                  : mode === "dubbing"
                    ? "Start Dubbing"
                    : "Generate Subtitles"}
              </button>

              {!selectedFile && !(mode === "dubbing" && youtubeUrl.trim()) && (
                <p className="text-[11px] text-center text-on-surface-variant/50">
                  {mode === "dubbing"
                    ? "Select a file"
                    : "Select a file to get started"}
                </p>
              )}

              {error && (
                <p className="text-xs text-red-500 font-medium text-center">{error}</p>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        .upload-card-scrollbar::-webkit-scrollbar { width: 4px; }
        .upload-card-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .upload-card-scrollbar::-webkit-scrollbar-thumb { background: #e0e3e5; border-radius: 10px; }
      `}</style>
    </>
  );
}

function UploadCardRoot(props: {
  basePath?: string;
  onModeChange?: (mode: "subtitles" | "dubbing") => void;
  selectedFile?: File | null;
  onSelectedFileChange?: (file: File | null) => void;
}) {
  return (
    <Suspense fallback={<UploadCardFallback />}>
      <UploadCardInner {...props} />
    </Suspense>
  );
}

/** Client-only: avoids SSR/hydration mismatches from `useSearchParams` + async language lists. */
export default dynamic(() => Promise.resolve({ default: UploadCardRoot }), {
  ssr: false,
  loading: () => <UploadCardFallback />,
});

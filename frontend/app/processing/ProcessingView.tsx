"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";

// SVG circle: r=74 → circumference = 2π×74 ≈ 465
const CIRCUMFERENCE = 465;

const STEPS = [
  { id: "analyze",   label: "Analyzing Audio" },
  { id: "generate",  label: "Generating Subtitles" },
  { id: "align",     label: "Aligning Timestamps" },
];

const PREVIEW_LINES = [
  "… exploring how AI transforms the way we communicate across borders …",
  "… creating new opportunities for global collaboration in real time …",
  "… the technology listens, understands, and renders every word faithfully …",
  "… precision transcription that respects the nuance of human speech …",
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProcessingView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const fileName = searchParams.get("name") ?? "your-file";
  const fileSize = Number(searchParams.get("size") ?? 0);

  const [progress, setProgress] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress simulation — ramps up realistically then slows near completion.
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 100;
        }
        // Fast early, slow near end
        const step = prev < 60 ? 0.8 : prev < 85 ? 0.4 : 0.15;
        return Math.min(prev + step, 100);
      });
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Rotate preview quote every 4 s with a fade
  useEffect(() => {
    const id = setInterval(() => {
      setPreviewVisible(false);
      setTimeout(() => {
        setPreviewIdx((i) => (i + 1) % PREVIEW_LINES.length);
        setPreviewVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Navigate to export page when done
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(
        () => router.push(`/export?name=${encodeURIComponent(fileName)}`),
        1500
      );
      return () => clearTimeout(t);
    }
  }, [progress, router, fileName]);

  // Derive current step from progress
  const currentStep =
    progress < 30 ? 0 : progress < 80 ? 1 : 2;

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress / 100);
  const estimatedMins = Math.max(0, Math.round((100 - progress) / 100 * 5));

  return (
    <div
      className="min-h-screen bg-surface font-body text-on-surface antialiased"
      style={{
        background:
          "radial-gradient(circle at 30% 40%, rgba(83,74,217,0.04) 0%, transparent 60%)",
      }}
    >


      <AppNavbar subtitle="Zen Mode" showUserActions={false} />

      <main className="pt-32 pb-20 px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">

          {/* ── Left panel ── */}
          <div className="lg:col-span-5 space-y-14 py-4">

            {/* Header */}
            <div className="space-y-3">
              <h1 className="font-headline text-h2 font-extrabold tracking-tight text-on-surface">
                Zen Mode
              </h1>
              <p className="text-on-surface-variant text-body-lg leading-relaxed max-w-md">
                Sit back and relax. We&apos;re meticulously crafting your subtitles
                with high-precision AI.
              </p>
            </div>

            {/* Progress circle + file info */}
            <div className="flex items-center gap-10">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="72" cy="72" r="62"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-surface-container"
                  />
                  <circle
                    cx="72" cy="72" r="62"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 62}`}
                    strokeDashoffset={`${2 * Math.PI * 62 * (1 - progress / 100)}`}
                    className="text-primary transition-all duration-500 ease-in-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-headline text-3xl font-extrabold text-primary leading-none">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <span className="text-xs font-bold uppercase tracking-widest text-primary/60">
                  Processing File
                </span>
                <h2
                  className="font-headline text-h4 font-bold text-on-surface truncate max-w-[220px]"
                  title={fileName}
                >
                  {fileName}
                </h2>
                {fileSize > 0 && (
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">draft</span>
                    <span className="text-sm">{formatBytes(fileSize)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Steps timeline */}
            <div className="space-y-5 pl-2 border-l-2 border-surface-container ml-[68px]">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={step.id} className="flex items-center gap-4 -ml-[13px]">
                    <div
                      className={[
                        "w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-surface transition-all duration-300",
                        done
                          ? "bg-primary"
                          : active
                          ? "bg-white border-2 border-primary"
                          : "bg-white border-2 border-outline-variant opacity-30",
                      ].join(" ")}
                    >
                      {done && (
                        <span className="material-symbols-outlined text-white text-[14px]">
                          check
                        </span>
                      )}
                      {active && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      )}
                    </div>
                    <span
                      className={[
                        "text-sm font-semibold transition-colors",
                        done
                          ? "text-on-surface"
                          : active
                          ? "text-primary font-bold"
                          : "text-on-surface-variant opacity-40",
                      ].join(" ")}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footnote */}
            <div className="pt-6 border-t border-surface-container-highest/50">
              <div className="flex items-start gap-3 text-on-surface-variant/70">
                <span className="material-symbols-outlined text-xl mt-0.5">auto_awesome</span>
                <p className="text-xs leading-relaxed italic">
                  Our neural engine is working in the background to ensure every word
                  is captured perfectly. Notifications are silenced to keep your
                  workspace calm.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="relative bg-white/40 rounded-3xl p-12 lg:p-16 border border-white/60 shadow-2xl shadow-indigo-100/50 min-h-[460px] flex flex-col items-center justify-center text-center overflow-hidden">

              {/* Background glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full" />
              </div>

              <div className="relative z-10 space-y-10 max-w-md w-full">

                {/* Live badge */}
                <div className="flex justify-center">
                  <div className="px-5 py-2 rounded-full bg-secondary/10 border border-secondary/20 flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full bg-secondary"
                      style={{ animation: "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite" }}
                    />
                    <span className="text-xs font-bold tracking-widest uppercase text-secondary">
                      Live Processing
                    </span>
                  </div>
                </div>

                {/* Animated headline */}
                <div className="space-y-6">
                  <h3
                    className="font-headline text-h4 font-bold text-on-surface"
                    style={{ animation: "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite" }}
                  >
                    {progress >= 100 ? "Transcription complete!" : "Transcription in progress…"}
                  </h3>

                  {/* Rotating preview quote */}
                  <div
                    className="min-h-12 transition-opacity duration-400"
                    style={{ opacity: previewVisible ? 0.25 : 0 }}
                  >
                    <p className="text-sm font-medium leading-relaxed italic text-on-surface-variant line-clamp-2">
                      &ldquo;{PREVIEW_LINES[previewIdx]}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-[280px] mx-auto h-1 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-in-out"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(to right, var(--color-primary), var(--color-secondary))",
                    }}
                  />
                </div>

                {/* ETA */}
                <p className="text-xs font-medium text-outline uppercase tracking-[0.2em]">
                  {progress >= 100
                    ? "Done — redirecting…"
                    : estimatedMins > 0
                    ? `Estimated time remaining: ${estimatedMins} min${estimatedMins !== 1 ? "s" : ""}`
                    : "Almost there…"}
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { getPendingFile, setPendingFile } from "@/utils/fileStore";
import axios from "axios";
import axiosInstance from "@/utils/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SSEEvent {
  stage:
  | "validating"
  | "extracting"
  | "uploading"
  | "transcribing"
  | "transliterating"
  | "saving"
  | "done"
  | "error";
  message: string;
  progress?: number;
  job?: { _id: string };
  creditsRemaining?: number;
  statusCode?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_PROGRESS: Record<string, number> = {
  validating: 5,
  extracting: 15,
  uploading: 25,
  transcribing: 30,
  transliterating: 88,
  saving: 94,
  done: 100,
};

const STEPS = [
  { id: "analyze", label: "Analyzing Audio" },
  { id: "generate", label: "Generating Subtitles" },
  { id: "align", label: "Aligning Timestamps" },
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProcessingView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const fileName = searchParams.get("name") ?? "your-file";
  const fileSize = Number(searchParams.get("size") ?? 0);

  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("Preparing…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(true);

  const abortRef = useRef<AbortController | null>(null);

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

  // Main effect: stream the SSE response from the backend via axios
  useEffect(() => {
    // Guard against React StrictMode double-invocation in dev:
    // we only want one in-flight request at a time.
    let cancelled = false;

    const file = getPendingFile();

    if (!file) {
      router.replace("/");
      return;
    }

    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.replace("/");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const body = new FormData();
    body.append("file", file);

    // Tracks how far into the accumulated responseText we have already parsed
    let parsedUpTo = 0;

    const handleSSEText = (raw: string) => {
      if (cancelled) return;
      const newText = raw.slice(parsedUpTo);
      parsedUpTo = raw.length;

      const frames = newText.split("\n\n");
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;

        let event: SSEEvent;
        try {
          event = JSON.parse(line.slice(5).trim()) as SSEEvent;
        } catch {
          continue;
        }

        if (event.stage === "error") {
          setErrorMsg(event.message ?? "An error occurred.");
          setStageLabel("Error");
          return;
        }

        if (event.stage === "transcribing" && typeof event.progress === "number") {
          setProgress(30 + Math.round((event.progress / 100) * 55));
        } else {
          setProgress(STAGE_PROGRESS[event.stage] ?? 0);
        }

        setStageLabel(event.message ?? "");

        if (event.stage === "done" && event.job) {
          setPendingFile(null);
          setTimeout(() => {
            router.push(`/export?jobId=${event.job!._id}`);
          }, 1200);
        }
      }
    };

    axiosInstance
      .post<string>("/api/subtitles/generate", body, {
        responseType: "text",
        signal: controller.signal,
        // Clear the instance-level "application/json" default so the browser
        // can set "multipart/form-data; boundary=..." automatically for FormData.
        headers: { "Content-Type": undefined },
        onDownloadProgress: (progressEvent) => {
          if (cancelled) return;
          const responseText =
            (progressEvent.event?.target as XMLHttpRequest | undefined)?.responseText ?? "";
          handleSSEText(responseText);
        },
      })
      .catch((err) => {
        if (cancelled || axios.isCancel(err) || err?.code === "ERR_CANCELED") return;
        const msg: string =
          err?.response?.data?.message ?? err?.message ?? "Unexpected error.";
        setErrorMsg(msg);
        setStageLabel("Error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router]);

  // Derive current step from progress
  const currentStep = progress < 30 ? 0 : progress < 80 ? 1 : 2;
  const estimatedMins = Math.max(0, Math.round(((100 - progress) / 100) * 5));

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
                {errorMsg
                  ? "Something went wrong. Please try again."
                  : "Sit back and relax. We're meticulously crafting your subtitles with high-precision AI."}
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
                    className={`transition-all duration-500 ease-in-out ${errorMsg ? "text-red-400" : "text-primary"}`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={`font-headline text-3xl font-extrabold leading-none ${errorMsg ? "text-red-400" : "text-primary"}`}>
                    {errorMsg ? "!" : `${Math.round(progress)}%`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <span className="text-xs font-bold uppercase tracking-widest text-primary/60">
                  {errorMsg ? "Error" : "Processing File"}
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

            {/* Error message */}
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium space-y-3">
                <p>{errorMsg}</p>
                <button
                  onClick={() => router.push("/")}
                  className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  ← Back to home
                </button>
              </div>
            )}

            {/* Steps timeline */}
            {!errorMsg && (
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
            )}

            {/* Footnote */}
            {!errorMsg && (
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
            )}
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
                      {errorMsg ? "Failed" : "Live Processing"}
                    </span>
                  </div>
                </div>

                {/* Stage label / headline */}
                <div className="space-y-6">
                  <h3
                    className="font-headline text-h4 font-bold text-on-surface"
                    style={{ animation: "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite" }}
                  >
                    {errorMsg
                      ? "Transcription failed"
                      : progress >= 100
                        ? "Transcription complete!"
                        : "Transcription in progress…"}
                  </h3>

                  {/* Stage description */}
                  <p className="text-sm font-medium text-on-surface-variant">{stageLabel}</p>

                  {/* Rotating preview quote */}
                  {!errorMsg && (
                    <div
                      className="min-h-12 transition-opacity duration-400"
                      style={{ opacity: previewVisible ? 0.25 : 0 }}
                    >
                      <p className="text-sm font-medium leading-relaxed italic text-on-surface-variant line-clamp-2">
                        &ldquo;{PREVIEW_LINES[previewIdx]}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {!errorMsg && (
                  <div className="w-full max-w-[280px] mx-auto h-1 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-in-out"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(to right, var(--color-primary), var(--color-secondary))",
                      }}
                    />
                  </div>
                )}

                {/* ETA / error action */}
                {errorMsg ? (
                  <button
                    onClick={() => router.push("/")}
                    className="mt-4 px-6 py-2.5 bg-on-surface text-white text-sm font-headline font-bold rounded-full hover:bg-on-surface/90 transition-colors"
                  >
                    Try Again
                  </button>
                ) : (
                  <p className="text-xs font-medium text-outline uppercase tracking-[0.2em]">
                    {progress >= 100
                      ? "Done — redirecting…"
                      : estimatedMins > 0
                        ? `Estimated time remaining: ${estimatedMins} min${estimatedMins !== 1 ? "s" : ""}`
                        : "Almost there…"}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

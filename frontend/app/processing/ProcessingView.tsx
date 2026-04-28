"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import {
  getPendingFile,
  setPendingFile,
  getPendingLanguage,
  getPendingMode,
  getPendingSourceLanguage,
  getPendingTargetLanguage,
  getPendingYoutubeUrl,
} from "@/utils/fileStore";
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
  | "separating"
  | "translating"
  | "generating"
  | "syncing"
  | "merging"
  | "lipsync"
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
  separating: 28,
  translating: 40,
  generating: 55,
  syncing: 72,
  merging: 88,
  lipsync: 92,
  saving: 94,
  done: 100,
};

const SUBTITLE_STEPS = [
  { id: "analyze", label: "Analyzing Audio" },
  { id: "generate", label: "Generating Subtitles" },
  { id: "align", label: "Aligning Timestamps" },
];

const DUBBING_STEPS = [
  { id: "extract", label: "Extracting & Separating" },
  { id: "translate", label: "Translating & Generating Voice" },
  { id: "merge", label: "Syncing & Building Output" },
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

/** Browser PUT to S3 using a presigned URL (must match signed Content-Type). */
function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) onProgress(evt.loaded, evt.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during S3 upload"));
    xhr.send(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProcessingView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inDashboard = pathname.startsWith("/dashboard");

  const fileName = searchParams.get("name") ?? "your-file";
  const fileSize = Number(searchParams.get("size") ?? 0);

  const [progress, setProgress] = useState(0);
  // Smoothly animated progress value for UI rendering (avoids jerky jumps / lag).
  const [displayProgress, setDisplayProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("Preparing…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(true);

  const abortRef = useRef<AbortController | null>(null);

  const homeHref = inDashboard ? "/dashboard" : "/";
  const exportBase = inDashboard ? "/dashboard" : "";
  const mode = getPendingMode();
  const steps = mode === "dubbing" ? DUBBING_STEPS : SUBTITLE_STEPS;

  // Smooth catch-up animation: move displayProgress toward progress at a steady rate,
  // so UI feels responsive without falling behind.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;

      setDisplayProgress((cur) => {
        const target = Math.max(0, Math.min(100, progress));
        if (cur === target) return cur;

        const diff = target - cur;
        const dir = Math.sign(diff);

        // Base speed: % per second. Add a boost when we're far behind.
        const baseSpeed = 70; // %/sec
        const boostSpeed = 140; // %/sec when diff is large
        const useSpeed = Math.abs(diff) > 15 ? boostSpeed : baseSpeed;

        const step = useSpeed * dtSec;
        const next = Math.abs(diff) <= step ? target : cur + dir * step;
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

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
    let cancelled = false;

    const file = getPendingFile();
    const youtubeUrl = getPendingYoutubeUrl();

    if (!file && !youtubeUrl) {
      router.replace(homeHref);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const targetLanguage = getPendingTargetLanguage();
    const sourceLanguage = getPendingSourceLanguage();

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
          if (event.statusCode === 402) {
            setOutOfCredits(true);
          }
          setErrorMsg(event.message ?? "An error occurred.");
          setStageLabel("Error");
          return;
        }

        // Never allow UI progress to go backwards (e.g. upload (25) → extracting (15)).
        setProgress((prev) => {
          let nextProgress: number;

          if (event.stage === "transcribing" && typeof event.progress === "number") {
            // `transcribing.progress` is a 0–100 sub-progress (not overall).
            // Grow from current progress so we don't instantly jump to a fixed baseline.
            const upper =
              mode === "dubbing"
                ? 55 // dubbing: transcription is earlier portion
                : 85; // subtitles: transcription covers most of the work
            const base = Math.max(prev, STAGE_PROGRESS.transcribing ?? 0);
            const span = Math.max(0, upper - base);
            nextProgress = base + Math.round((event.progress / 100) * span);
          } else if (typeof event.progress === "number") {
            // For all other stages, if backend sends overall progress, trust it.
            nextProgress = Math.max(0, Math.min(100, Math.round(event.progress)));
          } else {
            nextProgress = STAGE_PROGRESS[event.stage] ?? 0;
          }

          if (event.stage === "error") return prev;
          return Math.max(prev, nextProgress);
        });

        setStageLabel(event.message ?? "");

        if (event.stage === "done" && event.job) {
          setPendingFile(null);
          setTimeout(() => {
            if (mode === "dubbing") {
              router.push(`${exportBase}/dubbing/export?jobId=${event.job!._id}`);
            } else {
              router.push(`${exportBase}/export?jobId=${event.job!._id}`);
            }
          }, 1200);
        }
      }
    };

    const run = async () => {
      const headers: Record<string, string> = {};
      let body: FormData | Record<string, string>;

      if (mode === "dubbing" && youtubeUrl) {
        body = { youtubeUrl, targetLanguage, sourceLanguage };
        headers["Content-Type"] = "application/json";
      } else if (file) {
        let payload: FormData | Record<string, string> | null = null;
        const preferDirectS3 =
          process.env.NEXT_PUBLIC_STORAGE_TYPE === "s3" ||
          process.env.NEXT_PUBLIC_DIRECT_S3_UPLOAD === "true";

        if (preferDirectS3) {
          try {
            const presignUrl =
              mode === "dubbing" ? "/api/dubbing/upload-url" : "/api/subtitles/upload-url";
            const pres = await axiosInstance.post<{ uploadUrl: string; key: string }>(
              presignUrl,
              {
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                byteSize: file.size,
              },
              { signal: controller.signal },
            );
            const { uploadUrl, key } = pres.data || {};
            if (uploadUrl && key) {
              if (cancelled) return;
              setStageLabel("Uploading to storage…");
              const mime = file.type || "application/octet-stream";
              await putFileToPresignedUrl(uploadUrl, file, mime, (loaded, total) => {
                if (cancelled || !total) return;
                setProgress(Math.min(12, Math.round((loaded / total) * 12)));
              });
              if (cancelled) return;
              headers["Content-Type"] = "application/json";
              if (mode === "subtitles") {
                const lang = getPendingLanguage();
                payload = {
                  s3Key: key,
                  originalFileName: file.name,
                  mimeType: mime,
                  ...(lang ? { language: lang } : {}),
                };
              } else {
                payload = {
                  s3Key: key,
                  originalFileName: file.name,
                  mimeType: mime,
                  targetLanguage,
                  ...(sourceLanguage ? { sourceLanguage } : {}),
                };
              }
            }
          } catch {
            /* presign / PUT failed — fall back to multipart through the API */
          }
        }

        if (!payload) {
          const fd = new FormData();
          fd.append("file", file);
          if (mode === "subtitles") {
            const lang = getPendingLanguage();
            if (lang) fd.append("language", lang);
          } else {
            if (targetLanguage) fd.append("targetLanguage", targetLanguage);
            if (sourceLanguage) fd.append("sourceLanguage", sourceLanguage);
          }
          payload = fd;
        }
        body = payload;
      } else {
        return;
      }

      const url =
        mode === "dubbing"
          ? youtubeUrl
            ? "/api/dubbing/start-youtube"
            : "/api/dubbing/start"
          : "/api/subtitles/generate";

      await axiosInstance.post<string>(url, body as FormData & Record<string, string>, {
        responseType: "text",
        signal: controller.signal,
        ...(Object.keys(headers).length ? { headers } : {}),
        onDownloadProgress: (progressEvent) => {
          if (cancelled) return;
          const responseText =
            (progressEvent.event?.target as XMLHttpRequest | undefined)?.responseText ?? "";
          handleSSEText(responseText);
        },
      });
    };

    run().catch((err) => {
      if (cancelled || axios.isCancel(err) || err?.code === "ERR_CANCELED") return;
      const status = err?.response?.status;
      const msg: string =
        typeof err?.response?.data === "object" && err?.response?.data !== null && "message" in err.response.data
          ? String((err.response.data as { message?: string }).message)
          : err?.response?.data != null && typeof err.response.data === "string"
            ? err.response.data
            : err?.message ?? "Unexpected error.";
      if (status === 402) {
        setOutOfCredits(true);
      }
      setErrorMsg(msg);
      setStageLabel("Error");
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive current step from progress
  const currentStep = progress < 30 ? 0 : progress < 80 ? 1 : 2;
  const estimatedMins = Math.max(0, Math.round(((100 - progress) / 100) * 5));

  const mainContent = (
    <main className={`${inDashboard ? "pt-8 pb-16" : "pt-32 pb-20"} px-8 max-w-7xl mx-auto`}>
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
                : mode === "dubbing"
                  ? "Sit back and relax. We're generating your dubbed audio with high-precision AI."
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
                  strokeDashoffset={`${2 * Math.PI * 62 * (1 - displayProgress / 100)}`}
                  className={`transition-[stroke-dashoffset] duration-200 ease-out ${errorMsg ? "text-red-400" : "text-primary"}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`font-headline text-3xl font-extrabold leading-none ${errorMsg ? "text-red-400" : "text-primary"}`}>
                  {errorMsg ? "!" : `${Math.round(displayProgress)}%`}
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

          {/* Out of credits state */}
          {outOfCredits && (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">toll</span>
              </div>
              <h3 className="font-headline font-bold text-on-surface">Out of free credits</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                You&apos;ve used all 12 free credits. Sign in to get 60 credits/month and keep transcribing.
              </p>
              <Link
                href={`/login${inDashboard ? "" : `?next=${encodeURIComponent(pathname)}`}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-headline font-bold text-sm rounded-full hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-base">login</span>
                Sign In — Get 60 Credits
              </Link>
            </div>
          )}

          {/* Generic error message */}
          {errorMsg && !outOfCredits && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium space-y-3">
              <p>{errorMsg}</p>
              <button
                onClick={() => router.push(homeHref)}
                className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Steps timeline */}
          {!errorMsg && (
            <div className="space-y-5 pl-2 border-l-2 border-surface-container ml-[68px]">
              {steps.map((step, i) => {
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
                    ? mode === "dubbing"
                      ? "Dubbing failed"
                      : "Transcription failed"
                    : progress >= 100
                      ? mode === "dubbing"
                        ? "Dubbing complete!"
                        : "Transcription complete!"
                      : mode === "dubbing"
                        ? "Dubbing in progress…"
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
                  onClick={() => router.push(homeHref)}
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
  );

  if (inDashboard) {
    return (
      <div
        className="font-body text-on-surface antialiased"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(83,74,217,0.04) 0%, transparent 60%)",
        }}
      >
        {mainContent}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-surface font-body text-on-surface antialiased"
      style={{
        background:
          "radial-gradient(circle at 30% 40%, rgba(83,74,217,0.04) 0%, transparent 60%)",
      }}
    >
      <AppNavbar subtitle="Zen Mode" showUserActions={false} />
      {mainContent}
    </div>
  );
}

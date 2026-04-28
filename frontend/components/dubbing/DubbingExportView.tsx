"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  RefreshCcw,
  Sparkles,
  History,
  Gauge,
  ShieldCheck,
  Mic,
  Subtitles,
  ListVideo,
  Volume2,
  VolumeX,
} from "lucide-react";
import axiosInstance, { s3Url } from "@/utils/axios";
import type { EditorJob } from "@/components/dubbingEditor/types";
import { fmtTimeShort } from "@/components/dubbingEditor/types";

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isProcessing = !isCompleted && !isFailed;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase border backdrop-blur-sm transition-all ${isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" :
      isFailed ? "bg-red-500/10 border-red-500/30 text-red-600" :
        "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(57,44,193,0.15)]"
      }`}>
      {isProcessing && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {status.replace('_', ' ')}
    </div>
  );
}

function ProcessingStepper({ status }: { status: string }) {
  const steps = [
    { id: "extracting", label: "Extracting" },
    { id: "separating", label: "Separating" },
    { id: "transcribing", label: "Transcribing" },
    { id: "translating", label: "Translating" },
    { id: "generating", label: "Generating" },
    { id: "merging", label: "Merging" },
  ];

  const currentIdx = steps.findIndex(s => s.id === status);
  const currentStepLabel = steps.find(s => s.id === status)?.label || status;

  return (
    <div className="w-full max-w-4xl mx-auto py-16 px-8 sm:px-12 bg-surface/40 backdrop-blur-xl border border-outline-variant/20 rounded-[2.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.03)]">
      <div className="relative flex justify-between max-w-3xl mx-auto">
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-surface-container-high -translate-y-1/2 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 ease-in-out"
            style={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%` }}
          />
        </div>

        {steps.map((step, i) => {
          const isDone = i < currentIdx || status === "completed";
          const isActive = i === currentIdx;

          return (
            <div key={step.id} className="relative flex flex-col items-center gap-4 z-10 font-headline group">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-4 transition-all duration-700 ease-out bg-surface ${isDone ? "border-primary text-primary shadow-[0_0_20px_rgba(57,44,193,0.3)] scale-105" :
                isActive ? "border-primary text-primary shadow-[0_0_30px_rgba(57,44,193,0.4)] scale-110 ring-4 ring-primary/10" :
                  "border-surface-container-high text-on-surface-variant/30"
                }`}>
                {isDone ? <CheckCircle2 size={22} className="animate-in zoom-in" /> : <span className="font-bold sm:text-lg">{i + 1}</span>}
              </div>
              <span className={`absolute -bottom-8 text-[10px] sm:text-xs font-bold tracking-widest uppercase transition-colors duration-500 whitespace-nowrap ${isDone ? "text-on-surface" : isActive ? "text-primary" : "text-on-surface-variant/40"
                }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-28 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/5 mb-8 border border-primary/10 shadow-inner">
          <RefreshCcw className="text-primary animate-[spin_4s_linear_infinite]" size={32} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface mb-4 font-headline tracking-tight">Magic in progress</h2>
        <p className="text-on-surface-variant text-base sm:text-lg max-w-lg mx-auto leading-relaxed font-body">
          Our AI is currently <span className="font-semibold text-primary">{currentStepLabel.toLowerCase()}</span> your video. This usually takes a few minutes depending on length.
        </p>
      </div>
    </div>
  );
}

function VideoPreview({ job }: { job: EditorJob }) {
  // "original" = unmuted video; "dubbed" = muted video + synced external audio
  const [useOriginal, setUseOriginal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Prefer the original video for playback (always the same visual stream).
  // Fall back to legacy dubbedVideoUrl for old jobs that have no originalVideoKey.
  const videoSrc = job.originalVideoKey
    ? s3Url(job.originalVideoKey).split("?")[0]
    : job.dubbedVideoUrl
      ? s3Url(job.dubbedVideoUrl).split("?")[0]
      : null;

  const dubbedAudioSrc = job.dubbedAudioKey
    ? s3Url(job.dubbedAudioKey).split("?")[0]
    : null;

  // Whether we're in sync mode: showing original video + external dubbed audio.
  const syncMode = !useOriginal && !!dubbedAudioSrc && !!job.originalVideoKey;

  // Keep video muted state in sync (React's `muted` attr is unreliable).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = syncMode;
  }, [syncMode]);

  // Wire video play/pause/seek events to the external audio element (dubbed mode).
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !syncMode) return;

    const onPlay = () => {
      audio.currentTime = video.currentTime;
      audio.play().catch(() => {});
    };
    const onPause = () => audio.pause();
    const onSeeked = () => { audio.currentTime = video.currentTime; };
    const onRateChange = () => { audio.playbackRate = video.playbackRate; };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ratechange", onRateChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ratechange", onRateChange);
    };
  }, [syncMode]);

  // When the user toggles modes, hand off playback smoothly.
  const handleToggle = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const next = !useOriginal;
    setUseOriginal(next);

    if (video) {
      if (next) {
        // Switching to original: unmute video, stop external audio.
        video.muted = false;
        audio?.pause();
      } else {
        // Switching to dubbed: mute video, sync external audio.
        video.muted = true;
        if (audio) {
          audio.currentTime = video.currentTime;
          if (!video.paused) audio.play().catch(() => {});
        }
      }
    }
  };

  if (!videoSrc) return null;

  const showToggle = !!job.originalVideoKey && !!dubbedAudioSrc;

  return (
    <div className="relative group aspect-video rounded-4xl overflow-hidden bg-black border border-outline-variant/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <video
        ref={videoRef}
        src={videoSrc}
        playsInline
        controls
        className="w-full h-full object-contain"
      />

      {/* External dubbed audio — synced to video via JS events */}
      {syncMode && dubbedAudioSrc && (
        <audio ref={audioRef} src={dubbedAudioSrc} preload="auto" />
      )}

      {showToggle && (
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95 shadow-lg backdrop-blur-sm ${
              useOriginal
                ? "bg-surface/90 text-on-surface hover:bg-surface"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            {useOriginal ? (
              <Volume2 size={12} className="shrink-0" />
            ) : (
              <VolumeX size={12} className="shrink-0" />
            )}
            {useOriginal ? "Original" : "Dubbed"}
          </button>
        </div>
      )}
    </div>
  );
}

function LiveTranscription({ job }: { job: EditorJob }) {
  const segments = [...(job.segments ?? [])].sort((a, b) => a.start - b.start);
  const sourceLang =
    job.sourceLanguage === "auto" ? "Auto" : job.sourceLanguage || "Original";
  const targetLang = job.targetLanguage || "Dubbed";

  return (
    <div className="bg-surface rounded-[2rem] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h3 className="text-lg font-bold font-headline text-on-surface">Transcript</h3>
        <div className="bg-primary/5 text-primary text-xs font-bold px-4 py-2 rounded-full w-fit shrink-0">
          <span className="capitalize">{sourceLang}</span> (Original) →{" "}
          <span className="capitalize">{targetLang}</span> (Dubbed)
        </div>
      </div>
      {segments.length === 0 ? (
        <p className="text-on-surface-variant text-sm leading-relaxed">
          No segments on this job yet. They appear here after transcription and translation finish.
        </p>
      ) : (
        <div className="space-y-6 max-h-[min(60vh,520px)] overflow-y-auto pr-2 custom-scrollbar">
          {segments.map((seg, idx) => {
            const original = (seg.originalText ?? "").trim();
            const translated = (seg.translatedText ?? "").trim();
            const translatedDisplay = translated.replace(/\[[^\]]*]/g, "").trim();
            const key = seg.segmentId || `seg-${seg.start}-${seg.end}-${idx}`;

            return (
              <div
                key={key}
                className="space-y-3 pb-6 border-b border-outline-variant/10 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold tracking-widest uppercase text-on-surface-variant/70 font-label">
                  <span className="tabular-nums">
                    {fmtTimeShort(seg.start)} — {fmtTimeShort(seg.end)}
                  </span>
                  {seg.speaker_id ? (
                    <>
                      <span className="text-on-surface-variant/30">·</span>
                      <span>Speaker {seg.speaker_id}</span>
                    </>
                  ) : null}
                </div>
                <p className="font-semibold text-on-surface-variant italic leading-relaxed text-base">
                  {original || "—"}
                </p>
                <p className="font-bold text-primary leading-relaxed text-base">
                  {translatedDisplay || "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      <div className="bg-surface rounded-3xl p-6 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
          <History size={20} />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-widest text-on-surface-variant/50 uppercase mb-0.5">Last Render</div>
          <div className="font-bold text-on-surface text-sm">2 minutes ago</div>
        </div>
      </div>
      <div className="bg-surface rounded-3xl p-6 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
          <Gauge size={20} />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-widest text-on-surface-variant/50 uppercase mb-0.5">Processing</div>
          <div className="font-bold text-on-surface text-sm">Ultra Fast (2.4x)</div>
        </div>
      </div>
      <div className="bg-surface rounded-3xl p-6 flex items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10">
        <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-widest text-on-surface-variant/50 uppercase mb-0.5">Security</div>
          <div className="font-bold text-on-surface text-sm">Encrypted Export</div>
        </div>
      </div>
    </div>
  );
}

function DownloadPanel({ job }: { job: EditorJob }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (url: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloading(null);
    }
  };

  const dubbedAudioUrl = job.dubbedAudioKey ? s3Url(job.dubbedAudioKey) : null;
  const originalVideoUrl = job.originalVideoKey ? s3Url(job.originalVideoKey) : null;
  // Legacy: old jobs that already have a server-muxed dubbed video.
  const legacyDubbedVideoUrl = job.dubbedVideoUrl ? s3Url(job.dubbedVideoUrl) : null;

  const baseName = job.originalFileName.replace(/\.[^/.]+$/, "");

  return (
    <div className="flex flex-col gap-4">
      {/* Primary: dubbed audio */}
      <button
        onClick={() =>
          dubbedAudioUrl &&
          handleDownload(dubbedAudioUrl, `${baseName}_dubbed.mp3`, "audio")
        }
        disabled={!dubbedAudioUrl || downloading === "audio"}
        className="group relative w-full h-14 rounded-full bg-primary flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(57,44,193,0.3)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000" />
        {downloading === "audio" ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Mic size={20} className="text-white" />
        )}
        <span className="text-base font-bold text-white tracking-tight font-headline">
          {downloading === "audio" ? "Downloading…" : "Download Dubbed Audio"}
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {/* Original video download */}
        {originalVideoUrl && (
          <button
            onClick={() =>
              handleDownload(
                originalVideoUrl,
                `${baseName}_original${job.fileType === "video" ? ".mp4" : ".mp3"}`,
                "origvid",
              )
            }
            disabled={downloading === "origvid"}
            className="group flex items-center justify-center gap-2 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-bold hover:bg-surface-container-low transition-all duration-300 disabled:opacity-50"
          >
            {downloading === "origvid" ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Download size={16} className="text-on-surface-variant" />
            )}
            <span>Original Video</span>
          </button>
        )}

        {/* Legacy: server-muxed dubbed video (old jobs) */}
        {legacyDubbedVideoUrl && (
          <button
            onClick={() =>
              handleDownload(legacyDubbedVideoUrl, `${baseName}_dubbed.mp4`, "vid")
            }
            disabled={downloading === "vid"}
            className="group flex items-center justify-center gap-2 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm font-bold hover:bg-surface-container-low transition-all duration-300 disabled:opacity-50"
          >
            {downloading === "vid" ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Download size={16} className="text-on-surface-variant" />
            )}
            <span>Dubbed Video</span>
          </button>
        )}

        {/* Subtitles — coming soon */}
        {!legacyDubbedVideoUrl && (
          <button
            disabled
            className="flex items-center justify-center gap-2 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant text-sm font-bold cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            <Subtitles size={16} />
            <span>Subtitles</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function DubbingExportView({ inDashboard = false }: { inDashboard?: boolean }) {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || searchParams.get("jobid");

  const [job, setJob] = useState<EditorJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await axiosInstance.get<{ job: EditorJob }>(`/api/dubbing/${jobId}`);
      setJob(res.data.job);
      if (loading) setLoading(false);
      return ["completed", "failed"].includes(res.data.job.status);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to fetch job.";
      setErrorMsg(msg);
      setLoading(false);
      return true;
    }
  }, [jobId, loading]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number;

    const poll = async () => {
      const shouldStop = await fetchJob();
      if (!shouldStop && isMounted) {
        timeoutId = window.setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [jobId, fetchJob]);

  if (!jobId) {
    return (
      <div
        className={`flex items-center justify-center p-6 text-on-surface bg-background ${
          inDashboard ? "h-[calc(100vh-100px)] rounded-3xl" : "h-screen"
        }`}
      >
        <div className="max-w-md w-full text-center space-y-8 bg-surface-container border border-outline-variant/20 p-12 rounded-[2rem]">
          <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-headline">Missing job ID</h1>
            <p className="text-on-surface-variant text-sm leading-relaxed font-body">
              Please open this page with a valid <span className="font-semibold">jobId</span>.
            </p>
          </div>
          <Link
            href={inDashboard ? "/dashboard" : "/"}
            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-on-primary font-bold hover:brightness-110 transition-all active:scale-95"
          >
            <RefreshCcw size={18} />
            <span>Go Back</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-background ${inDashboard ? "h-[calc(100vh-100px)] rounded-3xl" : "h-screen"}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium text-on-surface-variant tracking-widest uppercase font-label">Loading Result</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !job) {
    return (
      <div className={`flex items-center justify-center p-6 text-on-surface bg-background ${inDashboard ? "h-[calc(100vh-100px)] rounded-3xl" : "h-screen"}`}>
        <div className="max-w-md w-full text-center space-y-8 bg-surface-container border border-outline-variant/20 p-12 rounded-[2rem]">
          <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-headline">Something went wrong</h1>
            <p className="text-on-surface-variant text-sm leading-relaxed font-body">{errorMsg || "We couldn't process your video this time."}</p>
          </div>
          <Link
            href={inDashboard ? "/dashboard" : "/"}
            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-on-primary font-bold hover:brightness-110 transition-all active:scale-95"
          >
            <RefreshCcw size={18} />
            <span>Try Again</span>
          </Link>
        </div>
      </div>
    );
  }

  const isProcessing = !["completed", "failed"].includes(job.status);
  const isFailed = job.status === "failed";

  return (
    <div className={`relative min-h-screen bg-surface-container-lowest text-on-surface selection:bg-primary/20 overflow-hidden ${inDashboard ? "p-4 sm:p-8 rounded-3xl" : "pt-32 pb-20 px-6 sm:px-12"}`}>
      {/* Premium ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {!inDashboard && (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-outline-variant/20 glass-nav z-50 px-8 transition-all duration-300">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface border border-transparent hover:border-outline-variant/30">
                <ChevronRight className="rotate-180" />
              </Link>
              <div className="h-6 w-px bg-outline-variant/30" />
              <div className="flex flex-col">
                <h1 className="font-bold tracking-tight truncate max-w-[200px] sm:max-w-md text-on-surface font-headline">
                  {job.originalFileName}
                </h1>
                <div className="mt-0.5">
                  <StatusBadge status={job.status} />
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10 z-10">
        <div className="space-y-0">
          {isProcessing ? (
            <div className="min-h-[500px] flex items-center justify-center">
              <ProcessingStepper status={job.status} />
            </div>
          ) : isFailed ? (
            <div className="bg-red-500/5 border border-red-500/20 rounded-[2.5rem] p-16 text-center space-y-8 backdrop-blur-sm">
              <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center shadow-inner">
                <AlertCircle className="text-red-500" size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold font-headline text-on-surface">Dubbing Failed</h3>
                <p className="text-on-surface-variant max-w-md mx-auto font-body text-lg">{job.error || "A technical error occurred during the sync phase."}</p>
              </div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-primary font-bold hover:underline font-label bg-primary/5 px-6 py-3 rounded-full hover:bg-primary/10 transition-colors">
                Go back to Dashboard <ExternalLink size={16} />
              </Link>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-700 w-full">
              <VideoPreview job={job} />
              <LiveTranscription job={job} />
              <StatCards />
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className={`transition-all duration-700 ${isProcessing ? "opacity-30 pointer-events-none scale-95 blur-sm" : "opacity-100"}`}>
            <div className={`bg-surface p-8 overflow-hidden rounded-[2.5rem] space-y-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10 transition-shadow duration-500 ${!inDashboard && "sticky top-32"}`}>
              <div className="space-y-3 relative " >
                <h3 className="text-2xl font-bold tracking-tight text-on-surface font-headline flex items-center gap-2">
                  Ready to launch
                </h3>
                <Sparkles className="absolute -top-4 -right-2 text-primary/20 rotate-12 scale-250" size={40} />
                {/* <Sparkles className="absolute top-4 right-6 text-primary/20 scale-75" size={24} /> */}
                <p className="text-on-surface-variant text-sm leading-relaxed font-body pr-8">Your dubbing project is polished. We&apos;ve optimized the high-quality audio mix and synced the subtitles with frame-perfect precision.</p>
              </div>

              <DownloadPanel job={job} />
            </div>
          </div>

          {!isProcessing && !isFailed && (
            <>
              <div className="bg-surface p-6 rounded-4xl space-y-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant text-sm font-bold">Credits Spent</span>
                  <span className="font-bold text-on-surface text-sm">{job.duration ? Math.ceil(job.duration / 60) * 5 : 10} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant text-sm font-bold">Engine</span>
                  <span className="text-primary text-sm flex items-center gap-2 font-bold">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    AI Synced
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant text-sm font-bold">Quality</span>
                  <span className="text-[10px] font-extrabold tracking-widest text-on-surface bg-surface-container-high px-2 py-1 rounded">
                    ULTRA HD (4K)
                  </span>
                </div>
              </div>

              <div className="bg-surface p-6 rounded-[2rem] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-outline-variant/10 space-y-4 relative overflow-hidden group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                    <ListVideo size={16} />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Coming Soon</span>
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-on-surface font-headline">Word-level control</h4>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Manually adjust inflection and timing for every single word in the AI Editor.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

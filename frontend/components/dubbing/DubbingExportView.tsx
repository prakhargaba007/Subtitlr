"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Music, 
  FileText, 
  ExternalLink,
  Volume2,
  VolumeX,
  RefreshCcw,
  Clock,
  Languages,
  Users
} from "lucide-react";
import axiosInstance, { s3Url } from "@/utils/axios";
import type { EditorJob } from "@/components/dubbingEditor/types";
import { fmtTimeShort } from "@/components/dubbingEditor/types";

// --- Video.js Setup ---
import '@videojs/react/video/skin.css';
import { createPlayer, videoFeatures } from '@videojs/react';
import { VideoSkin, Video } from '@videojs/react/video';

const Player = createPlayer({ features: videoFeatures });

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isProcessing = !isCompleted && !isFailed;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
      isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
      isFailed ? "bg-red-500/10 border-red-500/20 text-red-400" :
      "bg-primary/10 border-primary/20 text-primary animate-pulse"
    }`}>
      {isProcessing && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
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
  
  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-6">
      <div className="relative flex justify-between">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-outline-variant/20 -translate-y-1/2" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-700 -translate-y-1/2" 
          style={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%` }}
        />

        {steps.map((step, i) => {
          const isDone = i < currentIdx || status === "completed";
          const isActive = i === currentIdx;
          
          return (
            <div key={step.id} className="relative flex flex-col items-center gap-3 z-10 font-headline">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                isDone ? "bg-primary border-primary text-on-primary" :
                isActive ? "bg-surface border-primary text-primary shadow-[0_0_15px_rgba(57,44,193,0.1)]" :
                "bg-surface border-outline-variant/30 text-on-surface/20"
              }`}>
                {isDone ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-[10px] font-bold tracking-wider uppercase ${
                isDone ? "text-on-surface" : isActive ? "text-primary" : "text-on-surface/20"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="mt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h2 className="text-2xl font-bold text-on-surface mb-2 font-headline">Magic in progress...</h2>
        <p className="text-on-surface-variant text-sm max-w-sm mx-auto leading-relaxed font-body">
          Our AI is currently {status.replace('_', ' ')} your video. This usually takes a few minutes depending on length.
        </p>
      </div>
    </div>
  );
}

function VideoPreview({ job }: { job: EditorJob }) {
  const [useOriginal, setUseOriginal] = useState(false);
  const rawVideoSrc = useOriginal ? s3Url(job.originalVideoKey || "") : s3Url(job.dubbedVideoUrl || "");
  const videoSrc = rawVideoSrc.split('?')[0];

  if (!videoSrc) return null;

  return (
    <div className="space-y-6">
      <div className="relative group aspect-video rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
        <Player.Provider>
          <VideoSkin>
            <Video 
              src={videoSrc} 
              playsInline 
              autoPlay 
              muted 
              className="w-full h-full object-contain"
            />
          </VideoSkin>
        </Player.Provider>
        
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={() => setUseOriginal(!useOriginal)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-sm font-medium hover:bg-black/80 transition-all active:scale-95 font-label"
          >
            {useOriginal ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-emerald-400" />}
            {useOriginal ? "Playing Original" : "Playing Dubbed"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-8 text-sm text-on-surface-variant font-body">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>{fmtTimeShort(job.duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Languages size={16} />
            <span className="capitalize">{job.sourceLanguage} ➔ {job.targetLanguage}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span>{job.speakerProfiles?.length || 0} Speakers</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/40 font-mono uppercase tracking-widest">
          <span>Job ID: {job._id.slice(-8)}</span>
        </div>
      </div>
    </div>
  );
}

function DownloadPanel({ job }: { job: EditorJob }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async (url: string, filename: string) => {
    setIsExporting(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, '_blank');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button 
        onClick={() => handleDownload(s3Url(job.dubbedVideoUrl || ""), `dubbed_${job.originalFileName}`)}
        disabled={isExporting}
        className="group relative w-full h-16 rounded-2xl bg-primary flex items-center justify-center gap-3 overflow-hidden transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        <Download size={22} className="text-white group-hover:scale-110 transition-transform" />
        <span className="text-lg font-bold text-white tracking-tight font-headline">Download Video</span>
      </button>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => handleDownload(s3Url(job.dubbedAudioUrl || ""), `audio_${job.originalFileName.replace(/\.[^/.]+$/, ".mp3")}`)}
          className="flex items-center justify-center gap-2 h-12 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant text-sm font-semibold hover:bg-surface-container-high transition-all hover:text-on-surface"
        >
          <Music size={16} />
          <span>Audio Mix</span>
        </button>
        <button 
          className="flex items-center justify-center gap-2 h-12 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface/20 text-sm font-semibold cursor-not-allowed opacity-50"
          title="Coming soon"
        >
          <FileText size={16} />
          <span>Subtitles</span>
        </button>
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
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to fetch job.";
      setErrorMsg(msg);
      setLoading(false);
      return true;
    }
  }, [jobId, loading]);

  useEffect(() => {
    if (!jobId) {
      setErrorMsg("Missing job identification.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

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
    <div className={`min-h-screen bg-background text-on-surface selection:bg-primary/10 ${inDashboard ? "p-4 sm:p-8 rounded-3xl" : "pt-32 pb-20 px-6 sm:px-12"}`}>
      {!inDashboard && (
        <header className="fixed top-0 left-0 right-0 h-20 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl z-50 px-8">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-surface-container-high rounded-xl transition-colors text-on-surface">
                <ChevronRight className="rotate-180" />
              </Link>
              <div className="h-4 w-px bg-outline-variant/30" />
              <div className="flex flex-col">
                <h1 className="font-bold tracking-tight truncate max-w-[200px] sm:max-w-md text-on-surface">
                  {job.originalFileName}
                </h1>
                <StatusBadge status={job.status} />
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12">
        <div className="space-y-12">
          {isProcessing ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <ProcessingStepper status={job.status} />
            </div>
          ) : isFailed ? (
              <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-12 text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline text-on-surface">Dubbing Failed</h3>
                  <p className="text-on-surface-variant max-w-md mx-auto font-body">{job.error || "A technical error occurred during the sync phase."}</p>
                </div>
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-primary font-bold hover:underline font-label">
                  Go back to Dashboard <ExternalLink size={14} />
                </Link>
              </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-700">
              <VideoPreview job={job} />
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className={`transition-all duration-700 ${isProcessing ? "opacity-30 pointer-events-none scale-95 blur-sm" : "opacity-100"}`}>
            <div className={`bg-surface-container-low border border-outline-variant/20 p-8 rounded-[2.5rem] space-y-8 shadow-sm ${!inDashboard && "sticky top-32"}`}>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-on-surface font-headline">Ready to launch</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed font-body">Your dubbed video is ready. You can download the full video, high-quality audio mix, or share it directly.</p>
              </div>

              <DownloadPanel job={job} />

              <div className="pt-4 border-t border-outline-variant/10 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant/40 uppercase tracking-widest font-bold font-label">Project Details</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant text-sm font-body">Credits Spent</span>
                    <span className="font-mono text-on-surface font-bold">{job.duration ? Math.ceil(job.duration / 60) * 5 : 0} pts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant text-sm font-body">Engine</span>
                    <span className="text-on-surface text-sm flex items-center gap-1.5 capitalize font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      AI Synced
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {!isProcessing && !isFailed && (
            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-on-surface-variant leading-relaxed italic font-body">
                Need to tweak a word? The AI Editor is coming soon to give you word-level control over your dubs.
              </p>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

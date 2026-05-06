"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Subtitles,
} from "lucide-react";
import type { DubbingSegment, EditorJob } from "@/components/dubbingEditor/types";
import { s3Url } from "@/utils/axios";

// ─── constants ────────────────────────────────────────────────────────────────
const DRIFT_THRESHOLD = 0.08;
const CONTROLS_HIDE_MS = 3000;

type SubtitleMode = "off" | "dubbed" | "original";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getActiveSeg(
  segments: DubbingSegment[],
  t: number,
): DubbingSegment | null {
  for (const seg of segments) {
    if (t >= seg.start && t <= seg.end) return seg;
  }
  return null;
}

function nextSubtitleMode(cur: SubtitleMode): SubtitleMode {
  if (cur === "off") return "dubbed";
  if (cur === "dubbed") return "original";
  return "off";
}

const SUBTITLE_MODE_LABEL: Record<SubtitleMode, string> = {
  off: "CC off",
  dubbed: "Dubbed",
  original: "Original",
};

// ─── component ────────────────────────────────────────────────────────────────

export default function DubbingVideoPlayer({ job }: { job: EditorJob }) {
  // ── audio mode ────────────────────────────────────────────────────────────
  const [useOriginal, setUseOriginal] = useState(false);

  // ── subtitle mode ─────────────────────────────────────────────────────────
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>("dubbed");

  // ── playback state ────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  // ── controls visibility ───────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── play-flash ────────────────────────────────────────────────────────────
  const [flashKey, setFlashKey] = useState(0);
  const [flashIcon, setFlashIcon] = useState<"play" | "pause">("play");

  // ── refs ──────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const syncModeRef = useRef(false);

  // ── sources ───────────────────────────────────────────────────────────────
  const videoSrc = job.originalVideoKey
    ? s3Url(job.originalVideoKey).split("?")[0]
    : job.dubbedVideoUrl
      ? s3Url(job.dubbedVideoUrl).split("?")[0]
      : null;

  const dubbedAudioSrc = job.dubbedAudioKey
    ? s3Url(job.dubbedAudioKey).split("?")[0]
    : null;

  const syncMode = !useOriginal && !!dubbedAudioSrc && !!job.originalVideoKey;
  syncModeRef.current = syncMode;

  const segments = job.segments ?? [];
  const hasSubtitles = segments.length > 0;

  // ── active subtitle ───────────────────────────────────────────────────────
  const activeSeg =
    subtitleMode !== "off" && hasSubtitles
      ? getActiveSeg(segments, currentTime)
      : null;

  const subtitleText = activeSeg
    ? subtitleMode === "dubbed"
      ? (activeSeg.translatedText ?? activeSeg.originalText ?? "")
      : (activeSeg.originalText ?? activeSeg.translatedText ?? "")
    : "";

  // clean bracket tags from TTS
  const subtitleDisplay = subtitleText.replace(/\[[^\]]*]/g, "").trim();

  // ── controls auto-hide ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_MS,
    );
  }, []);

  const keepControlsVisible = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!playing) keepControlsVisible();
  }, [playing, keepControlsVisible]);

  // ── silence video track ───────────────────────────────────────────────────
  const silenceVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.volume = 0;
  }, []);

  // ── drift-correction loop ─────────────────────────────────────────────────
  const stopDriftLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startDriftLoop = useCallback(() => {
    stopDriftLoop();
    const loop = () => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (video && audio && syncModeRef.current) {
        const delta = audio.currentTime - video.currentTime;
        if (Math.abs(delta) > DRIFT_THRESHOLD) {
          audio.currentTime = video.currentTime;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [stopDriftLoop]);

  // ── DOM event wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // track buffered end
      if (video.buffered.length > 0) {
        setBufferedEnd(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onEnded = () => { setPlaying(false); stopDriftLoop(); };
    const onCanPlay = () => setBuffering(false);
    const onSeeking = () => { seekingRef.current = true; };

    const onPlaying = () => {
      setBuffering(false);
      setPlaying(true);
      if (syncModeRef.current) {
        silenceVideo();
        const audio = audioRef.current;
        if (audio) {
          if (!seekingRef.current) audio.currentTime = video.currentTime;
          audio.play().catch(() => {});
        }
        startDriftLoop();
      }
    };

    const onVideoPause = () => {
      setPlaying(false);
      stopDriftLoop();
      if (syncModeRef.current) audioRef.current?.pause();
    };

    const onVideoWaiting = () => {
      setBuffering(true);
      stopDriftLoop();
      if (syncModeRef.current) audioRef.current?.pause();
    };

    const onVideoStalled = () => {
      stopDriftLoop();
      if (syncModeRef.current) audioRef.current?.pause();
    };

    const onSeeked = () => {
      seekingRef.current = false;
      if (syncModeRef.current) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = video.currentTime;
          if (!video.paused) audio.play().catch(() => {});
        }
      }
    };

    const onRateChange = () => {
      if (syncModeRef.current && audioRef.current)
        audioRef.current.playbackRate = video.playbackRate;
    };

    const onVolumeChange = () => {
      if (syncModeRef.current) silenceVideo();
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onVideoPause);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onVideoWaiting);
    video.addEventListener("stalled", onVideoStalled);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onVideoPause);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onVideoWaiting);
      video.removeEventListener("stalled", onVideoStalled);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("volumechange", onVolumeChange);
      stopDriftLoop();
    };
  }, [silenceVideo, startDriftLoop, stopDriftLoop]);

  // ── syncMode flip ─────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    if (syncMode) {
      silenceVideo();
      if (audio) {
        audio.volume = volume;
        audio.muted = muted;
        audio.currentTime = video.currentTime;
        if (!video.paused) audio.play().catch(() => {});
      }
    } else {
      stopDriftLoop();
      audio?.pause();
      video.muted = muted;
      video.volume = volume;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMode]);

  // ── fullscreen listener ───────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (
        !wrapper.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName ?? "",
        )
      )
        return;
      const video = videoRef.current;
      if (!video) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        triggerPlayPause();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        showControls();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        video.currentTime = Math.min(duration, video.currentTime + 5);
        showControls();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setSubtitleMode((m) => nextSubtitleMode(m));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, muted, playing, showControls]);

  // ── handlers ──────────────────────────────────────────────────────────────

  const activeAudio = (): HTMLVideoElement | HTMLAudioElement | null =>
    syncModeRef.current ? audioRef.current : videoRef.current;

  const triggerPlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setFlashIcon("play");
    } else {
      video.pause();
      setFlashIcon("pause");
    }
    setFlashKey((k) => k + 1);
    showControls();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    const target = activeAudio();
    if (target) {
      target.volume = v;
      target.muted = v === 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    const target = activeAudio();
    if (target) target.muted = next;
  };

  const handleModeToggle = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const nextOriginal = !useOriginal;
    setUseOriginal(nextOriginal);
    if (!video) return;
    if (nextOriginal) {
      stopDriftLoop();
      audio?.pause();
      video.muted = muted;
      video.volume = volume;
    } else {
      silenceVideo();
      if (audio) {
        audio.volume = volume;
        audio.muted = muted;
        audio.currentTime = video.currentTime;
        if (!video.paused) audio.play().catch(() => {});
      }
    }
  };

  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  if (!videoSrc) return null;

  const showAudioToggle = !!job.originalVideoKey && !!dubbedAudioSrc;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onMouseMove={playing ? showControls : keepControlsVisible}
      onMouseLeave={() => playing && setControlsVisible(false)}
      onFocus={keepControlsVisible}
      className="relative rounded-xl overflow-hidden bg-black select-none outline-none ring-1 ring-white/5 shadow-2xl"
      style={{ aspectRatio: "16/9" }}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        src={videoSrc}
        playsInline
        className="w-full h-full object-contain"
        onClick={triggerPlayPause}
        style={{ cursor: "pointer" }}
      />

      {/* External dubbed audio */}
      {dubbedAudioSrc && (
        <audio ref={audioRef} src={dubbedAudioSrc} preload="auto" />
      )}

      {/* ── Buffering spinner ── */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* ── Play/pause flash ── */}
      {flashKey > 0 && (
        <div
          key={flashKey}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-[ping_0.35s_ease-out_forwards] ring-1 ring-white/10">
            {flashIcon === "play" ? (
              <Play size={26} className="text-white ml-1" fill="white" />
            ) : (
              <Pause size={26} className="text-white" fill="white" />
            )}
          </div>
        </div>
      )}

      {/* ── Top-left badge row ── */}
      {showAudioToggle && (
        <div
          className={`absolute top-3 left-3 z-20 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            onClick={handleModeToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95 backdrop-blur-md ring-1 ring-white/10 ${
              useOriginal
                ? "bg-black/60 text-white/80 hover:bg-black/80"
                : "bg-primary/90 text-white hover:bg-primary"
            }`}
          >
            {useOriginal ? (
              <Volume2 size={9} className="shrink-0" />
            ) : (
              <VolumeX size={9} className="shrink-0" />
            )}
            {useOriginal ? "Original" : "Dubbed"}
          </button>
        </div>
      )}

      {/* ── Subtitle overlay ── */}
      {subtitleDisplay && (
        <div
          className={`absolute inset-x-0 z-20 flex justify-center transition-all duration-150 ${
            controlsVisible ? "bottom-24" : "bottom-6"
          }`}
        >
          <span className="max-w-[82%] px-4 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white text-sm font-medium leading-snug text-center ring-1 ring-white/5 shadow-lg [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {subtitleDisplay}
          </span>
        </div>
      )}

      {/* ── Controls overlay ── */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* gradient scrim */}
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />

        <div className="relative px-3.5 pb-3 pt-10 flex flex-col gap-2">

          {/* ── Scrubber ── */}
          <div className="group/seek relative flex items-center h-5 cursor-pointer">
            {/* buffered track */}
            <div
              className="absolute left-0 h-[3px] rounded-full bg-white/20 pointer-events-none"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* total track */}
            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/10 -z-10" />
            {/* played portion */}
            <div
              className="absolute left-0 h-[3px] rounded-full bg-primary pointer-events-none transition-all group-hover/seek:h-[5px]"
              style={{ width: `${progressPct}%` }}
            />
            {/* full track grows on hover */}
            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/10 transition-all group-hover/seek:h-[5px] -z-10" />
            {/* buffered grows on hover */}
            <div
              className="absolute left-0 h-[3px] rounded-full bg-white/20 pointer-events-none transition-all group-hover/seek:h-[5px]"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* thumb */}
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity -translate-x-1/2 top-1/2 -translate-y-1/2"
              style={{ left: `${progressPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Seek"
            />
          </div>

          {/* ── Controls row ── */}
          <div className="flex items-center gap-1.5">

            {/* Play / Pause */}
            <button
              type="button"
              onClick={triggerPlayPause}
              className="w-9 h-9 flex items-center justify-center text-white hover:text-primary transition-colors shrink-0"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing
                ? <Pause size={20} fill="currentColor" />
                : <Play size={20} fill="currentColor" />}
            </button>

            {/* Volume group */}
            <div className="flex items-center gap-1 group/vol shrink-0">
              <button
                type="button"
                onClick={toggleMute}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <VolumeIcon size={17} />
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200 ease-out">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-primary cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Time */}
            <span className="text-[11px] font-mono text-white/50 tabular-nums shrink-0 ml-0.5">
              {fmt(currentTime)}
              <span className="mx-1 text-white/25">/</span>
              {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Subtitle toggle */}
            {hasSubtitles && (
              <button
                type="button"
                onClick={() => setSubtitleMode((m) => nextSubtitleMode(m))}
                className={`flex items-center gap-1 px-2 h-7 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 ${
                  subtitleMode !== "off"
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-white/50 hover:text-white/80"
                }`}
                aria-label="Toggle subtitles (C)"
                title={`Subtitles: ${SUBTITLE_MODE_LABEL[subtitleMode]} (press C)`}
              >
                <Subtitles size={14} />
                <span className="hidden sm:inline">
                  {SUBTITLE_MODE_LABEL[subtitleMode]}
                </span>
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

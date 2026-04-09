"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { useDubbingEditor } from "./DubbingEditorContext";
import type { EditorMediaRefs } from "./DubbingEditorContext";
import { fmtTimeShort } from "./types";

function DubbingStageNativeVideo({
  videoUrl,
  registerPlayer,
  registerAudio,
  getMedia,
  scrubbingRef,
  setCurrentTime,
}: {
  videoUrl: string;
  registerPlayer: (p: HTMLVideoElement | null) => void;
  registerAudio: (a: HTMLAudioElement | null) => void;
  getMedia: () => EditorMediaRefs;
  scrubbingRef: MutableRefObject<boolean>;
  setCurrentTime: (t: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useLayoutEffect(() => {
    registerAudio(null);
    const el = videoRef.current;
    if (!el) return;

    el.src = videoUrl;
    try {
      el.load();
    } catch {
      /* ignore */
    }
    registerPlayer(el);

    const onTime = () => {
      if (scrubbingRef.current) return;
      const t = el.currentTime;
      setCurrentTime(t);
      getMedia().ws?.setTime(t);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
      registerPlayer(null);
      el.removeAttribute("src");
      try {
        el.load();
      } catch {
        /* ignore */
      }
    };
  }, [videoUrl, getMedia, registerPlayer, registerAudio, scrubbingRef, setCurrentTime]);

  return (
    <div className="de-native-video-shell rounded-xl overflow-hidden bg-black w-full">
      <video
        ref={videoRef}
        className="de-native-video w-full rounded-xl bg-black"
        controls
        playsInline
        preload="auto"
      />
    </div>
  );
}

export default function CenterStage() {
  const {
    job,
    jobId,
    videoUrl,
    mixAudioUrl,
    getMedia,
    registerPlayer,
    registerAudio,
    scrubbingRef,
    setCurrentTime,
    currentTime,
    selectedId,
  } = useDubbingEditor();


  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [videoRemountKey, setVideoRemountKey] = useState(0);

  const selected = job.segments.find((s) => s.segmentId === selectedId);
  const overlayText = selected?.translatedText ?? "";

  // NavigationTiming is only meaningful in the browser; useState(initializer) runs on the server too,
  // so reload detection must run here (client-only) or remount key stays 0 forever after hydration.
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === "reload" || nav?.type === "back_forward") {
        queueMicrotask(() => setVideoRemountKey((k) => k + 1));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setVideoRemountKey((k) => k + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (job.fileType !== "audio" || !audioRef.current) return;
    const a = audioRef.current;
    const onTime = () => {
      if (scrubbingRef.current) return;
      setCurrentTime(a.currentTime);
      getMedia().ws?.setTime(a.currentTime);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("seeked", onTime);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("seeked", onTime);
    };
  }, [job.fileType, mixAudioUrl, getMedia, scrubbingRef, setCurrentTime]);

  useEffect(() => {
    if (job.fileType === "audio" && audioRef.current && mixAudioUrl) {
      audioRef.current.src = mixAudioUrl;
    }
  }, [mixAudioUrl, job.fileType]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#12141a] rounded-xl overflow-hidden shadow-xl">
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 relative">
        {job.fileType === "video" && videoUrl ? (
          <div className="w-full max-w-4xl relative">
            <DubbingStageNativeVideo
              key={`${jobId}-${videoUrl}-${videoRemountKey}`}
              videoUrl={videoUrl}
              registerPlayer={registerPlayer}
              registerAudio={registerAudio}
              getMedia={getMedia}
              scrubbingRef={scrubbingRef}
              setCurrentTime={setCurrentTime}
            />
            {overlayText && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 max-w-[90%] px-3 py-1.5 rounded-md bg-black/70 text-white text-sm text-center leading-snug pointer-events-none">
                {overlayText}
              </div>
            )}
          </div>
        ) : job.fileType === "audio" && mixAudioUrl ? (
          <div className="w-full max-w-xl space-y-4">
            <div className="rounded-xl bg-[#1e2228] border border-white/[0.08] p-8 flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-5xl text-[#6b63ff]">graphic_eq</span>
              <audio
                ref={(el) => {
                  audioRef.current = el;
                  registerAudio(el);
                }}
                className="w-full"
                controls
                src={mixAudioUrl}
              />
            </div>
            {overlayText && (
              <p className="text-center text-sm text-[#c5cad3] px-2">{overlayText}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#9aa3ad]">No preview yet. Run Export / Rebuild after editing.</p>
        )}
      </div>
    </div>
  );
}

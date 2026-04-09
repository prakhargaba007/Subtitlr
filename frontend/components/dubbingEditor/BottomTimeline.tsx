"use client";

import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useDubbingEditor } from "./DubbingEditorContext";
import axiosInstance from "@/utils/axios";
import { fmtTimeShort } from "./types";
import {
  transportCurrentTime,
  transportDuration,
  transportPause,
  transportPaused,
  transportPlay,
  transportSetCurrentTime,
} from "./videoTransport";

const SNAP_SEC = 0.05;

function snap(t: number) {
  return Math.round(t / SNAP_SEC) * SNAP_SEC;
}

type RegionsApi = {
  clearRegions: () => void;
  addRegion: (opts: Record<string, unknown>) => {
    on: (ev: string, fn: () => void) => void;
    setOptions: (o: Record<string, unknown>) => void;
    start: number;
    end: number;
  };
  getRegions: () => Array<{ id?: string; setOptions: (o: Record<string, unknown>) => void }>;
};

export default function BottomTimeline() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsApi | null>(null);
  /** Last persisted timing per segment (for undo + before drag-end) */
  const timingSnap = useRef<Record<string, { start: number; end: number }>>({});

  const {
    job,
    jobId,
    mixAudioUrl,
    selectedId,
    setSelectedId,
    refresh,
    setBusy,
    timelineZoom,
    setTimelineZoom,
    loopSelection,
    setLoopSelection,
    getMedia,
    registerWs,
    scrubbingRef,
    pushUndo,
  } = useDubbingEditor();
  // console.log("mixAudioUrl", mixAudioUrl);

  const seekMedia = useCallback(
    (t: number) => {
      const { player: p, audio: a } = getMedia();
      if (p) {
        transportSetCurrentTime(p, t);
      } else if (a) {
        a.currentTime = t;
      }
    },
    [getMedia]
  );

  // Build / rebuild waveform when mix or segment structure changes
  useEffect(() => {
    if (!containerRef.current || !mixAudioUrl || !job.segments?.length) return;

    try {
      wsRef.current?.destroy();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    regionsRef.current = null;
    registerWs(null);

    const regions = RegionsPlugin.create() as unknown as RegionsApi;
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 112,
      minPxPerSec: Math.max(8, timelineZoom),
      waveColor: "rgba(107, 99, 255, 0.35)",
      progressColor: "rgba(107, 99, 255, 0.95)",
      cursorColor: "rgba(255,255,255,0.85)",
      cursorWidth: 2,
      normalize: true,
      url: mixAudioUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [regions as any],
      dragToSeek: true,
    });
    wsRef.current = ws;
    registerWs(ws);

    const unsubInteraction = ws.on("interaction", (newTime: number) => {
      scrubbingRef.current = true;
      seekMedia(newTime);
      queueMicrotask(() => {
        scrubbingRef.current = false;
      });
    });

    ws.on("ready", () => {
      try {
        ws.zoom(Math.max(8, timelineZoom));
      } catch {
        /* ignore */
      }
      regions.clearRegions();
      for (const seg of job.segments) {
        timingSnap.current[seg.segmentId] = { start: seg.start, end: seg.end };

        const r = regions.addRegion({
          id: seg.segmentId,
          start: seg.start,
          end: seg.end,
          drag: true,
          resize: true,
          color:
            seg.segmentId === selectedId ? "rgba(107, 99, 255, 0.38)" : "rgba(255,255,255,0.08)",
        });

        r.on("click", () => setSelectedId(seg.segmentId));

        r.on("update-end", () => {
          const s = snap(r.start);
          const e = snap(r.end);
          if (e <= s + SNAP_SEC) return;
          r.setOptions({ start: s, end: e });
          const prev =
            timingSnap.current[seg.segmentId] ?? { start: seg.start, end: seg.end };
          void (async () => {
            try {
              setBusy("save");
              pushUndo({
                kind: "timing",
                segmentId: seg.segmentId,
                prev,
                next: { start: s, end: e },
              });
              await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${seg.segmentId}`, {
                start: s,
                end: e,
              });
              timingSnap.current[seg.segmentId] = { start: s, end: e };
              await refresh();
            } catch (err) {
              console.error(err);
            } finally {
              setBusy(null);
            }
          })();
        });
      }
    });

    return () => {
      unsubInteraction();
      try {
        ws.destroy();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      regionsRef.current = null;
      registerWs(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedId handled below
  }, [
    mixAudioUrl,
    job._id,
    job.segments,
    jobId,
    refresh,
    setBusy,
    setSelectedId,
    getMedia,
    registerWs,
    scrubbingRef,
    pushUndo,
    timelineZoom,
    seekMedia,
  ]);

  // Zoom slider only
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.zoom(Math.max(8, timelineZoom));
    } catch {
      /* ignore */
    }
  }, [timelineZoom]);

  // Region highlight when selection changes (no full rebuild)
  useEffect(() => {
    const rp = regionsRef.current;
    if (!rp) return;
    try {
      for (const r of rp.getRegions()) {
        r.setOptions({
          color: r.id === selectedId ? "rgba(107, 99, 255, 0.38)" : "rgba(255,255,255,0.08)",
        });
      }
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  // Loop inside selected segment
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !loopSelection || !selectedId) return;
    const seg = job.segments.find((s) => s.segmentId === selectedId);
    if (!seg) return;

    const handler = (t: number) => {
      if (t >= seg.end - 0.02) {
        ws.setTime(seg.start);
        seekMedia(seg.start);
      }
    };
    const unsub = ws.on("timeupdate", handler);
    return () => {
      unsub();
    };
  }, [loopSelection, selectedId, job.segments, seekMedia]);

  // Keyboard shortcuts (global, not in inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;

      const ws = wsRef.current;
      const { player: p, audio: a } = getMedia();

      const videoEl = job.fileType === "video" && p ? p : null;

      if (e.code === "Space") {
        e.preventDefault();
        if (job.fileType === "video") {
          if (videoEl) {
            void ws?.pause();
            if (transportPaused(videoEl)) transportPlay(videoEl);
            else transportPause(videoEl);
          } else if (a) {
            if (a.paused) void a.play();
            else a.pause();
          } else if (ws) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "[dubbing-editor] Video element not ready; using waveform transport (audio only)."
              );
            }
            void ws.playPause();
          }
        } else {
          if (videoEl) {
            if (transportPaused(videoEl)) transportPlay(videoEl);
            else transportPause(videoEl);
          } else if (a) {
            if (a.paused) void a.play();
            else a.pause();
          } else if (ws) {
            void ws.playPause();
          }
        }
        return;
      }

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const cur =
          videoEl != null
            ? transportCurrentTime(videoEl)
            : ws?.getCurrentTime() ?? a?.currentTime ?? 0;
        const next = Math.max(0, cur - 1);
        if (job.fileType === "video" && videoEl) void ws?.pause();
        ws?.setTime(next);
        seekMedia(next);
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        const cur =
          videoEl != null
            ? transportCurrentTime(videoEl)
            : ws?.getCurrentTime() ?? a?.currentTime ?? 0;
        const dur =
          transportDuration(videoEl) ||
          ws?.getDuration() ||
          (a?.duration && Number.isFinite(a.duration) ? a.duration : 0) ||
          cur + 60;
        const next = Math.min(dur, cur + 1);
        if (job.fileType === "video" && videoEl) void ws?.pause();
        ws?.setTime(next);
        seekMedia(next);
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        void ws?.pause();
        transportPause(p);
        a?.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [getMedia, seekMedia, job.fileType]);

  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#1a1d21] flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between gap-3 border-b border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa3ad] shrink-0">
            Timeline
          </span>
          <label className="flex items-center gap-2 text-xs text-[#c5cad3] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={loopSelection}
              onChange={(e) => setLoopSelection(e.target.checked)}
              className="rounded border-white/20"
            />
            Loop selection
          </label>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[140px] max-w-xs">
          <span className="material-symbols-outlined text-[#9aa3ad] text-lg">zoom_out</span>
          <input
            type="range"
            min={10}
            max={200}
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(Number(e.target.value))}
            className="flex-1 accent-[#6b63ff]"
          />
          <span className="material-symbols-outlined text-[#9aa3ad] text-lg">zoom_in</span>
        </div>
        <span className="text-xs font-mono text-[#9aa3ad] shrink-0">
          {selectedId
            ? (() => {
                const s = job.segments.find((x) => x.segmentId === selectedId);
                return s ? `${fmtTimeShort(s.start)}–${fmtTimeShort(s.end)}` : "—";
              })()
            : "—"}
        </span>
      </div>
      <div className="p-3 min-h-[140px]">
        {mixAudioUrl ? (
          <div ref={containerRef} className="rounded-lg overflow-hidden border border-white/[0.08]" />
        ) : (
          <div className="h-[112px] flex items-center justify-center text-sm text-[#9aa3ad] rounded-lg border border-dashed border-white/10">
            No mix audio yet — Export / Rebuild to generate waveform.
          </div>
        )}
      </div>
    </div>
  );
}

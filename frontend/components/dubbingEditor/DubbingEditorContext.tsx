"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type WaveSurfer from "wavesurfer.js";

import type { EditorJob } from "./types";

export type EditorMediaRefs = {
  ws: WaveSurfer | null;
  player: HTMLVideoElement | null;
  audio: HTMLAudioElement | null;
};

function createMediaRegistry() {
  const media: EditorMediaRefs = { ws: null, player: null, audio: null };
  return {
    get: () => media,
    setPlayer: (p: HTMLVideoElement | null) => {
      media.player = p;
    },
    setAudio: (a: HTMLAudioElement | null) => {
      media.audio = a;
    },
    setWs: (w: WaveSurfer | null) => {
      media.ws = w;
    },
  };
}

export type BusyState = null | "improve" | "save" | "regen" | "rebuild";

export type UndoEntry =
  | { kind: "text"; segmentId: string; prev: string; next: string }
  | {
      kind: "timing";
      segmentId: string;
      prev: { start: number; end: number };
      next: { start: number; end: number };
    };

type DubbingEditorContextValue = {
  job: EditorJob;
  jobId: string;
  inDashboard: boolean;
  refresh: () => Promise<void>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  draftText: string;
  setDraftText: (t: string) => void;
  segmentAudioUrl: string | null;
  setSegmentAudioUrl: (u: string | null) => void;
  busy: BusyState;
  setBusy: (b: BusyState) => void;
  rebuildMsg: string | null;
  setRebuildMsg: (m: string | null) => void;
  mixAudioUrl: string;
  mixAudioUrlNoParams: string;
  videoUrl: string;
  timelineZoom: number;
  setTimelineZoom: (z: number) => void;
  loopSelection: boolean;
  setLoopSelection: (v: boolean) => void;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  scrubbingRef: React.MutableRefObject<boolean>;
  /** Read media handles (player / audio / wavesurfer) — only in effects or callbacks */
  getMedia: () => EditorMediaRefs;
  registerPlayer: (p: HTMLVideoElement | null) => void;
  registerAudio: (a: HTMLAudioElement | null) => void;
  registerWs: (w: WaveSurfer | null) => void;
  pushUndo: (e: UndoEntry) => void;
  undo: () => UndoEntry | null;
  redo: () => UndoEntry | null;
  canUndo: boolean;
  canRedo: boolean;
  recordSegmentTextVersion: (segmentId: string, text: string) => void;
  segmentTextVersions: Record<string, string[]>;
};

const DubbingEditorContext = createContext<DubbingEditorContextValue | null>(null);

function stripUrlParams(url: string): string {
  // Remove ?... and #... from url, only return the base path
  if (!url) return url;
  const [baseUrl] = url.split(/[?#]/, 1);
  return baseUrl;
}

export function DubbingEditorProvider({
  children,
  job,
  jobId,
  inDashboard,
  refresh,
  mixAudioUrl,
  videoUrl,
}: {
  children: ReactNode;
  job: EditorJob;
  jobId: string;
  inDashboard: boolean;
  refresh: () => Promise<void>;
  mixAudioUrl: string;
  videoUrl: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    job.segments[0]?.segmentId ?? null
  );
  const [draftText, setDraftText] = useState("");
  const [segmentAudioUrl, setSegmentAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(50);
  const [loopSelection, setLoopSelection] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const scrubbingRef = useRef(false);
  const registry = useRef(createMediaRegistry());
  const getMedia = useCallback(() => registry.current.get(), []);
  const registerPlayer = useCallback((p: HTMLVideoElement | null) => {
    registry.current.setPlayer(p);
  }, []);
  const registerAudio = useCallback((a: HTMLAudioElement | null) => {
    registry.current.setAudio(a);
  }, []);
  const registerWs = useCallback((w: WaveSurfer | null) => {
    registry.current.setWs(w);
  }, []);

  const undoRef = useRef<UndoEntry[]>([]);
  const redoRef = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [segmentTextVersions, setSegmentTextVersions] = useState<Record<string, string[]>>({});

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const pushUndo = useCallback(
    (e: UndoEntry) => {
      undoRef.current = [...undoRef.current.slice(-49), e];
      redoRef.current = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags]
  );

  const undo = useCallback((): UndoEntry | null => {
    const s = undoRef.current;
    if (!s.length) return null;
    const entry = s[s.length - 1]!;
    undoRef.current = s.slice(0, -1);
    redoRef.current = [...redoRef.current, entry];
    syncHistoryFlags();
    return entry;
  }, [syncHistoryFlags]);

  const redo = useCallback((): UndoEntry | null => {
    const r = redoRef.current;
    if (!r.length) return null;
    const entry = r[r.length - 1]!;
    redoRef.current = r.slice(0, -1);
    undoRef.current = [...undoRef.current, entry];
    syncHistoryFlags();
    return entry;
  }, [syncHistoryFlags]);

  const recordSegmentTextVersion = useCallback((segmentId: string, text: string) => {
    setSegmentTextVersions((prev) => {
      const list = [...(prev[segmentId] ?? []), text].slice(-12);
      return { ...prev, [segmentId]: list };
    });
  }, []);

  // Strip params from videoUrl and mixAudioUrl for context value, but retain incoming urls for other logic if needed
  const videoUrlNoParams = useMemo(
    () => stripUrlParams(videoUrl),
    [videoUrl]
  );
  const mixAudioUrlNoParams = useMemo(
    () => stripUrlParams(mixAudioUrl),
    [mixAudioUrl]
  );

  const value = useMemo(
    () => ({
      job,
      jobId,
      inDashboard,
      refresh,
      selectedId,
      setSelectedId,
      draftText,
      setDraftText,
      segmentAudioUrl,
      setSegmentAudioUrl,
      busy,
      setBusy,
      rebuildMsg,
      setRebuildMsg,
      mixAudioUrl: mixAudioUrlNoParams,
      mixAudioUrlNoParams,
      videoUrl: videoUrlNoParams,
      timelineZoom,
      setTimelineZoom,
      loopSelection,
      setLoopSelection,
      currentTime,
      setCurrentTime,
      scrubbingRef,
      getMedia,
      registerPlayer,
      registerAudio,
      registerWs,
      pushUndo,
      undo,
      redo,
      canUndo,
      canRedo,
      recordSegmentTextVersion,
      segmentTextVersions,
    }),
    [
      job,
      jobId,
      inDashboard,
      refresh,
      selectedId,
      draftText,
      segmentAudioUrl,
      busy,
      rebuildMsg,
      mixAudioUrl,
      mixAudioUrlNoParams,
      videoUrlNoParams,
      timelineZoom,
      loopSelection,
      currentTime,
      getMedia,
      registerPlayer,
      registerAudio,
      registerWs,
      pushUndo,
      undo,
      redo,
      canUndo,
      canRedo,
      recordSegmentTextVersion,
      segmentTextVersions,
    ]
  );

  return (
    <DubbingEditorContext.Provider value={value}>{children}</DubbingEditorContext.Provider>
  );
}

export function useDubbingEditor() {
  const ctx = useContext(DubbingEditorContext);
  if (!ctx) throw new Error("useDubbingEditor outside provider");
  return ctx;
}

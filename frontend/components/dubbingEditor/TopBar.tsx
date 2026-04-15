"use client";

import Link from "next/link";
import { useDubbingEditor } from "./DubbingEditorContext";
import axiosInstance from "@/utils/axios";

export default function TopBar() {
  const {
    job,
    jobId,
    inDashboard,
    busy,
    setBusy,
    setRebuildMsg,
    refresh,
    rebuildMsg,
    canUndo,
    canRedo,
    undo,
    redo,
    setDraftText,
    selectedId,
  } = useDubbingEditor();

  const backHref = inDashboard ? "/dashboard" : "/";

  const rebuild = async () => {
    setBusy("rebuild");
    try {
      setRebuildMsg("Starting rebuild…");
      let parsedUpTo = 0;
      const handleSSEText = (raw: string) => {
        const newText = raw.slice(parsedUpTo);
        parsedUpTo = raw.length;
        for (const frame of newText.split("\n\n")) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim()) as { stage: string; message?: string };
            if (evt.stage === "error") {
              setRebuildMsg(evt.message ?? "Rebuild failed.");
              return;
            }
            if (evt.message) setRebuildMsg(evt.message);
            if (evt.stage === "done") setRebuildMsg("Rebuild complete.");
          } catch {
            /* ignore */
          }
        }
      };
      await axiosInstance.post<string>(`/api/dubbing/${jobId}/rebuild`, null, {
        params: { stream: 1 },
        responseType: "text",
        onDownloadProgress: (e) => {
          const text = (e.event?.target as XMLHttpRequest | undefined)?.responseText ?? "";
          handleSSEText(text);
        },
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const applyUndo = async () => {
    const e = undo();
    if (!e) return;
    if (e.kind === "text") {
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${e.segmentId}`, {
        translatedText: e.prev,
      });
      if (e.segmentId === selectedId) setDraftText(e.prev);
      await refresh();
    } else {
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${e.segmentId}`, {
        start: e.prev.start,
        end: e.prev.end,
      });
      await refresh();
    }
  };

  const applyRedo = async () => {
    const e = redo();
    if (!e) return;
    if (e.kind === "text") {
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${e.segmentId}`, {
        translatedText: e.next,
      });
      if (e.segmentId === selectedId) setDraftText(e.next);
      await refresh();
    } else {
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${e.segmentId}`, {
        start: e.next.start,
        end: e.next.end,
      });
      await refresh();
    }
  };

  const disabled = busy != null;

  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-white/[0.08] bg-[#1e2228] text-[#e8eaed]">
      <Link
        href={backHref}
        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Back"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
      </Link>
      <div className="h-6 w-px bg-white/10 mx-1" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate font-[family-name:var(--font-headline)]">
          {job.originalFileName}
        </p>
        <p className="text-[11px] text-[#9aa3ad] truncate">
          {job.targetLanguage} · {job.segments.length} segments
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void applyUndo()}
          disabled={!canUndo || disabled}
          className="w-9 h-9 rounded-lg hover:bg-white/10 disabled:opacity-40 flex items-center justify-center"
          title="Undo"
        >
          <span className="material-symbols-outlined text-xl">undo</span>
        </button>
        <button
          type="button"
          onClick={() => void applyRedo()}
          disabled={!canRedo || disabled}
          className="w-9 h-9 rounded-lg hover:bg-white/10 disabled:opacity-40 flex items-center justify-center"
          title="Redo"
        >
          <span className="material-symbols-outlined text-xl">redo</span>
        </button>
      </div>
      <div className="h-6 w-px bg-white/10 mx-1" />
      {rebuildMsg && (
        <span className="hidden sm:block text-xs text-[#9aa3ad] max-w-[200px] truncate mr-2">
          {rebuildMsg}
        </span>
      )}
      {(job.dubbedVideoUrl ?? job.dubbedAudioUrl) && (
        <a
          href={job.dubbedVideoUrl ?? job.dubbedAudioUrl ?? "#"}
          download
          rel="noopener noreferrer"
          title="Download dubbed output"
          className="h-9 px-3 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base leading-none">download</span>
          <span className="hidden sm:inline">Download</span>
        </a>
      )}
      <button
        type="button"
        onClick={() => void rebuild()}
        disabled={disabled}
        className="h-9 px-4 rounded-lg bg-[#6b63ff] text-white text-sm font-semibold hover:bg-[#5a52e8] disabled:opacity-50 transition-colors"
      >
        {busy === "rebuild" ? "Exporting…" : "Export / Rebuild"}
      </button>
    </header>
  );
}

"use client";

import { useEffect } from "react";
import { useDubbingEditor } from "./DubbingEditorContext";
import axiosInstance, { s3Url } from "@/utils/axios";
import { fmtTime } from "./types";

export default function RightInspector() {
  const {
    job,
    jobId,
    selectedId,
    draftText,
    setDraftText,
    segmentAudioUrl,
    setSegmentAudioUrl,
    busy,
    setBusy,
    refresh,
    pushUndo,
    recordSegmentTextVersion,
  } = useDubbingEditor();

  const selected = job.segments.find((s) => s.segmentId === selectedId) ?? null;
  const duration = selected ? Math.max(0.01, selected.end - selected.start) : 0;

  useEffect(() => {
    if (!selectedId) return;
    const s = job.segments.find((x) => x.segmentId === selectedId);
    if (s) setDraftText(s.translatedText ?? "");
    setSegmentAudioUrl(null);
    // Only reset when switching segments — not on every job refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, setDraftText, setSegmentAudioUrl]);

  const actionDisabled = busy != null;

  const saveText = async () => {
    if (!jobId || !selected) return;
    const prev = selected.translatedText ?? "";
    const next = draftText;
    if (prev === next) return;
    setBusy("save");
    try {
      pushUndo({ kind: "text", segmentId: selected.segmentId, prev, next });
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${selected.segmentId}`, {
        translatedText: next,
      });
      recordSegmentTextVersion(selected.segmentId, next);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const improve = async () => {
    if (!jobId || !selected) return;
    setBusy("improve");
    try {
      const res = await axiosInstance.post<{ improvedText: string }>(
        `/api/dubbing/${jobId}/segments/${selected.segmentId}/improve`
      );
      const improved = res.data.improvedText ?? "";
      setDraftText(improved);
      recordSegmentTextVersion(selected.segmentId, improved);
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    if (!jobId || !selected) return;
    setBusy("regen");
    try {
      const res = await axiosInstance.post<{ audio?: { url?: string } }>(
        `/api/dubbing/${jobId}/segments/${selected.segmentId}/regenerate`
      );
      const url = res.data.audio?.url ? s3Url(res.data.audio.url) : null;
      setSegmentAudioUrl(url);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="w-[300px] shrink-0 flex flex-col border-l border-white/[0.08] bg-[#1e2228] text-[#e8eaed]">
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa3ad]">Properties</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[#9aa3ad]">
            <span className="material-symbols-outlined text-4xl mb-3 opacity-40">touch_app</span>
            Select a segment on the timeline or list.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#c5cad3]">{selected.speaker_id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6b63ff]/20 text-[#a59cff] font-bold">
                  {job.targetLanguage}
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#6b7280]">
                {fmtTime(selected.start)} → {fmtTime(selected.end)} · {duration.toFixed(2)}s · rev{" "}
                {selected.revision ?? 0}
              </p>
              {selected.timingStrategy && (
                <p className="text-[10px] text-[#9aa3ad] mt-1">Fit: {selected.timingStrategy}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-2">
                Dub text
              </label>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl bg-[#12141a] border border-white/10 px-3 py-2.5 text-sm text-[#e8eaed] leading-relaxed outline-none focus:border-[#6b63ff]/50 placeholder:text-[#6b7280]"
                placeholder="Translated line…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void improve()}
                disabled={actionDisabled}
                className="w-full py-2.5 rounded-xl bg-[#6b63ff] text-white text-sm font-semibold hover:bg-[#5a52e8] disabled:opacity-50 transition-colors"
              >
                {busy === "improve" ? "Improving…" : "Improve with AI"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void saveText()}
                  disabled={actionDisabled}
                  className="py-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save text"}
                </button>
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  disabled={actionDisabled}
                  className="py-2 rounded-xl bg-[#2d3139] border border-white/10 text-sm font-semibold hover:bg-[#383e48] disabled:opacity-50"
                >
                  {busy === "regen" ? "…" : "Regenerate"}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.08]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-2">
                Segment preview
              </p>
              {segmentAudioUrl ? (
                <audio className="w-full" controls src={segmentAudioUrl} />
              ) : (
                <p className="text-xs text-[#6b7280]">Regenerate to hear this clip in isolation.</p>
              )}
            </div>

            {selected.originalText ? (
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-1">
                  Original
                </p>
                <p className="text-xs text-[#9aa3ad] leading-relaxed">{selected.originalText}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useDubbingEditor } from "./DubbingEditorContext";
import axiosInstance, { s3Url } from "@/utils/axios";
import { fmtTime } from "./types";

// ── Add-Segment form state ───────────────────────────────────────────────────
type AddForm = {
  translatedText: string;
  start: string;
  end: string;
  speaker_id: string;
};

const EMPTY_FORM: AddForm = { translatedText: "", start: "", end: "", speaker_id: "" };

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

  // ── Local timing draft (for the number inputs) ───────────────────────────
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  // ── Add-segment panel ────────────────────────────────────────────────────
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_FORM);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reset draft timing whenever selection changes
  useEffect(() => {
    if (!selectedId) return;
    const s = job.segments.find((x) => x.segmentId === selectedId);
    if (s) {
      setDraftText(s.translatedText ?? "");
      setDraftStart(s.start.toFixed(3));
      setDraftEnd(s.end.toFixed(3));
    }
    setSegmentAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, setDraftText, setSegmentAudioUrl]);

  // Pre-fill speaker when entering add mode
  useEffect(() => {
    if (!selectedId && job.speakerProfiles.length > 0) {
      setAddForm((f) => ({ ...f, speaker_id: f.speaker_id || job.speakerProfiles[0]!.speaker_id }));
    }
  }, [selectedId, job.speakerProfiles]);

  const actionDisabled = busy != null;

  // ── Segment text actions ─────────────────────────────────────────────────
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

  // ── Timing (start / end) save ────────────────────────────────────────────
  const saveTiming = async () => {
    if (!jobId || !selected) return;
    const s = parseFloat(draftStart);
    const e = parseFloat(draftEnd);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
    const prev = { start: selected.start, end: selected.end };
    const next = { start: s, end: e };
    setBusy("save");
    try {
      pushUndo({ kind: "timing", segmentId: selected.segmentId, prev, next });
      await axiosInstance.patch(`/api/dubbing/${jobId}/segments/${selected.segmentId}`, {
        start: s,
        end: e,
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  // ── Add segment ──────────────────────────────────────────────────────────
  const submitAddSegment = async () => {
    if (!jobId) return;
    const start = parseFloat(addForm.start);
    const end = parseFloat(addForm.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setAddError("End must be greater than start.");
      return;
    }
    if (!addForm.translatedText.trim()) {
      setAddError("Text is required.");
      return;
    }
    if (!addForm.speaker_id) {
      setAddError("Please select a speaker.");
      return;
    }
    setAddError(null);
    setAddBusy(true);
    try {
      await axiosInstance.post(`/api/dubbing/${jobId}/segments`, {
        start,
        end,
        speaker_id: addForm.speaker_id,
        translatedText: addForm.translatedText.trim(),
      });
      setAddForm(EMPTY_FORM);
      await refresh();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Failed to add segment.";
      setAddError(msg);
    } finally {
      setAddBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <aside className="w-[300px] shrink-0 flex flex-col border-l border-white/[0.08] bg-[#1e2228] text-[#e8eaed]">
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa3ad]">Properties</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">

        {/* ── No selection → Add Segment panel ───────────────────────────── */}
        {!selected ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 text-center text-sm text-[#9aa3ad]">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-40">touch_app</span>
              Select a segment, or add a new one below.
            </div>

            {/* Add segment card */}
            <div className="rounded-xl bg-[#12141a] border border-white/10 p-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa3ad]">
                Add New Segment
              </p>

              {/* Speaker picker */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-1.5">
                  Speaker
                </label>
                <select
                  value={addForm.speaker_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, speaker_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d21] border border-white/10 text-sm text-[#e8eaed] outline-none focus:border-[#6b63ff]/50"
                >
                  <option value="">— select speaker —</option>
                  {job.speakerProfiles.map((p) => (
                    <option key={p.speaker_id} value={p.speaker_id}>
                      {p.speaker_id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-1.5">
                    Start (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addForm.start}
                    onChange={(e) => setAddForm((f) => ({ ...f, start: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 rounded-lg bg-[#1a1d21] border border-white/10 text-sm text-[#e8eaed] outline-none focus:border-[#6b63ff]/50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-1.5">
                    End (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addForm.end}
                    onChange={(e) => setAddForm((f) => ({ ...f, end: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 rounded-lg bg-[#1a1d21] border border-white/10 text-sm text-[#e8eaed] outline-none focus:border-[#6b63ff]/50 font-mono"
                  />
                </div>
              </div>

              {/* Text */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-1.5">
                  Dubbed text
                </label>
                <textarea
                  value={addForm.translatedText}
                  onChange={(e) => setAddForm((f) => ({ ...f, translatedText: e.target.value }))}
                  rows={5}
                  placeholder="Type the line to be voiced…"
                  className="w-full resize-none rounded-xl bg-[#1a1d21] border border-white/10 px-3 py-2.5 text-sm text-[#e8eaed] leading-relaxed outline-none focus:border-[#6b63ff]/50 placeholder:text-[#6b7280]"
                />
              </div>

              {addError && (
                <p className="text-xs text-red-400">{addError}</p>
              )}

              <button
                type="button"
                onClick={() => void submitAddSegment()}
                disabled={addBusy}
                className="w-full py-2.5 rounded-xl bg-[#6b63ff] text-white text-sm font-semibold hover:bg-[#5a52e8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {addBusy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating voice…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base leading-none">add</span>
                    Add &amp; Generate Voice
                  </>
                )}
              </button>
            </div>
          </div>

        ) : (
          /* ── Segment selected ──────────────────────────────────────────── */
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

            {/* ── Timing editors ──────────────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-2">
                Timing (seconds)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#6b7280] mb-1">Start</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#12141a] border border-white/10 text-sm text-[#e8eaed] outline-none focus:border-[#6b63ff]/50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6b7280] mb-1">End</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#12141a] border border-white/10 text-sm text-[#e8eaed] outline-none focus:border-[#6b63ff]/50 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void saveTiming()}
                disabled={actionDisabled}
                className="mt-2 w-full py-1.5 rounded-lg bg-white/8 border border-white/10 text-xs font-semibold hover:bg-white/12 disabled:opacity-50 transition-colors"
              >
                {busy === "save" ? "Saving timing…" : "Apply timing"}
              </button>
            </div>

            {/* ── Dub text ──────────────────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa3ad] mb-2">
                Dub text
              </label>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={7}
                className="w-full resize-none rounded-xl bg-[#12141a] border border-white/10 px-3 py-2.5 text-sm text-[#e8eaed] leading-relaxed outline-none focus:border-[#6b63ff]/50 placeholder:text-[#6b7280]"
                placeholder="Translated line…"
              />
            </div>

            {/* ── Actions ───────────────────────────────────────────────── */}
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

            {/* ── Segment preview audio ──────────────────────────────────── */}
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

            {/* ── Original text ──────────────────────────────────────────── */}
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

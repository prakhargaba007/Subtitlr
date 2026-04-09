"use client";

import { useMemo, useState } from "react";
import { useDubbingEditor } from "./DubbingEditorContext";
import { fmtTimeShort } from "./types";

const TABS = ["Segments", "Voices", "AI", "Versions"] as const;

export default function LeftPanel() {
  const {
    job,
    selectedId,
    setSelectedId,
    segmentTextVersions,
    recordSegmentTextVersion,
  } = useDubbingEditor();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Segments");
  const [search, setSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<string>("");

  const speakers = useMemo(() => {
    const set = new Set(job.segments.map((s) => s.speaker_id));
    return [...set];
  }, [job.segments]);

  const filteredSegments = useMemo(() => {
    return job.segments.filter((s) => {
      if (speakerFilter && s.speaker_id !== speakerFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (s.translatedText ?? "").toLowerCase().includes(q) ||
        (s.originalText ?? "").toLowerCase().includes(q) ||
        s.speaker_id.toLowerCase().includes(q)
      );
    });
  }, [job.segments, search, speakerFilter]);

  return (
    <aside className="w-[360px] shrink-0 flex  border-r border-white/[0.08] bg-[#1e2228] text-[#e8eaed]">
      <div className="border-b border-white/[0.08] flex flex-col">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 py-2.5 h-full px-2.5 text-[10px] font-bold uppercase tracking-wider items-center justify-center transition-colors",
              tab === t ? "text-[#6b63ff] border-b-2 border-[#6b63ff] bg-white/[0.04]" : "text-[#9aa3ad] hover:text-[#c5cad3]",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {tab === "Segments" && (
          <div className="space-y-3">
            <input
              type="search"
              placeholder="Search segments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-sm text-[#e8eaed] placeholder:text-[#6b7280] outline-none focus:border-[#6b63ff]/50"
            />
            <select
              value={speakerFilter}
              onChange={(e) => setSpeakerFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-sm text-[#e8eaed] outline-none"
            >
              <option value="">All speakers</option>
              {speakers.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
            <ul className="space-y-1">
              {filteredSegments.length === 0 ? (
                <li className="text-sm text-[#9aa3ad] py-8 text-center">No segments match.</li>
              ) : (
                filteredSegments.map((s) => (
                  <li key={s.segmentId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.segmentId)}
                      className={[
                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border border-transparent",
                        selectedId === s.segmentId
                          ? "bg-[#6b63ff]/20 border-[#6b63ff]/40 text-white"
                          : "hover:bg-white/5 text-[#c5cad3]",
                      ].join(" ")}
                    >
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="font-semibold text-[#9aa3ad]">{s.speaker_id}</span>
                        <span className="font-mono text-[10px] text-[#6b7280]">
                          {fmtTimeShort(s.start)}–{fmtTimeShort(s.end)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-snug opacity-90">
                        {s.translatedText || "(empty)"}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {tab === "Voices" && (
          <ul className="space-y-2">
            {job.speakerProfiles.length === 0 ? (
              <li className="text-sm text-[#9aa3ad]">No speaker profiles.</li>
            ) : (
              job.speakerProfiles.map((p) => (
                <li
                  key={p.speaker_id}
                  className="p-3 rounded-lg bg-[#12141a] border border-white/[0.06] text-xs"
                >
                  <p className="font-bold text-[#e8eaed] mb-1">{p.speaker_id}</p>
                  <p className="text-[#9aa3ad] leading-relaxed mb-2">
                    {p.voice_description || "—"}
                  </p>
                  <p className="text-[10px] font-mono text-[#6b7280] break-all">
                    Voice: {p.elevenlabs_voice_id || "—"}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}

        {tab === "AI" && (
          <div className="space-y-3 text-sm text-[#9aa3ad]">
            <p className="leading-relaxed">
              Use <strong className="text-[#c5cad3]">Improve with AI</strong> in the right panel to rewrite
              the selected line for natural speech within the segment duration.
            </p>
            <p className="leading-relaxed">
              <strong className="text-[#c5cad3]">Regenerate audio</strong> after text changes to hear the new
              take. Then <strong className="text-[#c5cad3]">Export / Rebuild</strong> to update the full mix.
            </p>
            <div className="p-3 rounded-lg bg-[#12141a] border border-white/[0.06] text-xs">
              <p className="font-bold text-[#e8eaed] mb-2">Shortcuts</p>
              <ul className="space-y-1 font-mono text-[11px]">
                <li>Space — play / pause</li>
                <li>J / L — seek ±1s</li>
                <li>K — pause</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "Versions" && (
          <div className="space-y-2">
            {!selectedId ? (
              <p className="text-sm text-[#9aa3ad]">Select a segment to see text history.</p>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-2">
                  Saved text versions (this session)
                </p>
                <ul className="space-y-2">
                  {(segmentTextVersions[selectedId] ?? []).length === 0 ? (
                    <li className="text-sm text-[#9aa3ad]">No history yet. Save or Improve to record.</li>
                  ) : (
                    [...(segmentTextVersions[selectedId] ?? [])].reverse().map((txt, i) => (
                      <li
                        key={i}
                        className="p-2 rounded-lg bg-[#12141a] border border-white/[0.06] text-xs text-[#c5cad3] line-clamp-4"
                      >
                        {txt}
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  className="mt-2 text-[11px] text-[#6b63ff] hover:underline"
                  onClick={() => {
                    const t = job.segments.find((s) => s.segmentId === selectedId)?.translatedText;
                    if (t) recordSegmentTextVersion(selectedId, t);
                  }}
                >
                  Snapshot current server text
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

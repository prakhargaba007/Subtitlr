"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import axiosInstance from "@/utils/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface SubtitleJob {
  _id: string;
  originalFileName: string;
  fileType: "audio" | "video";
  duration: number;
  creditsUsed: number;
  language: string;
  segments: Segment[];
  transcription: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDurationSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}

const DOWNLOADS = [
  { label: "Download .SRT", sub: "Standard Format", ext: "srt", primary: true },
  { label: "Download .VTT", sub: "Web Optimized", ext: "vtt", primary: false },
  { label: "Download .ASS", sub: "Advanced Styling", ext: "ass", primary: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const jobId = searchParams.get("jobId");

  const [job, setJob] = useState<SubtitleJob | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeLine, setActiveLine] = useState<number>(0);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  // Fetch job + credits on mount
  useEffect(() => {
    if (!jobId) {
      setErrorMsg("No job ID found. Please re-upload your file.");
      setLoading(false);
      return;
    }

    Promise.all([
      axiosInstance.get<{ job: SubtitleJob }>(`/api/subtitles/${jobId}`),
      axiosInstance.get<{ credits: number }>("/api/subtitles/credits"),
    ])
      .then(([jobRes, creditsRes]) => {
        setJob(jobRes.data.job);
        setSegments(jobRes.data.job.segments);
        setCredits(creditsRes.data.credits);
        setActiveLine(0);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ?? err.message ?? "Failed to load subtitle data.";
        setErrorMsg(msg);
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  // Download via direct browser navigation so the backend's Content-Disposition header
  // triggers a file save without needing an axios blob response.
  const handleDownload = (ext: string) => {
    if (!jobId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
    const url = `${backendUrl}/api/subtitles/${jobId}/export?format=${ext}`;

    // Fetch as blob to attach Authorization header (direct navigation loses it)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `${(job?.originalFileName ?? "subtitles").replace(/\.[^.]+$/, "")}.${ext}`;
        a.click();
        URL.revokeObjectURL(objectUrl);
        setDownloaded((prev) => [...prev, ext]);
      })
      .catch(console.error);
  };

  const saveEdit = (idx: number, newText: string) => {
    setSegments((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, text: newText } : s))
    );
    setEditingLine(null);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading your subtitles…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (errorMsg || !job) {
    return (
      <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h2 className="font-headline text-h4 font-bold text-on-surface">Something went wrong</h2>
          <p className="text-sm text-on-surface-variant">{errorMsg}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 px-6 py-2.5 bg-on-surface text-white text-sm font-headline font-bold rounded-full hover:bg-on-surface/90 transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const totalCredits = (credits ?? 0) + job.creditsUsed;

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased">

      <AppNavbar action={{ label: "Export" }} />

      <main className="pt-28 pb-20 px-6 max-w-6xl mx-auto">

        {/* ── Success header ────────────────────────────────────────────── */}
        <section className="mb-12 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="shrink-0 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/10">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
              >
                check_circle
              </span>
            </div>
          </div>

          <div className="text-center md:text-left">
            <h1 className="font-headline text-h3 font-bold tracking-tight text-on-surface mb-2">
              Subtitles Generated Successfully
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-on-surface-variant text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">movie</span>
                {job.originalFileName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">schedule</span>
                {formatDurationSecs(job.duration)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">token</span>
                {job.creditsUsed} Credit{job.creditsUsed !== 1 ? "s" : ""} Used
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">language</span>
                {job.language}
              </span>
            </div>
          </div>
        </section>

        {/* ── Main grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left — Preview editor */}
          <div className="lg:col-span-8">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden flex flex-col h-[420px] shadow-sm">

              {/* Editor toolbar */}
              <div className="px-6 py-3.5 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/10">
                <h2 className="font-headline font-semibold text-on-surface text-sm">Preview Editor</h2>
                <span className="text-xs font-headline font-semibold text-on-surface-variant bg-surface-container-lowest px-3 py-1 rounded-full border border-outline-variant/20">
                  {segments.length} segments
                </span>
              </div>

              {/* Transcript lines */}
              <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
                {segments.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">
                    No segments found.
                  </div>
                ) : (
                  segments.map((seg, idx) => {
                    const isActive = activeLine === idx;
                    const isEditing = editingLine === idx;

                    return (
                      <div
                        key={idx}
                        onClick={() => { setActiveLine(idx); setEditingLine(null); }}
                        className={[
                          "group flex items-start gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all",
                          isActive
                            ? "bg-primary/5 border-l-[3px] border-primary"
                            : "border-l-[3px] border-transparent hover:bg-surface-container-low",
                        ].join(" ")}
                      >
                        {/* Play button */}
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={[
                            "material-symbols-outlined text-xl shrink-0 mt-0.5 transition-colors",
                            isActive ? "text-primary" : "text-on-surface-variant/30 group-hover:text-primary/60",
                          ].join(" ")}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          play_circle
                        </button>

                        {/* Timestamp */}
                        <span
                          className={[
                            "font-headline text-xs w-14 shrink-0 pt-1 font-semibold",
                            isActive ? "text-primary" : "text-on-surface-variant",
                          ].join(" ")}
                        >
                          [{formatTime(seg.start)}]
                        </span>

                        {/* Text — editable on double-click */}
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={seg.text}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => saveEdit(idx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(idx, e.currentTarget.value);
                              if (e.key === "Escape") setEditingLine(null);
                            }}
                            className="flex-1 bg-transparent border-b border-primary outline-none text-body text-on-surface font-body leading-relaxed"
                          />
                        ) : (
                          <p
                            className="flex-1 text-body text-on-surface font-body leading-relaxed"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingLine(idx); }}
                            title="Double-click to edit"
                          >
                            {seg.text}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Secondary actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { icon: "edit_note", label: "Edit subtitles" },
                { icon: "refresh", label: "Regenerate" },
                { icon: "translate", label: "Convert to Hinglish / English" },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-headline text-sm font-semibold rounded-full hover:bg-surface-container-low transition-all"
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right — Downloads + Credits */}
          <div className="lg:col-span-4 space-y-6">

            {/* Downloads */}
            <div className="space-y-3">
              <h3 className="font-headline font-bold text-h4 text-on-surface">Download Files</h3>

              {DOWNLOADS.map(({ label, sub, ext, primary }) => (
                <button
                  key={ext}
                  onClick={() => handleDownload(ext)}
                  className={[
                    "w-full group flex items-center justify-between p-5 rounded-2xl transition-all hover:-translate-y-0.5",
                    primary
                      ? "bg-linear-to-r from-primary to-primary-container text-on-primary shadow-lg hover:shadow-primary/25"
                      : "bg-surface-container-lowest border border-outline-variant/20 text-on-surface hover:bg-surface-container-low",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={[
                        "material-symbols-outlined text-2xl",
                        !primary && "text-primary",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {downloaded.includes(ext) ? "check_circle" : "download"}
                    </span>
                    <div className="text-left">
                      <p className="font-headline font-bold text-sm">{label}</p>
                      <p className={`text-xs font-body ${primary ? "opacity-75" : "text-on-surface-variant"}`}>
                        {sub}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity text-lg">
                    arrow_forward
                  </span>
                </button>
              ))}
            </div>

            {/* Credits card */}
            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-on-surface-variant font-body">
                  Credits left:{" "}
                  <strong className="text-on-surface font-headline">
                    {credits ?? "—"}
                  </strong>
                </span>
                <span className="text-xs font-headline font-bold text-tertiary uppercase tracking-wider">
                  Used: {job.creditsUsed}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface-container-highest h-2 rounded-full mb-5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{
                    width: totalCredits > 0 ? `${((credits ?? 0) / totalCredits) * 100}%` : "0%",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push("/")}
                  className="py-2.5 bg-surface-container-lowest text-on-surface text-sm font-headline font-bold rounded-full hover:bg-white transition-colors border border-outline-variant/20"
                >
                  Upload another
                </button>
                <button className="py-2.5 bg-on-surface text-white text-sm font-headline font-bold rounded-full hover:bg-on-surface/90 transition-colors">
                  Upgrade
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e0e3e5; border-radius: 10px; }
      `}</style>
    </div>
  );
}

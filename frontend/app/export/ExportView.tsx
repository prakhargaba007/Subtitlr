"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";

/* ── Mock transcript data ───────────────────────────────────────────────── */
const TRANSCRIPT = [
  { id: 1, time: "00:01", text: "Hello bhai kya scene hai" },
  { id: 2, time: "00:03", text: "Aaj hum ek new video banayenge" },
  { id: 3, time: "00:07", text: "Is video mein hum subtitles generate karna seekhenge" },
  { id: 4, time: "00:12", text: "Kaafi logon ne pucha tha ki transitions kaise apply karein" },
  { id: 5, time: "00:15", text: "Toh aaj focus karte hain alignment aur readable text par" },
  { id: 6, time: "00:20", text: "Sabse pehle aapko editor open karna hai" },
  { id: 7, time: "00:25", text: "Phir File menu mein jaake New Project select karo" },
  { id: 8, time: "00:31", text: "Yahan se hum apna video import kar sakte hain" },
  { id: 9, time: "00:37", text: "Timeline mein drag karke drop kar do" },
  { id: 10, time: "00:42", text: "Ab Text tool select karo aur subtitle add karo" },
];

const DOWNLOADS = [
  { label: "Download .SRT", sub: "Standard Format", ext: "srt", primary: true },
  { label: "Download .VTT", sub: "Web Optimized",   ext: "vtt", primary: false },
  { label: "Download .ASS", sub: "Advanced Styling", ext: "ass", primary: false },
];

const TOTAL_CREDITS = 15;
const USED_CREDITS  = 3;
const LEFT_CREDITS  = TOTAL_CREDITS - USED_CREDITS;

function formatDuration(name: string) {
  // Fake a duration based on file name length for demo purposes
  const mins = Math.max(1, (name.length % 4) + 1);
  return `${mins} min ${(name.length % 60)}  sec`;
}

export default function ExportView() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const fileName      = searchParams.get("name") ?? "video.mp4";

  const [activeLine, setActiveLine]     = useState<number>(2);
  const [editingLine, setEditingLine]   = useState<number | null>(null);
  const [lines, setLines]               = useState(TRANSCRIPT);
  const [downloaded, setDownloaded]     = useState<string[]>([]);

  const handleDownload = (ext: string) => {
    setDownloaded((prev) => [...prev, ext]);
    // Build a tiny mock SRT blob and trigger browser download
    const content = lines
      .map((l, i) => `${i + 1}\n00:${l.time}:00,000 --> 00:${l.time}:02,000\n${l.text}\n`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${fileName.replace(/\.[^.]+$/, "")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveEdit = (id: number, newText: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text: newText } : l)));
    setEditingLine(null);
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased">

      <AppNavbar action={{ label: "Export" }} />

      <main className="pt-28 pb-20 px-6 max-w-6xl mx-auto">

        {/* ── Success header ───────────────────────────────────────────── */}
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
                {fileName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">schedule</span>
                {formatDuration(fileName)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">token</span>
                {USED_CREDITS} Credits Used
              </span>
            </div>
          </div>
        </section>

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left — Preview editor */}
          <div className="lg:col-span-8">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden flex flex-col h-[420px] shadow-sm">

              {/* Editor toolbar */}
              <div className="px-6 py-3.5 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/10">
                <h2 className="font-headline font-semibold text-on-surface text-sm">Preview Editor</h2>
                <span className="text-xs font-headline font-semibold text-on-surface-variant bg-surface-container-lowest px-3 py-1 rounded-full border border-outline-variant/20">
                  AI Refined
                </span>
              </div>

              {/* Transcript lines */}
              <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
                {lines.map((line) => {
                  const isActive  = activeLine === line.id;
                  const isEditing = editingLine === line.id;

                  return (
                    <div
                      key={line.id}
                      onClick={() => { setActiveLine(line.id); setEditingLine(null); }}
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
                          "font-headline text-xs w-12 shrink-0 pt-1 font-semibold",
                          isActive ? "text-primary" : "text-on-surface-variant",
                        ].join(" ")}
                      >
                        [{line.time}]
                      </span>

                      {/* Text — editable on double-click */}
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={line.text}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => saveEdit(line.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(line.id, e.currentTarget.value);
                            if (e.key === "Escape") setEditingLine(null);
                          }}
                          className="flex-1 bg-transparent border-b border-primary outline-none text-body text-on-surface font-body leading-relaxed"
                        />
                      ) : (
                        <p
                          className="flex-1 text-body text-on-surface font-body leading-relaxed"
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingLine(line.id); }}
                          title="Double-click to edit"
                        >
                          {line.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Secondary actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { icon: "edit_note",  label: "Edit subtitles" },
                { icon: "refresh",    label: "Regenerate" },
                { icon: "translate",  label: "Convert to Hinglish / English" },
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
                  Credits left: <strong className="text-on-surface font-headline">{LEFT_CREDITS}</strong>
                </span>
                <span className="text-xs font-headline font-bold text-tertiary uppercase tracking-wider">
                  Used: {USED_CREDITS}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface-container-highest h-2 rounded-full mb-5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${(LEFT_CREDITS / TOTAL_CREDITS) * 100}%` }}
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

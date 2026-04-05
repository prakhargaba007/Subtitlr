"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axios";

interface CreditsData {
  credits: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-4 font-headline">
      {children}
    </h3>
  );
}

export default function DashboardRightPanel() {
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get<CreditsData>("/api/subtitles/credits")
      .then((res) => setCredits(res.data.credits))
      .catch(() => setCredits(null))
      .finally(() => setCreditsLoading(false));
  }, []);

  const MAX_CREDITS = 60;
  const usedPercent =
    credits !== null ? Math.round(((MAX_CREDITS - credits) / MAX_CREDITS) * 100) : 0;

  return (
    <aside className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] border-l border-outline-variant/20 bg-surface-container-lowest z-30 hidden xl:flex flex-col">
      <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">

        {/* Credits */}
        <section>
          <SectionLabel>Credits</SectionLabel>
          <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/20 editorial-glow space-y-3">
            {creditsLoading ? (
              <div className="h-16 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase font-label">Monthly Usage</p>
                  <span className="text-[10px] font-bold text-primary font-label">{usedPercent}%</span>
                </div>
                <p className="text-xl font-extrabold text-on-surface font-headline">
                  {credits ?? "—"}
                  <span className="text-sm text-on-surface-variant font-normal">/{MAX_CREDITS} remaining</span>
                </p>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, usedPercent)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Get more credits CTA */}
        <section>
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
              <p className="text-xs font-bold text-on-surface font-headline">Need more credits?</p>
            </div>
            <p className="text-[11px] text-on-surface-variant font-body leading-relaxed">
              Upgrade your plan to get unlimited transcriptions and priority processing.
            </p>
            <button className="w-full py-2 bg-primary text-on-primary text-xs font-headline font-bold rounded-xl hover:bg-primary/90 transition-colors">
              Upgrade Plan
            </button>
          </div>
        </section>

        {/* Quick links */}
        <section>
          <SectionLabel>Quick Links</SectionLabel>
          <div className="space-y-2">
            {[
              { icon: "upload_file", label: "New Upload", href: "/dashboard" },
              { icon: "folder_open", label: "All Projects", href: "#" },
              { icon: "toll", label: "Credit History", href: "#" },
              { icon: "help", label: "Documentation", href: "#" },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all text-xs font-headline font-semibold"
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </a>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e0e3e5; border-radius: 10px; }
      `}</style>
    </aside>
  );
}

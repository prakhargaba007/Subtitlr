"use client";

import { Suspense } from "react";
import DubbingExportView from "@/components/dubbing/DubbingExportView";

function DubbingExportLoading() {
  return (
    <div className="min-h-screen bg-[#12141a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-3 border-[#6b63ff]/20 border-t-[#6b63ff] rounded-full animate-spin" />
        <p className="text-sm font-medium text-white/40 tracking-widest uppercase">Loading Result</p>
      </div>
    </div>
  );
}

export default function DubbingExportPage() {
  return (
    <Suspense fallback={<DubbingExportLoading />}>
      <DubbingExportView />
    </Suspense>
  );
}

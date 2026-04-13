"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import axiosInstance, { s3Url } from "@/utils/axios";
import type { EditorJob } from "@/components/dubbingEditor/types";
import { DubbingEditorProvider } from "@/components/dubbingEditor/DubbingEditorContext";
import EditorShell from "@/components/dubbingEditor/EditorShell";

function DubbingEditorLoading() {
  return (
    <div className="h-[100dvh] bg-[#12141a] flex items-center justify-center text-[#e8eaed]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#6b63ff]/30 border-t-[#6b63ff] rounded-full animate-spin" />
        <p className="text-sm text-[#9aa3ad]">Loading editor…</p>
      </div>
    </div>
  );
}

function DubbingEditorPageInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const inDashboard = pathname.startsWith("/dashboard");

  const jobId = searchParams.get("jobId");
  const [job, setJob] = useState<EditorJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mixAudioUrl = useMemo(() => s3Url(job?.dubbedAudioUrl ?? ""), [job?.dubbedAudioUrl]);
  const videoUrl = useMemo(() => s3Url(job?.dubbedVideoUrl ?? ""), [job?.dubbedVideoUrl]);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    const res = await axiosInstance.get<{ job: EditorJob }>(`/api/dubbing/${jobId}/editor`);
    setJob(res.data.job);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setErrorMsg("Missing jobId.");
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh()
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to load dubbing editor.";
        setErrorMsg(msg);
      })
      .finally(() => setLoading(false));
  }, [jobId, refresh]);

  if (loading) {
    return <DubbingEditorLoading />;
  }

  if (errorMsg || !job) {
    return (
      <div className="h-[100dvh] bg-[#12141a] flex items-center justify-center text-[#e8eaed] px-6">
        <div className="text-center space-y-4 max-w-md">
          <span className="material-symbols-outlined text-5xl text-red-400/80">error</span>
          <h2 className="text-lg font-bold">Editor failed to load</h2>
          <p className="text-sm text-[#9aa3ad]">{errorMsg ?? "Unknown error."}</p>
          <Link
            href={inDashboard ? "/dashboard" : "/"}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6b63ff] text-white text-sm font-semibold hover:bg-[#5a52e8]"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DubbingEditorProvider
      job={job}
      jobId={jobId!}
      inDashboard={inDashboard}
      refresh={refresh}
      mixAudioUrl={mixAudioUrl}
      videoUrl={videoUrl}
    >
      <EditorShell />
    </DubbingEditorProvider>
  );
}

export default function DubbingEditorPage() {
  return (
    <Suspense fallback={<DubbingEditorLoading />}>
      <DubbingEditorPageInner />
    </Suspense>
  );
}

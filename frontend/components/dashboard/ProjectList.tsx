"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/utils/axios";
import ProjectCard, { type Project } from "./ProjectCard";

interface SubtitleJob {
  _id: string;
  originalFileName: string;
  fileType: "audio" | "video";
  duration: number;
  creditsUsed: number;
  status: string;
  createdAt: string;
  originalFileUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnailKey?: string | null;
}

interface DubbingJob {
  _id: string;
  originalFileName: string;
  fileType: "audio" | "video";
  duration: number;
  targetLanguage: string;
  status: string;
  createdAt: string;
  dubbedVideoUrl?: string | null;
  dubbedAudioUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnailKey?: string | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")} min`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DUBBING_STATUSES = new Set(["completed", "done"]);
const SUBTITLE_COMPLETED = new Set(["completed"]);

export default function ProjectList({
  limit = 5,
  title = "Recent Projects",
  showSeeAll = true,
  layout = "list",
}: {
  limit?: number;
  title?: string;
  showSeeAll?: boolean;
  layout?: "list" | "grid";
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      axiosInstance
        .get<{ jobs: SubtitleJob[] }>(`/api/subtitles?limit=${limit}`)
        .then((res) => res.data.jobs ?? [])
        .catch(() => [] as SubtitleJob[]),
      axiosInstance
        .get<{ jobs: DubbingJob[] }>(`/api/dubbing?limit=${limit}`)
        .then((res) => res.data.jobs ?? [])
        .catch(() => [] as DubbingJob[]),
    ])
      .then(([subtitleJobs, dubbingJobs]) => {
        const subtitleProjects: Project[] = subtitleJobs.map((job) => ({
          id: `subtitle-${job._id}`,
          name: job.originalFileName,
          meta: `Subtitles • ${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`,
          status: SUBTITLE_COMPLETED.has(job.status) ? "Ready" : "Syncing",
          icon: job.fileType === "video" ? "movie" : "mic",
          thumbnail:
            job.fileType === "video"
              ? (job.thumbnailUrl ?? job.originalFileUrl ?? undefined)
              : undefined,
          jobId: job._id,
          type: "subtitle" as const,
          createdAt: job.createdAt,
        }));

        const dubbingProjects: Project[] = dubbingJobs.map((job) => ({
          id: `dubbing-${job._id}`,
          name: job.originalFileName,
          meta: `Dubbing → ${job.targetLanguage} • ${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`,
          status: DUBBING_STATUSES.has(job.status) ? "Ready" : "Syncing",
          icon: "translate",
          thumbnail:
            job.fileType === "video"
              ? (job.thumbnailUrl ?? job.dubbedVideoUrl ?? undefined)
              : undefined,
          jobId: job._id,
          type: "dubbing" as const,
          createdAt: job.createdAt,
        }));

        const merged = [...subtitleProjects, ...dubbingProjects]
          .sort(
            (a, b) =>
              new Date(b.createdAt!).getTime() -
              new Date(a.createdAt!).getTime()
          )
          .slice(0, limit);

        setProjects(merged);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-xl font-extrabold text-on-surface font-headline">{title}</h3>
        </div>
        <div
          className={
            layout === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              : "space-y-3"
          }
        >
          {Array.from({ length: layout === "grid" ? 6 : 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-xl font-extrabold text-on-surface font-headline">{title}</h3>
        </div>
        <p className="text-sm text-on-surface-variant text-center py-8">
          Could not load projects. Please try again later.
        </p>
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-xl font-extrabold text-on-surface font-headline">{title}</h3>
        </div>
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3 block opacity-40">folder_open</span>
          <p className="text-sm font-medium">No projects yet. Upload a file to get started.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-xl font-extrabold text-on-surface font-headline">{title}</h3>
        {showSeeAll ? (
          <Link
            href="/dashboard/projects"
            className="text-sm font-bold text-primary hover:border-b-2 hover:border-primary flex items-center gap-1 font-label"
          >
            See All
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        ) : null}
      </div>

      <div
        className={
          layout === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            : "space-y-3"
        }
      >
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => {
              if (!project.jobId) return;
              if (project.type === "dubbing") {
                router.push(`/dashboard/dubbing/editor?jobId=${project.jobId}`);
              } else {
                router.push(`/dashboard/export?jobId=${project.jobId}`);
              }
            }}
            className="cursor-pointer"
          >
            <ProjectCard project={project} variant={layout === "grid" ? "grid" : "list"} />
          </div>
        ))}
      </div>
    </section>
  );
}

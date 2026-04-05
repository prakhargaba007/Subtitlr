"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axiosInstance
      .get<{ jobs: SubtitleJob[] }>("/api/subtitles?limit=5")
      .then((res) => {
        const mapped: Project[] = (res.data.jobs ?? []).map((job) => ({
          id: job._id,
          name: job.originalFileName,
          meta: `${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`,
          status: job.status === "completed" ? "Ready" : "Syncing",
          icon: job.fileType === "video" ? "movie" : "mic",
          jobId: job._id,
        }));
        setProjects(mapped);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-xl font-extrabold text-on-surface font-headline">Recent Projects</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
          <h3 className="text-xl font-extrabold text-on-surface font-headline">Recent Projects</h3>
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
          <h3 className="text-xl font-extrabold text-on-surface font-headline">Recent Projects</h3>
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
        <h3 className="text-xl font-extrabold text-on-surface font-headline">Recent Projects</h3>
        <a
          href="#"
          className="text-sm font-bold text-primary hover:underline flex items-center gap-1 font-label"
        >
          See All
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>

      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => project.jobId && router.push(`/dashboard/export?jobId=${project.jobId}`)}
            className="cursor-pointer"
          >
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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

export type FetchProjectPageArgs = {
  page: number; // 1-indexed
  pageSize: number;
  signal?: AbortSignal;
};

export type FetchProjectPageResult = {
  projects: Project[];
  /**
   * Total number of pages (for numbered pagination UI).
   * If omitted, the component falls back to "Prev/Next" using `hasMore`.
   */
  pageCount?: number;
  /**
   * Whether a next page exists (used when `pageCount` is not provided).
   */
  hasMore?: boolean;
};

export type FetchProjectPage = (
  args: FetchProjectPageArgs
) => Promise<FetchProjectPageResult>;

function mapSubtitleJobsToProjects(subtitleJobs: SubtitleJob[]): Project[] {
  return subtitleJobs.map((job) => ({
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
}

function mapDubbingJobsToProjects(dubbingJobs: DubbingJob[]): Project[] {
  return dubbingJobs.map((job) => ({
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
}

function mergeAndSortProjects(projects: Project[]): Project[] {
  return projects.sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );
}

async function defaultFetchProjectPage({
  page,
  pageSize,
  signal,
}: FetchProjectPageArgs): Promise<FetchProjectPageResult> {
  // We don't have a single "projects" endpoint yet, so to paginate a merged list
  // deterministically we fetch enough from each source to cover the next page too.
  const fetchLimit = (page + 1) * pageSize;

  const [subtitleRes, dubbingRes] = await Promise.all([
    axiosInstance
      .get<{ jobs: SubtitleJob[]; total?: number; pages?: number }>(
        `/api/subtitles?page=1&limit=${fetchLimit}`,
        { signal }
      )
      .then((res) => res.data),
    axiosInstance
      .get<{ jobs: DubbingJob[]; total?: number; pages?: number }>(
        `/api/dubbing?page=1&limit=${fetchLimit}`,
        { signal }
      )
      .then((res) => res.data),
  ]);

  const subtitleJobs = subtitleRes.jobs ?? [];
  const dubbingJobs = dubbingRes.jobs ?? [];

  const merged = mergeAndSortProjects([
    ...mapSubtitleJobsToProjects(subtitleJobs),
    ...mapDubbingJobsToProjects(dubbingJobs),
  ]);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const totalMerged =
    (typeof subtitleRes.total === "number" ? subtitleRes.total : 0) +
    (typeof dubbingRes.total === "number" ? dubbingRes.total : 0);
  const pageCount = Math.max(1, Math.ceil(totalMerged / pageSize));
  return {
    projects: merged.slice(start, end),
    pageCount,
    hasMore: page < pageCount,
  };
}

function getPaginationItems(
  current: number,
  total: number,
  siblingCount: number = 1
): Array<number | "ellipsis"> {
  if (total <= 1) return [1];

  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2*siblings, 2 ellipsis
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => total - rightItemCount + 1 + i
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

export default function ProjectList({
  limit,
  pageSize,
  title = "Recent Projects",
  showSeeAll = true,
  layout = "list",
  initialPage = 1,
  fetchPage,
  onProjectClick,
}: {
  /**
   * @deprecated Use `pageSize` instead. Kept for backwards compatibility.
   */
  limit?: number;
  pageSize?: number;
  title?: string;
  showSeeAll?: boolean;
  layout?: "list" | "grid";
  initialPage?: number;
  fetchPage?: FetchProjectPage;
  onProjectClick?: (project: Project) => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const effectivePageSize = pageSize ?? limit ?? 5;
  const effectiveFetchPage = useMemo(
    () => fetchPage ?? defaultFetchProjectPage,
    [fetchPage]
  );

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    effectiveFetchPage({
      page,
      pageSize: effectivePageSize,
      signal: controller.signal,
    })
      .then((res) => {
        setProjects(res.projects);
        setPageCount(typeof res.pageCount === "number" ? res.pageCount : null);
        setHasMore(typeof res.hasMore === "boolean" ? res.hasMore : null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(true);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [effectiveFetchPage, effectivePageSize, page]);

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
          {page > 1 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">No projects on this page.</p>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:border-b-2 hover:border-primary font-label"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
                Back to previous page
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium">No projects yet. Upload a file to get started.</p>
          )}
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
              if (onProjectClick) return onProjectClick(project);
              if (!project.jobId) return;
              router.push(
                project.type === "dubbing"
                  ? `/dashboard/dubbing/editor?jobId=${project.jobId}`
                  : `/dashboard/export?jobId=${project.jobId}`
              );
            }}
            className="cursor-pointer"
          >
            <ProjectCard project={project} variant={layout === "grid" ? "grid" : "list"} />
          </div>
        ))}
      </div>

      {pageCount && pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-1 mt-5" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            className="h-9 w-9 grid place-items-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
            aria-label="Previous page"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>

          {getPaginationItems(page, pageCount).map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                className="h-9 px-2 grid place-items-center text-on-surface-variant select-none"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                disabled={loading}
                aria-current={item === page ? "page" : undefined}
                className={
                  item === page
                    ? "h-9 min-w-9 px-3 rounded-xl bg-primary text-on-primary text-sm font-extrabold"
                    : "h-9 min-w-9 px-3 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-40"
                }
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page >= pageCount}
            className="h-9 w-9 grid place-items-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
            aria-label="Next page"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </nav>
      ) : page > 1 || hasMore ? (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            className="h-9 px-3 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
            aria-label="Previous page"
          >
            <span className="material-symbols-outlined text-base align-[-2px]">chevron_left</span>
            Prev
          </button>
          <span className="text-xs font-bold text-on-surface-variant tabular-nums min-w-[64px] text-center">
            Page {page}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || hasMore === false}
            className="h-9 px-3 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant"
            aria-label="Next page"
          >
            Next
            <span className="material-symbols-outlined text-base align-[-2px]">chevron_right</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

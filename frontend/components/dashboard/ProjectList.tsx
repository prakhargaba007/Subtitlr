"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/utils/axios";
import ProjectCard, { type Project, type ProjectAction } from "./ProjectCard";
import Pagination from "@/components/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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

/** Row from GET /api/projects */
interface ApiProjectRow {
  _id: string;
  kind: "subtitle" | "dubbing";
  displayName: string | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  job: SubtitleJob | DubbingJob;
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

function mapApiProjectRowToProject(row: ApiProjectRow): Project {
  if (row.kind === "subtitle") {
    const job = row.job as SubtitleJob;
    return {
      id: `project-${row._id}`,
      projectId: row._id,
      name: row.displayName ?? job.originalFileName,
      meta: `Subtitles • ${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`,
      status: SUBTITLE_COMPLETED.has(job.status) ? "Ready" : "Syncing",
      icon: job.fileType === "video" ? "movie" : "mic",
      thumbnail:
        job.fileType === "video"
          ? (job.thumbnailUrl ?? job.originalFileUrl ?? undefined)
          : undefined,
      jobId: job._id,
      type: "subtitle",
      createdAt: job.createdAt,
      pinnedAt: row.pinnedAt ?? null,
      archivedAt: row.archivedAt ?? null,
    };
  }
  const job = row.job as DubbingJob;
  return {
    id: `project-${row._id}`,
    projectId: row._id,
    name: row.displayName ?? job.originalFileName,
    meta: `Dubbing → ${job.targetLanguage} • ${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`,
    status: DUBBING_STATUSES.has(job.status) ? "Ready" : "Syncing",
    icon: "translate",
    thumbnail:
      job.fileType === "video"
        ? (job.thumbnailUrl ?? job.dubbedVideoUrl ?? undefined)
        : undefined,
    jobId: job._id,
    type: "dubbing",
    createdAt: job.createdAt,
    pinnedAt: row.pinnedAt ?? null,
    archivedAt: row.archivedAt ?? null,
    dubbedVideoUrl: job.dubbedVideoUrl ?? null,
    dubbedAudioUrl: job.dubbedAudioUrl ?? null,
  };
}

async function defaultFetchProjectPage({
  page,
  pageSize,
  signal,
}: FetchProjectPageArgs): Promise<FetchProjectPageResult> {
  const res = await axiosInstance.get<{
    projects: ApiProjectRow[];
    pages?: number;
    total?: number;
    page?: number;
  }>(`/api/projects?page=${page}&limit=${pageSize}`, { signal });

  const rows = res.data.projects ?? [];
  const mapped = rows.map(mapApiProjectRowToProject);
  const total = res.data.total ?? 0;
  const pagesFromApi = res.data.pages;
  const pageCount = Math.max(
    1,
    typeof pagesFromApi === "number" && pagesFromApi > 0
      ? pagesFromApi
      : Math.ceil(total / pageSize) || 1
  );
  return {
    projects: mapped,
    pageCount,
    hasMore: page < pageCount,
  };
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
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "delete" | "rename" | "unpin" | null;
    project: Project | null;
    inputValue: string;
    isConfirming: boolean;
  }>({
    isOpen: false,
    type: null,
    project: null,
    inputValue: "",
    isConfirming: false,
  });

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
  }, [effectiveFetchPage, effectivePageSize, page, refreshNonce]);

  const handleAction = async (action: ProjectAction, project: Project) => {
    if (!project.jobId || !project.type) return;

    const needsProjectId =
      action === "rename" ||
      action === "pin" ||
      action === "unpin" ||
      action === "delete" ||
      action === "restore";
    if (needsProjectId && !project.projectId) return;

    if (action === "open") {
      if (project.type === "dubbing") {
        router.push(`/dashboard/dubbing/export?jobId=${project.jobId}`);
      } else {
        router.push(`/dashboard/export?jobId=${project.jobId}`);
      }
      return;
    }

    if (action === "copyLink") {
      const href =
        project.type === "dubbing"
          ? `${window.location.origin}/dashboard/dubbing/export?jobId=${project.jobId}`
          : `${window.location.origin}/dashboard/export?jobId=${project.jobId}`;
      try {
        await navigator.clipboard.writeText(href);
      } catch {
        // Ignore clipboard failures (e.g. non-secure context)
      }
      return;
    }

    if (action === "download") {
      if (project.type === "subtitle") {
        // Default to SRT; you can expand this to a sub-menu later.
        window.open(`/api/subtitles/${project.jobId}/export?format=srt`, "_blank");
      } else {
        const url = project.dubbedVideoUrl ?? project.dubbedAudioUrl;
        if (url) window.open(url, "_blank");
      }
      return;
    }

    if (action === "details") {
      setDetailsProject(project);
      return;
    }

    if (action === "rename" || action === "unpin" || action === "delete") {
      setModalState({
        isOpen: true,
        type: action,
        project,
        inputValue: action === "rename" ? project.name : "",
        isConfirming: false,
      });
      return;
    }

    try {
      if (action === "pin") {
        await axiosInstance.post(`/api/projects/${project.projectId}/pin`);
      } else if (action === "restore") {
        await axiosInstance.post(`/api/projects/${project.projectId}/restore`);
      }
    } finally {
      setRefreshNonce((n) => n + 1);
    }
  };

  const confirmAction = async () => {
    if (!modalState.project || !modalState.type) return;
    setModalState((s) => ({ ...s, isConfirming: true }));
    try {
      if (modalState.type === "rename") {
        const nextName = modalState.inputValue.trim();
        if (!nextName) {
          setModalState((s) => ({ ...s, isConfirming: false }));
          return;
        }
        await axiosInstance.patch(`/api/projects/${modalState.project.projectId}`, {
          displayName: nextName,
        });
      } else if (modalState.type === "unpin") {
        await axiosInstance.post(`/api/projects/${modalState.project.projectId}/unpin`);
      } else if (modalState.type === "delete") {
        setProjects((prev) => prev.filter((p) => p.id !== modalState.project!.id));
        await axiosInstance.post(`/api/projects/${modalState.project.projectId}/archive`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshNonce((n) => n + 1);
      setModalState((s) => ({ ...s, isOpen: false, isConfirming: false }));
    }
  };

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
                  ? `/dashboard/dubbing/export?jobId=${project.jobId}`
                  : `/dashboard/export?jobId=${project.jobId}`
              );
            }}
            className="cursor-pointer"
          >
            <ProjectCard
              project={project}
              variant={layout === "grid" ? "grid" : "list"}
              onAction={handleAction}
            />
          </div>
        ))}
      </div>

      {detailsProject ? (
        <div
          className="fixed inset-0 z-60 bg-black/40 flex items-center justify-center p-4"
          onMouseDown={() => setDetailsProject(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-surface-container border border-outline-variant/20 p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-lg font-extrabold text-on-surface font-headline truncate">
                  {detailsProject.name}
                </h4>
                <p className="text-xs text-on-surface-variant font-medium mt-1">{detailsProject.meta}</p>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-xl hover:bg-surface-container-high grid place-items-center text-on-surface-variant"
                onClick={() => setDetailsProject(null)}
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Type</span>
                <span className="font-medium">{detailsProject.type}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Status</span>
                <span className="font-medium">{detailsProject.status}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Project ID</span>
                <span className="font-mono text-xs break-all">{detailsProject.projectId ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Job ID</span>
                <span className="font-mono text-xs break-all">{detailsProject.jobId}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Pinned</span>
                <span className="font-medium">{detailsProject.pinnedAt ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Archived</span>
                <span className="font-medium">{detailsProject.archivedAt ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pageCount && pageCount > 1 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          disabled={loading}
          onPageChange={(p) => setPage(p)}
          className="mt-5"
        />
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

      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((s) => ({ ...s, isOpen: false }))}
        title={
          modalState.type === "delete"
            ? "Delete project?"
            : modalState.type === "rename"
            ? "Rename project"
            : "Unpin project?"
        }
        description={
          modalState.type === "rename" ? (
            <div className="mt-2">
              <input
                type="text"
                autoFocus
                value={modalState.inputValue}
                onChange={(e) => setModalState((s) => ({ ...s, inputValue: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                placeholder="Project name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmAction();
                  }
                }}
              />
            </div>
          ) : modalState.type === "delete" ? (
            "Delete this project? You can restore it later."
          ) : (
            "Are you sure you want to unpin this project?"
          )
        }
        confirmText={
          modalState.type === "delete"
            ? "Yes, delete"
            : modalState.type === "rename"
            ? "Save changes"
            : "Yes, unpin"
        }
        confirmingText={
          modalState.type === "delete"
            ? "Deleting..."
            : modalState.type === "rename"
            ? "Saving..."
            : "Unpinning..."
        }
        cancelText="Cancel"
        isConfirming={modalState.isConfirming}
        confirmVariant={
          modalState.type === "delete" || modalState.type === "unpin" ? "danger" : "primary"
        }
        onConfirm={confirmAction}
      />
    </section>
  );
}

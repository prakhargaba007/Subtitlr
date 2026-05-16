"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axios";

interface ApiProjectRow {
  _id: string;
  kind: "subtitle" | "dubbing";
  displayName: string | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  job: {
    _id: string;
    originalFileName: string;
    fileType: "audio" | "video";
    duration: number;
    targetLanguage?: string;
    status: string;
    createdAt: string;
    originalFileUrl?: string | null;
    dubbedVideoUrl?: string | null;
    thumbnailUrl?: string | null;
    thumbnailKey?: string | null;
  };
}

interface SearchProjectResult {
  projectId: string;
  jobId: string;
  kind: "subtitle" | "dubbing";
  name: string;
  meta: string;
  href: string;
  icon: string;
  thumbnail?: string;
  typeLabel: string;
  pinned: boolean;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00 min";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")} min`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function mapSearchProjectResult(row: ApiProjectRow): SearchProjectResult {
  const job = row.job;
  const isDubbing = row.kind === "dubbing";
  const href = isDubbing
    ? `/dashboard/dubbing/export?jobId=${job._id}`
    : `/dashboard/export?jobId=${job._id}`;
  const meta = isDubbing
    ? `Dubbing${job.targetLanguage ? ` -> ${job.targetLanguage}` : ""} • ${timeAgo(job.createdAt)}`
    : `Subtitles • ${timeAgo(job.createdAt)} • ${formatDuration(job.duration)}`;

  return {
    projectId: row._id,
    jobId: job._id,
    kind: row.kind,
    name: row.displayName ?? job.originalFileName,
    meta,
    href,
    icon: isDubbing ? "translate" : job.fileType === "video" ? "movie" : "mic",
    thumbnail: job.thumbnailUrl ?? undefined,
    typeLabel: isDubbing ? "Dubbing" : "Captions",
    pinned: Boolean(row.pinnedAt),
  };
}

export default function ProjectSearchModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProjectResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchQuery.trim();
      setDebouncedSearch(nextSearch);
      setSearchLoading(Boolean(nextSearch));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!open || !debouncedSearch) {
      return;
    }

    const controller = new AbortController();
    axiosInstance
      .get<{
        projects: ApiProjectRow[];
      }>(
        `/api/projects?${new URLSearchParams({
          page: "1",
          limit: "6",
          search: debouncedSearch,
        }).toString()}`,
        { signal: controller.signal },
      )
      .then((res) => {
        const projects = res.data.projects ?? [];
        setSearchResults(projects.map(mapSearchProjectResult));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setSearchResults([]);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setSearchLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, open]);

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSearchResults([]);
    setSearchLoading(false);
  };

  const closeSearch = () => {
    onOpenChange(false);
  };

  const openProjectResult = (project: SearchProjectResult) => {
    clearSearch();
    onOpenChange(false);
    router.push(project.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center bg-black/40 px-4 pt-20 backdrop-blur-sm sm:pt-28"
      onMouseDown={closeSearch}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-4xl border border-outline-variant/20 bg-surface-container-lowest shadow-[0_30px_100px_-35px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search projects"
      >
        <div className="flex items-center gap-3 border-b border-outline-variant/15 px-5 py-4">
          <span className="material-symbols-outlined text-xl text-primary">manage_search</span>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setSearchQuery(nextQuery);
              if (!nextQuery.trim()) {
                setSearchResults([]);
                setSearchLoading(false);
              }
            }}
            placeholder="Search captions, dubbing, files, languages..."
            className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold text-on-surface outline-none placeholder:text-outline/70"
            aria-label="Search projects"
          />
          {/* {searchQuery ? (
            <button
              type="button"
              onClick={clearSearch}
              className="grid h-9 w-9 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              aria-label="Clear project search"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          ) : null} */}
          <button
            type="button"
            onClick={closeSearch}
            className="grid h-9 w-9 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            aria-label="Close project search"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!searchQuery.trim() ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-bold text-on-surface">Find any project fast</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Search by project name, file name, language, status, captions, or dubbing.
              </p>
            </div>
          ) : searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : searchResults.length ? (
            <div className="space-y-1.5">
              {searchResults.map((project) => {
                const isDubbing = project.kind === "dubbing";
                return (
                  <button
                    key={project.projectId}
                    type="button"
                    onClick={() => openProjectResult(project)}
                    className="group flex w-full items-center gap-3 rounded-3xl px-3 py-3 text-left transition-colors hover:bg-surface-container"
                  >
                    <span
                      className={[
                        "relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-[24px]",
                        project.thumbnail
                          ? "bg-surface-container"
                          : isDubbing
                            ? "bg-purple-50 text-purple-600"
                            : "bg-primary/10 text-primary",
                      ].join(" ")}
                    >
                      {project.thumbnail ? (
                        <Image
                          alt=""
                          src={project.thumbnail}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined">{project.icon}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-extrabold text-on-surface font-headline">
                          {project.name}
                        </span>
                        {project.pinned ? (
                          <span
                            className="material-symbols-outlined shrink-0 text-sm text-primary"
                            style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
                            aria-label="Pinned"
                          >
                            keep
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider font-label",
                            isDubbing ? "bg-purple-50 text-purple-700" : "bg-primary/10 text-primary",
                          ].join(" ")}
                        >
                          {project.typeLabel}
                        </span>
                        <span className="truncate text-[11px] font-medium text-on-surface-variant">
                          {project.meta}
                        </span>
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-lg text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100">
                      arrow_forward
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-bold text-on-surface">
                No projects found for &quot;{debouncedSearch || searchQuery.trim()}&quot;.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Try a file name, language, caption, or dubbing keyword.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/15 px-5 py-3 text-[11px] font-bold text-on-surface-variant">
          <span>Press Enter by selecting a result</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

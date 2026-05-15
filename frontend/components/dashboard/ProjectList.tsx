"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/utils/axios";
import ProjectCard, { type Project, type ProjectAction } from "./ProjectCard";
import Pagination from "@/components/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import SearchableDropdown, { type SearchableDropdownOption } from "@/components/ui/SearchableDropdown";

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

export function parseProjectFilters(params: URLSearchParams | null): ProjectFilters {
  const type = params?.get("type");
  const created = params?.get("created");
  const status = params?.get("status");
  const sort = params?.get("sort");

  return {
    type:
      type === "subtitle" || type === "dubbing"
        ? type
        : DEFAULT_PROJECT_FILTERS.type,
    created:
      created === "today" || created === "7d" || created === "30d"
        ? created
        : DEFAULT_PROJECT_FILTERS.created,
    status:
      status === "ready" || status === "processing" || status === "failed"
        ? status
        : DEFAULT_PROJECT_FILTERS.status,
    sort:
      sort === "newest" || sort === "oldest" || sort === "pinned"
        ? sort
        : DEFAULT_PROJECT_FILTERS.sort,
  };
}

export { DEFAULT_PROJECT_FILTERS };

function getFilterLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

const DUBBING_STATUSES = new Set(["completed", "done"]);
const SUBTITLE_COMPLETED = new Set(["completed"]);

type ProjectTypeFilter = "all" | "subtitle" | "dubbing";
type ProjectCreatedFilter = "all" | "today" | "7d" | "30d";
type ProjectStatusFilter = "all" | "ready" | "processing" | "failed";
type ProjectSortFilter = "newest" | "oldest" | "pinned";

export type ProjectFilters = {
  type: ProjectTypeFilter;
  created: ProjectCreatedFilter;
  status: ProjectStatusFilter;
  sort: ProjectSortFilter;
};

const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  type: "all",
  created: "all",
  status: "all",
  sort: "pinned",
};

const TYPE_FILTER_OPTIONS: Array<SearchableDropdownOption & { value: ProjectTypeFilter }> = [
  { value: "all", label: "All types", icon: "folder" },
  { value: "subtitle", label: "Captions", icon: "closed_caption" },
  { value: "dubbing", label: "Dubbing", icon: "translate" },
];

const CREATED_FILTER_OPTIONS: Array<SearchableDropdownOption & { value: ProjectCreatedFilter }> = [
  { value: "all", label: "All time", icon: "calendar_month" },
  { value: "today", label: "Today", icon: "today" },
  { value: "7d", label: "Last 7 days", icon: "date_range" },
  { value: "30d", label: "Last 30 days", icon: "date_range" },
];

const STATUS_FILTER_OPTIONS: Array<SearchableDropdownOption & { value: ProjectStatusFilter }> = [
  { value: "all", label: "All statuses", icon: "pending_actions" },
  { value: "ready", label: "Ready", icon: "check_circle" },
  { value: "processing", label: "Processing", icon: "sync" },
  { value: "failed", label: "Failed", icon: "error" },
];

const SORT_FILTER_OPTIONS: Array<SearchableDropdownOption & { value: ProjectSortFilter }> = [
  { value: "pinned", label: "Pinned first", icon: "keep" },
  { value: "newest", label: "Newest", icon: "south" },
  { value: "oldest", label: "Oldest", icon: "north" },
];

export type FetchProjectPageArgs = {
  page: number; // 1-indexed
  pageSize: number;
  search?: string;
  filters?: ProjectFilters;
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
  search,
  filters,
  signal,
}: FetchProjectPageArgs): Promise<FetchProjectPageResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (filters) {
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.created !== "all") params.set("created", filters.created);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.sort !== "pinned") params.set("sort", filters.sort);
  }

  const res = await axiosInstance.get<{
    projects: ApiProjectRow[];
    pages?: number;
    total?: number;
    page?: number;
  }>(`/api/projects?${params.toString()}`, { signal });

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
  searchable = false,
  searchPlaceholder = "Search projects, files, languages...",
  showFilters = false,
  initialFilters,
  onFiltersChange,
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
  searchable?: boolean;
  searchPlaceholder?: string;
  showFilters?: boolean;
  initialFilters?: ProjectFilters;
  onFiltersChange?: (filters: ProjectFilters) => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<ProjectFilters>(() =>
    showFilters ? (initialFilters ?? DEFAULT_PROJECT_FILTERS) : DEFAULT_PROJECT_FILTERS,
  );
  const [draftFilters, setDraftFilters] = useState<ProjectFilters>(filters);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
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
    if (!showFilters) return;
    const nextFilters = initialFilters ?? DEFAULT_PROJECT_FILTERS;
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
  }, [initialFilters, showFilters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    effectiveFetchPage({
      page,
      pageSize: effectivePageSize,
      search: debouncedSearch,
      filters,
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
  }, [debouncedSearch, effectiveFetchPage, effectivePageSize, filters, page, refreshNonce]);

  const hasActiveFilters =
    filters.type !== DEFAULT_PROJECT_FILTERS.type ||
    filters.created !== DEFAULT_PROJECT_FILTERS.created ||
    filters.status !== DEFAULT_PROJECT_FILTERS.status ||
    filters.sort !== DEFAULT_PROJECT_FILTERS.sort;

  const syncFiltersToUrl = (nextFilters: ProjectFilters) => {
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    onFiltersChange?.(nextFilters);
  };

  const updateDraftFilter = <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeFilterSummary = [
    filters.type !== "all" ? getFilterLabel(TYPE_FILTER_OPTIONS, filters.type) : null,
    filters.created !== "all" ? getFilterLabel(CREATED_FILTER_OPTIONS, filters.created) : null,
    filters.status !== "all" ? getFilterLabel(STATUS_FILTER_OPTIONS, filters.status) : null,
    filters.sort !== "pinned" ? getFilterLabel(SORT_FILTER_OPTIONS, filters.sort) : null,
  ].filter(Boolean);

  const filterControl = showFilters ? (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-2">
      <button
        type="button"
        onClick={() => {
          setDraftFilters(filters);
          setFilterModalOpen(true);
        }}
        className={[
          "inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-extrabold transition-all font-label",
          hasActiveFilters
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:text-on-surface",
        ].join(" ")}
      >
        <span className="material-symbols-outlined text-base">filter_list</span>
        Filters
        {hasActiveFilters ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] text-on-primary">
            {activeFilterSummary.length}
          </span>
        ) : null}
      </button>
      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterSummary.map((label) => (
            <span
              key={label}
              className="rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface-variant"
            >
              {label}
            </span>
          ))}
          <button
            type="button"
            onClick={() => syncFiltersToUrl(DEFAULT_PROJECT_FILTERS)}
            className="text-sm font-bold text-primary hover:border-b-2 hover:border-primary"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  const filterModal = showFilters && filterModalOpen ? (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 cursor-default"
        onClick={() => setFilterModalOpen(false)}
      />
      <div className="relative w-full max-w-xl rounded-4xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* <p className="text-xs font-extrabold uppercase tracking-wider text-primary font-label">
              Project filters
            </p> */}
            <h4 className="mt-1 text-2xl font-extrabold text-on-surface font-headline">
              Filter your projects
            </h4>
            {/* <p className="mt-1 text-sm text-on-surface-variant">
              Filter by type, creation time, status, and sort order.
            </p> */}
          </div>
          <button
            type="button"
            onClick={() => setFilterModalOpen(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-on-surface-variant hover:bg-surface-container"
            aria-label="Close filters"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant font-label">
              Type
            </label>
            <SearchableDropdown
              options={TYPE_FILTER_OPTIONS}
              value={draftFilters.type}
              onChange={(value) => updateDraftFilter("type", value as ProjectTypeFilter)}
              searchPlaceholder="Search type..."
              icon="folder"
              searchable={false}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant font-label">
              Created
            </label>
            <SearchableDropdown
              options={CREATED_FILTER_OPTIONS}
              value={draftFilters.created}
              onChange={(value) => updateDraftFilter("created", value as ProjectCreatedFilter)}
              searchPlaceholder="Search date..."
              icon="calendar_month"
              searchable={false}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant font-label">
              Status
            </label>
            <SearchableDropdown
              options={STATUS_FILTER_OPTIONS}
              value={draftFilters.status}
              onChange={(value) => updateDraftFilter("status", value as ProjectStatusFilter)}
              searchPlaceholder="Search status..."
              icon="pending_actions"
              searchable={false}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-on-surface-variant font-label">
              Sort
            </label>
            <SearchableDropdown
              options={SORT_FILTER_OPTIONS}
              value={draftFilters.sort}
              onChange={(value) => updateDraftFilter("sort", value as ProjectSortFilter)}
              searchPlaceholder="Search sort..."
              icon="sort"
              searchable={false}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              syncFiltersToUrl(DEFAULT_PROJECT_FILTERS);
              setFilterModalOpen(false);
            }}
            className="h-11 rounded-2xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            Reset filters
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterModalOpen(false)}
              className="h-11 rounded-2xl border border-outline-variant/20 px-4 text-sm font-bold text-on-surface hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                syncFiltersToUrl(draftFilters);
                setFilterModalOpen(false);
              }}
              className="h-11 rounded-2xl bg-primary px-5 text-sm font-bold text-on-primary hover:opacity-90"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const header = (
    <div className="flex flex-col gap-3 mb-6 px-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-xl font-extrabold text-on-surface font-headline">{title}</h3>
      <div className="flex items-center gap-3">
        {searchable ? (
          <label className="relative block w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">
              search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-2xl border border-outline-variant/20 bg-surface-container-low pl-10 pr-10 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-outline/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
              aria-label="Search projects"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                aria-label="Clear project search"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            ) : null}
          </label>
        ) : null}
        {showSeeAll ? (
          <Link
            href="/dashboard/projects"
            className="shrink-0 text-sm font-bold text-primary hover:border-b-2 hover:border-primary flex items-center gap-1 font-label"
          >
            See All
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        ) : null}
      </div>
    </div>
  );

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
        {header}
        {filterControl}
        {filterModal}
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
        {header}
        {filterControl}
        {filterModal}
        <p className="text-sm text-on-surface-variant text-center py-8">
          Could not load projects. Please try again later.
        </p>
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section>
        {header}
        {filterControl}
        {filterModal}
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3 block opacity-40">folder_open</span>
          {debouncedSearch || hasActiveFilters ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {debouncedSearch
                  ? `No projects found for "${debouncedSearch}".`
                  : "No projects match these filters."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  syncFiltersToUrl(DEFAULT_PROJECT_FILTERS);
                }}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:border-b-2 hover:border-primary font-label"
              >
                Clear filters
              </button>
            </div>
          ) : page > 1 ? (
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
      <div className="max-w-9xl mx-auto flex flex-row justify-between items-center">
        {header}
        {filterControl}
      </div>

      {filterModal}

      <div
        className={
          layout === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            : "space-y-3"
        }
      >
        {projects.map((project, index) => (
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
              priorityThumbnail={index === 0}
              eagerThumbnail={layout === "grid" ? index < 3 : index === 0}
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

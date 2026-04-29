import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Project {
  id: string | number;
  /** Dashboard row id — use for /api/projects/:projectId actions */
  projectId?: string;
  name: string;
  meta: string;
  status: "Ready" | "Syncing";
  thumbnail?: string;
  icon?: string;
  jobId?: string;
  type?: "subtitle" | "dubbing";
  createdAt?: string;
  pinnedAt?: string | null;
  archivedAt?: string | null;
  dubbedVideoUrl?: string | null;
  dubbedAudioUrl?: string | null;
}

export type ProjectAction =
  | "open"
  | "copyLink"
  | "download"
  | "rename"
  | "pin"
  | "unpin"
  | "delete"
  | "restore"
  | "details";

export default function ProjectCard({
  project,
  variant = "list",
  onAction,
}: {
  project: Project;
  variant?: "list" | "grid";
  onAction?: (action: ProjectAction, project: Project) => void;
}) {
  const isReady = project.status === "Ready";
  const mediaUrl = project.thumbnail ?? null;
  const isVideoThumb = !!mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl);

  const isGrid = variant === "grid";
  const isPinned = !!project.pinnedAt;
  const isArchived = !!project.archivedAt;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuItems = useMemo(() => {
    const items: Array<{
      id: ProjectAction;
      label: string;
      icon: string;
      hidden?: boolean;
      danger?: boolean;
      disabled?: boolean;
    }> = [
      { id: "open", label: "Open", icon: "open_in_new" },
      { id: "copyLink", label: "Copy link", icon: "link" },
      {
        id: "download",
        label: "Download",
        icon: "download",
        hidden: !isReady,
      },
      { id: "details", label: "Details", icon: "info" },
      { id: "rename", label: "Rename", icon: "edit" },
      isPinned
        ? { id: "unpin", label: "Unpin", icon: "keep_off" }
        : { id: "pin", label: "Pin", icon: "keep" },
      isArchived
        ? { id: "restore", label: "Restore", icon: "restore" }
        : { id: "delete", label: "Delete", icon: "delete", danger: true },
    ];

    return items.filter((i) => !i.hidden);
  }, [isArchived, isPinned, isReady]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  return (
    <div
      className={[
        "group bg-surface-container-lowest hover:bg-surface-container-low p-4 rounded-2xl transition-all border border-outline-variant/20 hover:border-primary/20 editorial-glow",
        isGrid ? "flex flex-col gap-3" : "flex items-center gap-4",
      ].join(" ")}
    >
      {/* Thumbnail / icon */}
      <div
        className={[
          "rounded-xl overflow-hidden shrink-0 relative bg-surface-container",
          isGrid ? "w-full aspect-video" : "w-14 h-14",
        ].join(" ")}
      >
        {mediaUrl ? (
          <>
            {isVideoThumb ? (
              <video
                className="w-full h-full object-cover"
                src={mediaUrl}
                preload="metadata"
                muted
                playsInline
              />
            ) : (
              <Image
                alt="Thumbnail"
                className="w-full h-full object-cover"
                src={mediaUrl}
                width={100}
                height={100}
              />
            )}
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">{project.icon}</span>
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className={isGrid ? "w-full min-w-0" : "flex-1 min-w-0"}>
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="font-bold text-on-surface truncate text-sm font-headline min-w-0 flex-1">
            {project.name}
          </h4>
          {isPinned ? (
            <span
              className="material-symbols-outlined shrink-0 text-base text-primary"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
              aria-label="Pinned"
              title="Pinned"
            >
              keep
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-on-surface-variant font-medium font-body">{project.meta}</p>
      </div>

      {/* Status badge + menu */}
      <div className={isGrid ? "flex items-center justify-between gap-3" : "flex items-center gap-3"}>
        {isReady ? (
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-extrabold uppercase tracking-wider border border-green-100 font-label">
            {project.status}
          </span>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-wider border border-primary/20 font-label">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {project.status}
          </div>
        )}
        {onAction ? (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* {!isArchived ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAction("delete", project);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-all"
                aria-label="Delete project"
                title="Delete project"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            ) : null} */}
            <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container transition-all"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Project actions"
            >
              <span className="material-symbols-outlined text-sm">more_vert</span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-9 z-50 min-w-[180px] rounded-2xl border border-outline-variant/20 bg-surface-container shadow-lg overflow-hidden"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      onAction(item.id, project);
                    }}
                    className={[
                      "w-full px-3 py-2.5 text-left flex items-center gap-2 text-sm font-bold transition-colors",
                      item.danger
                        ? "text-red-600 hover:bg-red-50"
                        : "text-on-surface-variant hover:bg-surface-container-high",
                      item.disabled ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    <span className="material-symbols-outlined text-base">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

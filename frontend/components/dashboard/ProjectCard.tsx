export interface Project {
  id: string | number;
  name: string;
  meta: string;
  status: "Ready" | "Syncing";
  thumbnail?: string;
  icon?: string;
  jobId?: string;
  type?: "subtitle" | "dubbing";
  createdAt?: string;
}

export default function ProjectCard({ project }: { project: Project }) {
  const isReady = project.status === "Ready";

  return (
    <div className="group bg-surface-container-lowest hover:bg-surface-container-low p-4 rounded-2xl flex items-center gap-4 transition-all border border-outline-variant/20 hover:border-primary/20 editorial-glow">
      {/* Thumbnail / icon */}
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative">
        {project.thumbnail ? (
          <>
            <img
              alt="Thumbnail"
              className="w-full h-full object-cover"
              src={project.thumbnail}
            />
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
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-on-surface truncate text-sm font-headline">{project.name}</h4>
        <p className="text-[11px] text-on-surface-variant font-medium font-body">{project.meta}</p>
      </div>

      {/* Status badge + menu */}
      <div className="flex items-center gap-3">
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
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container transition-all">
          <span className="material-symbols-outlined text-sm">more_vert</span>
        </button>
      </div>
    </div>
  );
}

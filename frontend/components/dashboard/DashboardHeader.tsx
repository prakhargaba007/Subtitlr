export default function DashboardHeader() {
  return (
    <header className="fixed top-0 right-0 left-20 lg:left-64 h-16 z-40 glass-nav border-b border-outline-variant/20 flex items-center justify-between px-8 backdrop-blur-sm">
      <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest font-label">
        Dynamic Launchpad
      </h2>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
            search
          </span>
          <input
            className="bg-surface-container border-none rounded-full py-1.5 pl-9 pr-4 text-xs w-48 focus:w-64 transition-all focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant outline-none font-body"
            placeholder="Jump to project..."
            type="text"
          />
        </div>

        {/* Notifications */}
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-xl">notifications</span>
        </button>
      </div>
    </header>
  );
}

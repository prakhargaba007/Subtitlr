const ACTIVITY_FEED = [
  {
    id: 1,
    icon: "check_circle",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    title: "Credits Top-up",
    desc: "500 credits added successfully.",
    time: "2h ago",
  },
  {
    id: 2,
    icon: "bolt",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "New Feature",
    desc: "AI Summaries are now available.",
    time: "Yesterday",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-4 font-headline">
      {children}
    </h3>
  );
}

export default function DashboardRightPanel() {
  return (
    <aside className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] border-l border-outline-variant/20 bg-surface-container-lowest z-30 hidden xl:flex flex-col">
      <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">

        {/* Quick Stats */}
        <section>
          <SectionLabel>Quick Stats</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            {/* Usage */}
            <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/20 editorial-glow">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase font-label">Usage</p>
                <span className="text-[10px] font-bold text-primary font-label">84%</span>
              </div>
              <p className="text-xl font-extrabold text-on-surface font-headline">
                420
                <span className="text-sm text-on-surface-variant font-normal">/500</span>
              </p>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: "84%" }} />
              </div>
            </div>

            {/* Saved + Files */}
            <div className="flex gap-3">
              {[
                { label: "Saved", value: "42.5h" },
                { label: "Files", value: "1.2k" },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 p-4 rounded-2xl bg-surface-container border border-outline-variant/20">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-label">{label}</p>
                  <p className="text-xl font-extrabold text-on-surface font-headline">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Recent Activity</SectionLabel>
            <button className="text-[10px] font-bold text-primary hover:underline font-label -mt-4">
              Clear
            </button>
          </div>
          <div className="space-y-5">
            {ACTIVITY_FEED.map(({ id, icon, iconBg, iconColor, title, desc, time }) => (
              <div key={id} className="flex gap-3">
                <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined ${iconColor} text-sm`}>{icon}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface font-headline">{title}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 font-body">{desc}</p>
                  <span className="text-[9px] text-on-surface-variant uppercase mt-1 block font-label">{time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Billing card */}
        <div className="p-4 rounded-2xl bg-primary text-on-primary">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1 font-label">Next Billing</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-extrabold font-headline">$29.00</h4>
            <p className="text-[10px] font-medium opacity-80 font-label">Nov 12</p>
          </div>
          <button className="w-full mt-4 py-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl text-xs font-bold font-headline">
            Manage Billing
          </button>
        </div>

      </div>
    </aside>
  );
}

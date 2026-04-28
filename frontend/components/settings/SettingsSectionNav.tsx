"use client";

export type SettingsSectionId =
  | "general"
  | "account"
  | "notifications"
  | "billing"
  ;

export default function SettingsSectionNav({
  sections,
  activeSection,
  onSelect,
}: {
  sections: Array<{ id: SettingsSectionId; label: string }>;
  activeSection: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-6 h-fit">
      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-2">
        {sections.map((s) => {
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={[
                "w-full text-left px-4 py-2.5 rounded-xl text-sm font-body transition-colors",
                active
                  ? "bg-surface-container text-on-surface font-semibold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low",
              ].join(" ")}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}


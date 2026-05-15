"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableDropdownOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyText = "No results",
  icon = "tune",
  searchable = true,
  className = "",
}: {
  options: SearchableDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: string;
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (option: SearchableDropdownOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={["relative w-full", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/60 border border-outline-variant/30 rounded-2xl text-sm font-body text-on-surface hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-base shrink-0">
            {selected?.icon ?? icon}
          </span>
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <span
          className={[
            "material-symbols-outlined text-on-surface-variant text-lg shrink-0 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
          {searchable ? (
            <div className="p-2 border-b border-outline-variant/10">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-xl">
                <span className="material-symbols-outlined text-on-surface-variant text-base">
                  search
                </span>
                <input
                  autoFocus
                  type="text"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-on-surface-variant hover:text-on-surface"
                    aria-label="Clear dropdown search"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <ul className="max-h-52 overflow-y-auto py-1.5 upload-card-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-on-surface-variant text-center">{emptyText}</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => pick(option)}
                      className={[
                        "w-full text-left px-4 py-2.5 text-sm font-body transition-colors flex items-center gap-3",
                        isSelected
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-on-surface hover:bg-surface-container-low",
                      ].join(" ")}
                    >
                      {isSelected ? (
                        <span className="material-symbols-outlined text-primary text-base">check</span>
                      ) : (
                        <span className="w-[18px] shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description ? (
                          <span className="block truncate text-xs text-on-surface-variant">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

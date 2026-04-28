"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";

type SettingsSectionId =
  | "general"
  | "account"
  | "privacy"
  | "billing"
  | "capabilities"
  | "connectors"
  | "claude-code";

type SettingsState = {
  fullName: string;
  preferredName: string;
  workFunction: string;
  responsePreferences: string;
  notifications: {
    responseCompletions: boolean;
    dispatchMessages: boolean;
  };
  activeSection: SettingsSectionId;
};

const STORAGE_KEY = "kili.settings.v1";

const WORK_FUNCTIONS = [
  "Select your work function",
  "Engineering",
  "Product",
  "Design",
  "Data / Analytics",
  "Marketing",
  "Sales",
  "Support",
  "Operations",
  "Founder / Exec",
  "Student",
  "Other",
] as const;

const SECTIONS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "privacy", label: "Privacy" },
  { id: "billing", label: "Billing" },
  { id: "capabilities", label: "Capabilities" },
  { id: "connectors", label: "Connectors" },
  { id: "claude-code", label: "Claude Code" },
];

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-outline/30",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-surface-container-lowest shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function SettingsPage() {
  const userInfo = useSelector((s: RootState) => s.user.userInfo);

  const defaults = useMemo<SettingsState>(() => {
    const fullName = (userInfo?.name ?? "").trim();
    const preferredName = (userInfo?.userName ?? "").trim() || fullName.split(" ")[0] || "";
    return {
      fullName,
      preferredName,
      workFunction: WORK_FUNCTIONS[0],
      responsePreferences: "",
      notifications: {
        responseCompletions: true,
        dispatchMessages: false,
      },
      activeSection: "general",
    };
  }, [userInfo?.name, userInfo?.userName]);

  const [state, setState] = useState<SettingsState>(defaults);
  const [saved, setSaved] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setState(defaults);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<SettingsState> | null;
      if (!parsed || typeof parsed !== "object") {
        setState(defaults);
        return;
      }
      setState((prev) => ({
        ...defaults,
        ...parsed,
        notifications: {
          ...defaults.notifications,
          ...(parsed.notifications ?? {}),
        },
        activeSection: prev.activeSection,
      }));
    } catch {
      setState(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  const set = <K extends keyof SettingsState>(key: K, val: SettingsState[K]) =>
    setState((p) => ({ ...p, [key]: val }));

  const save = () => {
    try {
      const toSave: SettingsState = { ...state, activeSection: "general" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      setSaved("saved");
      window.setTimeout(() => setSaved("idle"), 1400);
    } catch {
      // If localStorage is unavailable, just no-op.
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-headline">Settings</h1>
            <p className="text-sm text-on-surface-variant mt-1 font-body">
              Manage your profile, preferences, and notifications.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            className={[
              "px-4 py-2 rounded-xl font-headline font-bold text-sm transition-colors border",
              saved === "saved"
                ? "bg-secondary-container text-on-secondary-container border-outline-variant/20"
                : "bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container",
            ].join(" ")}
          >
            {saved === "saved" ? "Saved" : "Save"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-2">
              {SECTIONS.map((s) => {
                const active = state.activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set("activeSection", s.id)}
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

          <section className="space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 lg:p-8">
              <h2 className="text-lg font-extrabold font-headline mb-5">Profile</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
                    Full name
                  </label>
                  <input
                    value={state.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
                    What should Claude call you? <span className="text-primary">*</span>
                  </label>
                  <input
                    value={state.preferredName}
                    onChange={(e) => set("preferredName", e.target.value)}
                    placeholder="e.g. Prakhar"
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
                  What best describes your work?
                </label>
                <div className="relative">
                  <select
                    value={state.workFunction}
                    onChange={(e) => set("workFunction", e.target.value)}
                    className="w-full appearance-none px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                  >
                    {WORK_FUNCTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
                  What personal preferences should Claude consider in responses?
                </label>
                <textarea
                  value={state.responsePreferences}
                  onChange={(e) => set("responsePreferences", e.target.value)}
                  rows={4}
                  placeholder="e.g. keep explanations brief and to the point"
                  className="w-full resize-none px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body leading-relaxed"
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 lg:p-8">
              <h2 className="text-lg font-extrabold font-headline mb-5">Notifications</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold font-headline">Response completions</p>
                    <p className="text-xs text-on-surface-variant font-body mt-0.5">
                      Get notified when a long-running task finishes.
                    </p>
                  </div>
                  <Toggle
                    checked={state.notifications.responseCompletions}
                    onChange={(next) =>
                      set("notifications", { ...state.notifications, responseCompletions: next })
                    }
                    ariaLabel="Toggle response completions notifications"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold font-headline">Dispatch messages</p>
                    <p className="text-xs text-on-surface-variant font-body mt-0.5">
                      Get a push notification on your phone.
                    </p>
                  </div>
                  <Toggle
                    checked={state.notifications.dispatchMessages}
                    onChange={(next) =>
                      set("notifications", { ...state.notifications, dispatchMessages: next })
                    }
                    ariaLabel="Toggle dispatch messages notifications"
                  />
                </div>
              </div>

              <div className="mt-6 text-xs text-on-surface-variant font-body">
                Tip: settings are currently stored locally in this browser.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


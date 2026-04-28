"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/redux/store";
import axiosInstance from "@/utils/axios";
import { setUserDetails } from "@/redux/slices/userSlice";
import SettingsSectionNav, { type SettingsSectionId } from "@/components/settings/SettingsSectionNav";
import { BillingCard, NotificationsCard, ProfileCard, SecurityCard, type SessionInfo } from "@/components/settings/SettingsCards";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SettingsState = {
  fullName: string;
  preferredName: string;
  bio: string;
  workFunction: string;
  responsePreferences: string;
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
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
  { id: "notifications", label: "Notifications" },
  { id: "billing", label: "Billing" },
];

function SettingsPageInner() {
  const userInfo = useSelector((s: RootState) => s.user.userInfo);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults = useMemo<SettingsState>(() => {
    const fullName = (userInfo?.name ?? "").trim();
    const preferredName = (userInfo?.userName ?? "").trim() || fullName.split(" ")[0] || "";
    return {
      fullName,
      preferredName,
      bio: "",
      workFunction: WORK_FUNCTIONS[0],
      responsePreferences: "",
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
      },
      activeSection: "general",
    };
  }, [userInfo?.name, userInfo?.userName]);

  const [state, setState] = useState<SettingsState>(defaults);
  const [saved, setSaved] = useState<"idle" | "saved">("idle");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [busySessionId, setBusySessionId] = useState("");
  const [busyAll, setBusyAll] = useState(false);

  const validTabs = useMemo(() => new Set(SECTIONS.map((s) => s.id)), []);

  const selectSection = useCallback(
    (id: SettingsSectionId) => {
      setState((p) => ({ ...p, activeSection: id }));
      const next = new URLSearchParams(searchParams?.toString());
      next.set("tab", id);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Initialize / sync activeSection from URL (?tab=...)
  useEffect(() => {
    const raw = searchParams?.get("tab") || "";
    const tab = (raw as SettingsSectionId) || "general";
    if (!validTabs.has(tab)) return;
    setState((p) => (p.activeSection === tab ? p : { ...p, activeSection: tab }));
  }, [searchParams, validTabs]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await axiosInstance.get("/api/user/profile");
        const u = res.data as {
          name?: string;
          userName?: string;
          bio?: string;
          profilePicture?: string;
          preferences?: { emailNotifications?: boolean; pushNotifications?: boolean };
        };

        let local: Partial<SettingsState> = {};
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<SettingsState> | null;
            if (parsed && typeof parsed === "object") local = parsed;
          }
        } catch {
          // ignore local parse errors
        }

        if (!mounted) return;
        setProfilePicture(u.profilePicture ?? "");
        setState((prev) => ({
          ...defaults,
          ...local,
          fullName: (u.name ?? defaults.fullName).trim(),
          preferredName: (u.userName ?? defaults.preferredName).trim(),
          bio: (u.bio ?? "").trim(),
          notifications: {
            emailNotifications: u.preferences?.emailNotifications !== false,
            pushNotifications: u.preferences?.pushNotifications !== false,
          },
          activeSection: prev.activeSection,
        }));
      } catch (err: unknown) {
        if (!mounted) return;
        setState(defaults);
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Could not load settings. Please refresh.";
        setErrorMsg(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [defaults]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const set = <K extends keyof SettingsState>(key: K, val: SettingsState[K]) =>
    setState((p) => ({ ...p, [key]: val }));

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await axiosInstance.get("/api/auth/sessions");
      const raw = res.data as { sessions?: SessionInfo[] };
      setSessions(Array.isArray(raw.sessions) ? raw.sessions : []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not load sessions.";
      setSessionsError(msg);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.activeSection !== "account") return;
    if (sessionsLoading) return;
    void fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSection]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const localToSave: Partial<SettingsState> = {
        workFunction: state.workFunction,
        responsePreferences: state.responsePreferences,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localToSave));

      const form = new FormData();
      form.append("name", state.fullName);
      form.append("userName", state.preferredName);
      form.append("bio", state.bio);
      form.append(
        "preferences",
        JSON.stringify({
          emailNotifications: state.notifications.emailNotifications,
          pushNotifications: state.notifications.pushNotifications,
        }),
      );
      if (avatarFile) form.append("profilePicture", avatarFile);

      const res = await axiosInstance.put("/api/user/update-profile", form);
      const updated = (res.data as { user?: unknown })?.user;
      if (updated && typeof window !== "undefined") {
        localStorage.setItem("userData", JSON.stringify(updated));
        dispatch(setUserDetails(updated as never));
      }

      setProfilePicture(
        (updated && typeof updated === "object" && "profilePicture" in updated
          ? (updated as { profilePicture?: string }).profilePicture
          : profilePicture) ?? "",
      );
      setAvatarFile(null);
      setSaved("saved");
      window.setTimeout(() => setSaved("idle"), 1400);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not save settings. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const logoutAllDevices = async () => {
    if (busyAll) return;
    setBusyAll(true);
    setSessionsError("");
    try {
      await axiosInstance.post("/api/auth/logout-all");
      setSessions([]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not log out all devices.";
      setSessionsError(msg);
    } finally {
      setBusyAll(false);
    }
  };

  const logoutSession = async (sessionId: string) => {
    if (!sessionId || busySessionId) return;
    setBusySessionId(sessionId);
    setSessionsError("");
    try {
      await axiosInstance.post(`/api/auth/logout-session/${encodeURIComponent(sessionId)}`);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not log out session.";
      setSessionsError(msg);
    } finally {
      setBusySessionId("");
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
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
            disabled={saving || loading}
            className={[
              "px-4 py-2 rounded-xl font-headline font-bold text-sm transition-colors border",
              saved === "saved"
                ? "bg-secondary-container text-on-secondary-container border-outline-variant/20"
                : "bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container disabled:opacity-60 disabled:pointer-events-none",
            ].join(" ")}
          >
            {saving ? "Saving…" : saved === "saved" ? "Saved" : "Save"}
          </button>
        </div>

        {errorMsg ? (
          <div className="mb-8 px-5 py-4 rounded-2xl bg-error-container text-on-error-container text-sm font-body flex items-center gap-3">
            <span className="material-symbols-outlined text-xl shrink-0">error</span>
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <SettingsSectionNav
            sections={SECTIONS}
            activeSection={state.activeSection}
            onSelect={selectSection}
          />

          <section className="space-y-8">
            {state.activeSection === "general" ? (
              <ProfileCard
                fullName={state.fullName}
                preferredName={state.preferredName}
                bio={state.bio}
                workFunction={state.workFunction}
                responsePreferences={state.responsePreferences}
                workFunctions={WORK_FUNCTIONS}
                profilePicture={profilePicture}
                avatarPreview={avatarPreview}
                avatarFileSelected={Boolean(avatarFile)}
                onFullNameChange={(v) => set("fullName", v)}
                onPreferredNameChange={(v) => set("preferredName", v)}
                onBioChange={(v) => set("bio", v)}
                onWorkFunctionChange={(v) => set("workFunction", v)}
                onResponsePreferencesChange={(v) => set("responsePreferences", v)}
                onAvatarFileChange={(f) => setAvatarFile(f)}
                onAvatarRemove={() => setAvatarFile(null)}
              />
            ) : null}

            {state.activeSection === "notifications" ? (
              <NotificationsCard
                emailNotifications={state.notifications.emailNotifications}
                pushNotifications={state.notifications.pushNotifications}
                onEmailNotificationsChange={(next) =>
                  set("notifications", { ...state.notifications, emailNotifications: next })
                }
                onPushNotificationsChange={(next) =>
                  set("notifications", { ...state.notifications, pushNotifications: next })
                }
              />
            ) : null}

            {state.activeSection === "account" ? (
              <SecurityCard
                sessions={sessions}
                loading={sessionsLoading}
                error={sessionsError}
                onRefresh={() => void fetchSessions()}
                onLogoutAll={() => void logoutAllDevices()}
                onLogoutSession={(id) => void logoutSession(id)}
                busySessionId={busySessionId}
                busyAll={busyAll}
              />
            ) : null}

            {state.activeSection === "billing" ? (
              <BillingCard onOpenBilling={() => router.push("/dashboard/billing")} />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-on-surface">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
            <h1 className="text-3xl font-extrabold tracking-tight font-headline">Settings</h1>
            <p className="text-sm text-on-surface-variant mt-2 font-body">Loading…</p>
          </div>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}


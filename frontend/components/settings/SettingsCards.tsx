"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Toggle from "@/components/settings/Toggle";
import { s3Url } from "@/utils/axios";
import { fetchCurrentPlan, type CurrentPlanResponse } from "@/utils/plansApi";
import axiosInstance from "@/utils/axios";

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 lg:p-8">
      <h2 className="text-lg font-extrabold font-headline mb-5">{title}</h2>
      {children}
    </div>
  );
}

export function ProfileCard({
  fullName,
  preferredName,
  bio,
  workFunction,
  responsePreferences,
  workFunctions,
  profilePicture,
  avatarPreview,
  avatarFileSelected,
  onFullNameChange,
  onPreferredNameChange,
  onBioChange,
  onWorkFunctionChange,
  onResponsePreferencesChange,
  onAvatarFileChange,
  onAvatarRemove,
}: {
  fullName: string;
  preferredName: string;
  bio: string;
  workFunction: string;
  responsePreferences: string;
  workFunctions: readonly string[];
  profilePicture: string;
  avatarPreview: string;
  avatarFileSelected: boolean;
  onFullNameChange: (v: string) => void;
  onPreferredNameChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onWorkFunctionChange: (v: string) => void;
  onResponsePreferencesChange: (v: string) => void;
  onAvatarFileChange: (f: File | null) => void;
  onAvatarRemove: () => void;
}) {
  return (
    <Card title="Profile">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-surface-container-low border border-outline-variant/20 flex items-center justify-center shrink-0">
          {avatarPreview || profilePicture ? (
            <Image
              src={avatarPreview || s3Url(profilePicture)}
              alt="Profile avatar"
              width={56}
              height={56}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="material-symbols-outlined text-on-surface-variant">person</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm font-headline font-bold hover:bg-surface-container transition-colors cursor-pointer">
            Upload photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatarFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {avatarFileSelected ? (
            <button
              type="button"
              onClick={onAvatarRemove}
              className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm font-headline font-bold hover:bg-surface-container transition-colors"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
          />
        </div>

        <div>
          <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
            What should Kili call you? <span className="text-primary">*</span>
          </label>
          <input
            value={preferredName}
            onChange={(e) => onPreferredNameChange(e.target.value)}
            placeholder="e.g. Prakhar"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          rows={3}
          placeholder="A short bio (optional)"
          className="w-full resize-none px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body leading-relaxed"
        />
      </div>

      <div className="mt-5">
        <label className="block text-xs font-bold font-headline text-on-surface-variant mb-2">
          What best describes your work?
        </label>
        <div className="relative">
          <select
            value={workFunction}
            onChange={(e) => onWorkFunctionChange(e.target.value)}
            className="w-full appearance-none px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
          >
            {workFunctions.map((w) => (
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
          What personal preferences should Kili consider in responses?
        </label>
        <textarea
          value={responsePreferences}
          onChange={(e) => onResponsePreferencesChange(e.target.value)}
          rows={4}
          placeholder="e.g. keep explanations brief and to the point"
          className="w-full resize-none px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body leading-relaxed"
        />
      </div>
    </Card>
  );
}

export function NotificationsCard({
  emailNotifications,
  pushNotifications,
  onEmailNotificationsChange,
  onPushNotificationsChange,
}: {
  emailNotifications: boolean;
  pushNotifications: boolean;
  onEmailNotificationsChange: (next: boolean) => void;
  onPushNotificationsChange: (next: boolean) => void;
}) {
  return (
    <Card title="Notifications">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold font-headline">Email notifications</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              Get important updates by email (e.g. completion emails).
            </p>
          </div>
          <Toggle
            checked={emailNotifications}
            onChange={onEmailNotificationsChange}
            ariaLabel="Toggle email notifications"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold font-headline">Push notifications</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              Get push notifications on your devices (when supported).
            </p>
          </div>
          <Toggle
            checked={pushNotifications}
            onChange={onPushNotificationsChange}
            ariaLabel="Toggle push notifications"
          />
        </div>
      </div>

      {/* <div className="mt-6 text-xs text-on-surface-variant font-body">
        Tip: “Work function” and “response preferences” are stored locally for now.
      </div> */}
    </Card>
  );
}

export type SessionInfo = {
  _id: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
  lastUsedAt?: string;
};

export function SecurityCard({
  sessions,
  loading,
  error,
  onRefresh,
  onLogoutAll,
  onLogoutSession,
  busySessionId,
  busyAll,
}: {
  sessions: SessionInfo[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onLogoutAll: () => void;
  onLogoutSession: (id: string) => void;
  busySessionId: string;
  busyAll: boolean;
}) {
  return (
    <Card title="Security">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-on-surface-variant font-body">Active sessions</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-xs font-headline font-bold hover:bg-surface-container transition-colors"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onLogoutAll}
            className="px-3 py-1.5 rounded-xl bg-error-container text-on-error-container border border-outline-variant/20 text-xs font-headline font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:pointer-events-none"
            disabled={busyAll}
          >
            {busyAll ? "Logging out…" : "Log out all devices"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-error-container text-on-error-container text-sm font-body flex items-center gap-3">
          <span className="material-symbols-outlined text-xl shrink-0">error</span>
          {error}
        </div>
      ) : null}

      <div className="divide-y divide-outline-variant/10 border border-outline-variant/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-4 text-sm text-on-surface-variant font-body">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-4 text-sm text-on-surface-variant font-body">
            No active sessions found.
          </div>
        ) : (
          sessions.map((s) => (
            <div key={s._id} className="px-4 py-4 flex items-start justify-between gap-4 bg-surface-container-lowest">
              <div className="min-w-0">
                <p className="text-sm font-headline font-bold text-on-surface truncate">
                  {s.userAgent ? s.userAgent : "Unknown device"}
                </p>
                <p className="text-xs text-on-surface-variant font-body mt-1">
                  {s.ipAddress ? `IP: ${s.ipAddress} • ` : ""}
                  {s.lastUsedAt ? `Last used: ${new Date(s.lastUsedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLogoutSession(s._id)}
                disabled={busySessionId === s._id}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-xs font-headline font-bold hover:bg-surface-container transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {busySessionId === s._id ? "Logging out…" : "Log out"}
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function BillingCard({
  onOpenBilling,
}: {
  onOpenBilling: () => void;
}) {
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanResponse>(null);
  const [loading, setLoading] = useState(true);
  const [billingHistory, setBillingHistory] = useState<
    Array<{
      date: string;
      source: string;
      amount: number;
      description: string;
    }>
  >([]);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [plan, history] = await Promise.all([
          fetchCurrentPlan(),
          axiosInstance.get<{
            transactions: Array<{
              type: "credit" | "debit";
              amount: number;
              source: string;
              description: string;
              date: string;
            }>;
          }>("/api/subtitles/credits/history", { params: { page: 1, limit: 15 } }),
        ]);
        if (!mounted) return;
        setCurrentPlan(plan);

        const items = (history.data?.transactions ?? [])
          .filter((t) => ["subscription_initial", "subscription_renewal", "purchase"].includes(t.source))
          .map((t) => ({
            date: t.date,
            source: t.source,
            amount: t.amount,
            description: t.description,
          }));
        setBillingHistory(items);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canCancel =
    Boolean(currentPlan) &&
    currentPlan?.status === "active" &&
    currentPlan?.cancelAtNextBillingDate === false;

  const cancelPlan = async () => {
    if (!canCancel || cancelling) return;
    setCancelling(true);
    try {
      await axiosInstance.post("/api/billing/cancel");
      const plan = await fetchCurrentPlan();
      setCurrentPlan(plan);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card title="Billing">
      <p className="text-sm text-on-surface-variant font-body mb-4">
        Manage your plan and invoices.
      </p>

      {loading ? (
        <div className="text-sm text-on-surface-variant font-body mb-4">Loading billing info…</div>
      ) : currentPlan ? (
        <div className="mb-4 text-sm text-on-surface-variant font-body space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span>Current plan</span>
            <span className="font-semibold text-on-surface">{currentPlan.displayName}</span>
          </div>
          {currentPlan.nextBillingDate ? (
            <div className="flex items-center justify-between gap-3">
              <span>Renews on</span>
              <span className="font-semibold text-on-surface">
                {new Date(currentPlan.nextBillingDate).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span>Renews on</span>
              <span className="font-semibold text-on-surface">—</span>
            </div>
          )}
          {currentPlan.cancelAtNextBillingDate ? (
            <div className="text-xs text-red-500 font-medium pt-1">Cancels at next billing date</div>
          ) : null}
        </div>
      ) : (
        <div className="mb-4 text-sm text-on-surface-variant font-body">
          You don’t have an active subscription.
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
        <p className="text-xs font-bold font-headline text-on-surface-variant mb-3">Billing history</p>
        {loading ? (
          <div className="text-sm text-on-surface-variant font-body">Loading…</div>
        ) : billingHistory.length === 0 ? (
          <div className="text-sm text-on-surface-variant font-body">No billing history yet.</div>
        ) : (
          <div className="space-y-3">
            {billingHistory.slice(0, 10).map((row, idx) => (
              <div
                key={`${row.date}-${row.source}-${idx}`}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-headline font-bold text-on-surface truncate">
                    {row.source.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-on-surface-variant font-body mt-0.5 truncate">
                    {row.description || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-headline font-bold text-on-surface">{row.amount} credits</p>
                  <p className="text-xs text-on-surface-variant font-body mt-0.5">
                    {new Date(row.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentPlan ? (
        <button
          type="button"
          onClick={cancelPlan}
          disabled={!canCancel || cancelling}
          className="mb-3 w-full px-4 py-2 rounded-xl bg-error-container text-on-error-container border border-outline-variant/20 text-sm font-headline font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:pointer-events-none"
        >
          {currentPlan.cancelAtNextBillingDate ? "Cancellation scheduled" : cancelling ? "Cancelling…" : "Cancel plan"}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpenBilling}
        className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm font-headline font-bold hover:bg-surface-container transition-colors"
      >
        Open Billing
      </button>
    </Card>
  );
}


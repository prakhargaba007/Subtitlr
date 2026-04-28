"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/redux/store";
import { clearUserDetails } from "@/redux/slices/userSlice";
import axiosInstance from "@/utils/axios";
import { fetchCurrentPlan, type CurrentPlanResponse } from "@/utils/plansApi";

const NAV_ITEMS = [
  { icon: "dashboard", label: "Launchpad", href: "/dashboard" },
  { icon: "folder", label: "Projects", href: "/dashboard/projects" },
  { icon: "auto_awesome", label: "AI Tools", href: "/dashboard/ai-tools" },
];

const DIRECT_LINKS = [
  // { icon: "upload_file", label: "New Upload", href: "/dashboard" },
  // { icon: "folder_open", label: "All Projects", href: "/dashboard/projects" },
  // { icon: "toll", label: "Credit History", href: "/dashboard/credit-history" },
  { icon: "rocket_launch", label: "Request a Feature", href: "/dashboard/request-feature" },
];


const MAX_CREDITS = 60;

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const userInfo = useSelector((state: RootState) => state.user.userInfo);
  
  const displayName = userInfo?.name ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanResponse>(null);
  
  // Fetch credits & plan
  useEffect(() => {
    const userData = localStorage.getItem("userData");
    if (!userData) {
      setCreditsLoading(false);
      return;
    }
    
    axiosInstance
    .get<{ credits: number }>("/api/subtitles/credits")
    .then((res) => setCredits(res.data.credits))
    .catch(() => setCredits(null))
    .finally(() => setCreditsLoading(false));
    
    fetchCurrentPlan().then((plan) => setCurrentPlan(plan));
  }, []);
  
  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);
  
  const handleLogout = async () => {
    try {
      await axiosInstance.post("/api/auth/logout");
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("userData");
    localStorage.removeItem("isTempUser");
    dispatch(clearUserDetails());
    router.push("/");
  };
  const USER_LINKS = [
    { icon: "settings", label: "Settings", action: () => router.push("/dashboard/settings") },
    {
      icon: "toll",
      label: "Credit History",
      action: () => router.push("/dashboard/credit-history"),
    },
     { icon: "logout", label: "Log Out", action: handleLogout, danger: true },
  ]
  
  const usedPercent =
    credits !== null ? Math.round(((MAX_CREDITS - credits) / MAX_CREDITS) * 100) : 0;

  return (
    <aside className="h-screen w-20 lg:w-64 fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col py-8 px-4 z-50 transition-all duration-300">

      {/* Logo – wide */}
      <div className="mb-10 px-4 hidden lg:block cursor-pointer" onClick={() => router.push("/dashboard")}>
        <div className="flex items-center gap-2">
          <Image src="/kililabs-mark-indigo.svg" alt="Kili" width={60} height={60} priority />
          <p className="font-headline text-3xl font-extrabold text-primary tracking-tight">
            Kili Labs
          </p>
        </div>
        {/* <p className="text-xl text-on-surface-variant font-bold uppercase tracking-widest mt-1">
          Workspace
        </p> */}
      </div>

      {/* Logo – collapsed */}
      <div className="mb-10 lg:hidden flex justify-center">
        <Image src="/kililabs-mark-indigo.svg" alt="Kili" width={40} height={40} priority />
      </div>

      {/* Main nav */}
      <nav className="space-y-1">
        {NAV_ITEMS.map(({ icon, label, href }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={label}
              href={href}
              className={[
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-body",
                active
                  ? "text-primary bg-primary/8 font-semibold"
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-container",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              <span className="hidden lg:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="my-5 border-t border-outline-variant/20" />

      {/* Credits section */}
      {/* <div className="px-1 mb-4">
        <div className="lg:hidden flex justify-center py-2">
          <span className="material-symbols-outlined text-primary text-[20px]">toll</span>
        </div>
      </div> */}

      {/* Direct links */}
      <div className="space-y-0.5 flex-1">
        {DIRECT_LINKS.map(({ icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-xs font-body text-on-surface-variant hover:text-primary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            <span className="hidden lg:block">{label}</span>
          </Link>
        ))}
      </div>

      {/* User card + popup */}
      <div className="mt-4 px-1 relative" ref={menuRef}>

        {/* Popup menu — opens above */}
        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl overflow-hidden z-50">
            <div className="hidden lg:block space-y-2 px-4 py-3">
              {creditsLoading ? (
                <div className="flex items-center justify-center py-3">
                  <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-surface-container rounded-2xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-extrabold text-on-surface font-headline leading-none">
                      {credits ?? "—"}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant font-label">
                      / {MAX_CREDITS} left
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, 100 - usedPercent))}%` }}
                    />
                  </div>
                  <button
                    onClick={() => router.push("/dashboard/billing")}
                    className="w-full mt-1 py-1.5 bg-primary/10 text-primary text-[11px] font-headline font-bold rounded-xl hover:bg-primary/20 transition-colors"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}
            </div>
            {USER_LINKS.map(({ icon, label, action, danger }) => (
              <button
                key={label}
                onClick={() => { setMenuOpen(false); action(); }}
                className={[
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-body transition-colors text-left",
                  danger
                    ? "text-red-500 hover:bg-red-50"
                    : "text-on-surface hover:bg-surface-container",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                <span>{label}</span>
              </button>
            ))}

          </div>
        )}

        {/* Clickable user card */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-3 p-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container transition-colors"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
            {userInfo?.profilePicture ? (
              <Image
                alt={displayName}
                className="object-cover"
                src={userInfo.profilePicture}
                width={40}
                height={40}
                sizes="40px"
              />
            ) : (
              <span className="text-primary font-bold font-headline text-sm">{initials}</span>
            )}
          </div>
          <div className="hidden lg:flex flex-1 items-center justify-between overflow-hidden">
            <div className="overflow-hidden text-left">
              <p className="text-xs font-bold text-on-surface truncate font-headline">{displayName}</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tight font-label">
                {userInfo?.role === "admin" ? "Admin" : currentPlan?.displayName || "Free Plan"}
              </p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
              {menuOpen ? "expand_more" : "expand_less"}
            </span>
          </div>
        </button>
      </div>

    </aside>
  );
}

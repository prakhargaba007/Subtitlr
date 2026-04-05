"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { icon: "dashboard", label: "Launchpad", href: "/dashboard" },
  { icon: "folder", label: "Projects", href: "#" },
  { icon: "auto_awesome", label: "AI Tools", href: "#" },
  { icon: "settings", label: "Settings", href: "#" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-20 lg:w-64 fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col py-8 px-4 z-50 transition-all duration-300">
      {/* Logo – wide */}
      <div className="mb-10 px-4 hidden lg:block">
        <h1 className="font-headline text-xl font-extrabold text-primary tracking-tight">
          Subtitlr
        </h1>
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
          Workspace
        </p>
      </div>

      {/* Logo – collapsed */}
      <div className="mb-10 lg:hidden flex justify-center">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary font-bold font-headline">
          S
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ icon, label, href }) => {
          const active = pathname === href;
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

      {/* User card */}
      <div className="mt-auto px-1">
        <div className="flex items-center gap-3 p-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
            <img
              alt="User"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOOg1JhQVZzdqQ5KtGilaOJM7I0YEq6dRxRRkLeuvYvXvFD1-7Bk1yMSBGDgKPqERIK5Q5sKUnHwk93WpJ3qO6Aqz0qT_Ck1QM2CUYKCLU01KdR-SngWevzVTwOBbi6BeUXosuxr1KXp1MS-GsrWtNlzkK2XoONFcoUBznJhxA88M6QYcNZBqI5SeH_cDMZiAXoEMLPPu-eLaR8QZX42i_7tith72UW2mJ4q2gq48gbpB1W9IfUgFMApfZYwoSEjhPaX6PGZ4P88k"
            />
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-bold text-on-surface truncate font-headline">Alex Rivers</p>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tight font-label">
              Pro Plan
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

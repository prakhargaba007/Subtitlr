"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface AppNavbarProps {
  /** Label shown to the right of the logo area (e.g. "Zen Mode") */
  subtitle?: string;
  /** App links shown next to the logo. Defaults to Projects / Library / Team. */
  links?: { label: string; href: string }[];
  /** Primary action button in the top-right. */
  action?: { label: string; onClick?: () => void };
  /** Show notification + settings icon buttons and user avatar. Default true. */
  showUserActions?: boolean;
  /** User initial shown in the avatar circle. */
  userInitial?: string;
}

const DEFAULT_LINKS = [
  { label: "Projects", href: "#" },
  { label: "Library", href: "#" },
  { label: "Team", href: "#" },
];

export default function AppNavbar({
  subtitle,
  links = DEFAULT_LINKS,
  action,
  showUserActions = true,
  userInitial = "P",
}: AppNavbarProps) {
  return (
    <header className="fixed top-0 w-full z-50 glass-nav shadow-sm">
      <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">

        {/* Left — logo + optional app links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary font-headline">
            Kili
          </Link>

          {links.length > 0 && !subtitle && (
            <div className="hidden md:flex gap-6 font-headline font-medium text-sm">
              {links.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-on-surface-variant hover:text-primary transition-colors duration-200"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Centre — optional subtitle (e.g. "Zen Mode") */}
        {subtitle && (
          <span className="text-sm font-headline font-semibold text-on-surface-variant">
            {subtitle}
          </span>
        )}

        {/* Right — icon actions + avatar + CTA */}
        <div className="flex items-center gap-3">
          {showUserActions && (
            <>
              {(["notifications", "settings"] as const).map((icon) => (
                <button
                  key={icon}
                  aria-label={icon}
                  className="material-symbols-outlined p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant text-xl"
                >
                  {icon}
                </button>
              ))}

              <div className="w-8 h-8 rounded-full bg-primary-fixed overflow-hidden ring-2 ring-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-xs font-headline">
                  {userInitial}
                </span>
              </div>
            </>
          )}

          {action && (
            <Button variant="primary" size="sm" pill onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>

      </nav>
    </header>
  );
}

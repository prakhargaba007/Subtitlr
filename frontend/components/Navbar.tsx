"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

export default function Navbar() {
  const pathname = usePathname();
  const isBillingSuccess = pathname === "/billing/success";
  const [isRealUser, setIsRealUser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const userDataStr = localStorage.getItem("userData");
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          setIsRealUser(!userData.tempUser);
        } catch {
          setIsRealUser(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const navLinkClass = isBillingSuccess
    ? "text-slate-400 hover:text-[#d4af37] transition-colors duration-300"
    : "text-slate-600 hover:text-indigo-600 transition-colors duration-300";
  const signInClass = isBillingSuccess
    ? "text-slate-400 font-medium text-sm hover:text-white transition-colors"
    : "text-slate-600 font-medium text-sm hover:text-indigo-600 transition-colors";

  return (
    <header
      className={
        isBillingSuccess
          ? "fixed top-0 w-full z-50 border-b border-white/10 bg-[#0a0b14]/85 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          : "fixed top-0 w-full z-50 glass-nav shadow-sm backdrop-blur-sm"
      }
    >
      <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <Link
          href="/"
          className={
            isBillingSuccess
              ? "flex items-center gap-2 text-2xl font-bold tracking-tighter text-white font-headline"
              : "flex items-center gap-2 text-2xl font-bold tracking-tighter text-indigo-700 font-headline"
          }
        >
          <Image src="/kililabs-mark-indigo.svg" alt="Kili" width={28} height={28} priority />
          <span>Kili</span>
        </Link>

        <div className="hidden md:flex items-center space-x-10 font-headline font-medium text-sm tracking-tight">
          <Link href="/product" className={navLinkClass}>
            Product
          </Link>
          <Link href="/pricing" className={navLinkClass}>
            Pricing
          </Link>
          <a href="#" className={navLinkClass}>
            Use Cases
          </a>
          <Link href="/docs" className={navLinkClass}>
            Docs
          </Link>
        </div>

        <div className="flex items-center space-x-6">
          {isRealUser ? (
            <Link href="/dashboard">
              <Button
                variant="primary"
                size="sm"
                pill
                className={
                  isBillingSuccess
                      ? "bg-white! from-white! to-white! text-[#0a0b14]! hover:bg-slate-100! border-0 shadow-[0_0_20px_rgba(255,255,255,0.12)] scale-100 hover:scale-[1.02] active:scale-95"
                    : "hover:shadow-[0_0_15px_rgba(57,44,193,0.3)] scale-100 hover:scale-[1.02] active:scale-95"
                }
              >
                Dashboard →
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className={signInClass}>
                Sign In
              </Link>
              <Link href="/login">
                <Button
                  variant="primary"
                  size="sm"
                  pill
                  className={
                    isBillingSuccess
                      ? "bg-white! from-white! to-white! text-[#0a0b14]! hover:bg-slate-100! border-0 shadow-[0_0_20px_rgba(255,255,255,0.12)] scale-100 hover:scale-[1.02] active:scale-95"
                      : "hover:shadow-[0_0_15px_rgba(57,44,193,0.3)] scale-100 hover:scale-[1.02] active:scale-95"
                  }
                >
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

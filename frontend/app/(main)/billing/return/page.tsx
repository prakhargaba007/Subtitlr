"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  Gem,
  Languages,
  PlusSquare,
  Wallet,
  Loader2,
} from "lucide-react";
import styles from "./BillingSuccess.module.css";
import Image from "next/image";
import axiosInstance from "@/utils/axios";
import { fetchCurrentPlan } from "@/utils/plansApi";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuANkuUENN3hh_DZUxKHRqbVi_usD1ApmGWBMVuRSQTe_ynvOF5-EUQ2T-NT7hSuopeG_Cb_DdLorATLyAusSONO66Vo4gw__lHU1CtTNfb-ESQEXVr0t1UJMU2wLB1qMDS12eReu7LH2_xcVNDeCioo4YTQvcwa-Pvp8dRrQL7BbpeVO0EL5QO0YBEE-gSvcQEIrAtpkOJsB7C0-_6r0u901XKnRsJsmAGnhWqGiQKqjYkAYGjVCIsbq8ssI7rs7pVHCiLLLOrXvos";

type CreditTransaction = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  source: string;
  date: string;
};

// Polling configuration
const MAX_ATTEMPTS = 30; // 30 attempts, 2 seconds each = 60 seconds of waiting
const POLL_INTERVAL_MS = 2000;
const RECENT_THRESHOLD_MS = 15 * 60 * 1000; // Found transactions must be within last 15 minutes
const TARGET_SOURCES = ["subscription_initial", "subscription_renewal", "purchase"];

export default function BillingSuccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [successData, setSuccessData] = useState<{
    amountAdded: number;
    balanceAfter: number;
    planMessage: string;
  } | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    async function checkPayment() {
      try {
        // We treat BOTH of these as authoritative signals:
        // - credits ledger shows a recent subscription/purchase grant
        // - current-plan reports an active subscription (billing provider sync may be faster than ledger write)
        const [plan, res] = await Promise.all([
          fetchCurrentPlan(),
          axiosInstance.get<{ transactions:  [] }>(
            "/api/subtitles/credits/history?limit=10",
          ),
        ]);
        const txs = res.data.transactions || [];

        // Look for a very recent valid purchase/subscription credit transaction
        const recentPurchase = txs.find((tx) => {
          const isTargetType = tx.type === "credit" && TARGET_SOURCES.includes(tx.source);
          const isRecent = Date.now() - new Date(tx.date).getTime() < RECENT_THRESHOLD_MS;
          return isTargetType && isRecent;
        });

        if (recentPurchase || plan?.status === "active") {
          setSuccessData({
            amountAdded: recentPurchase?.amount ?? 0,
            balanceAfter: recentPurchase?.balanceAfter ?? 0,
            planMessage:
              plan?.status === "active"
                ? "Subscription Active"
                : recentPurchase?.source?.includes("subscription")
                  ? "Subscription Active"
                  : "Credits Added",
          });
          setLoading(false);
          return; // Success! Stop polling.
        }
      } catch (e) {
        console.warn("Polling error:", e);
        // Ignore network errors, continue polling
      }

      // If not successful yet and under attempt limit, schedule next poll
      if (attempt < MAX_ATTEMPTS) {
        timeoutId = setTimeout(() => {
          setAttempt((prev) => prev + 1);
        }, POLL_INTERVAL_MS);
      } else {
        // Exceeded max attempts without finding an authoritative payment update.
        router.push("/pricing");
      }
    }

    checkPayment();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [attempt, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0b14] font-body text-slate-300">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
        <h2 className="font-headline font-bold text-2xl text-white mb-2">Processing Your Payment...</h2>
        <p className="text-slate-400">Waiting for secure confirmation from the payment provider.</p>
        <p className="text-xs text-indigo-400/60 mt-4 text-center max-w-sm">
          Please do not close this window. <br />
          (Attempt {attempt + 1}/{MAX_ATTEMPTS})
        </p>
      </main>
    );
  }

  if (!successData) return null; // Avoid flashing the view during router redirect out

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#0a0b14] font-body text-slate-300 antialiased selection:bg-[#d4af37]/30">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e1b4b_0%,#0a0b14_70%)]"
        aria-hidden
      />
      <div
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]"
        aria-hidden
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 rounded-full blur-[120px]"
        aria-hidden
      />

      <div className="max-w-4xl w-full relative z-10 flex flex-col items-center pt-28 pb-8">
        <div className="mb-8 relative group">
          <div className="w-24 h-24 bg-linear-to-br from-indigo-600 to-indigo-900 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.3)] border border-white/10">
            <BadgeCheck className="text-white w-14 h-14" strokeWidth={1.25} aria-hidden />
          </div>
          <div className="absolute inset-0 w-full h-full rounded-full border border-[#d4af37]/20 scale-125 pointer-events-none" />
          <div className="absolute inset-0 w-full h-full rounded-full border border-indigo-500/10 scale-150 pointer-events-none" />
        </div>

        <div className="text-center mb-12">
          <h1 className="font-headline font-extrabold text-5xl lg:text-6xl tracking-tight text-white mb-6">
            Payment{" "}
            <span className={`${styles.metallic} ${styles.goldGlow}`}>Successful</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Welcome to the inner circle. Your account balance has been officially verified and updated.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div
            className={`lg:col-span-4 rounded-2xl p-8 flex flex-col justify-between bg-[#141624] ${styles.premiumBorder}`}
          >
            <div>
              <div className="flex items-center gap-2 mb-8">
                <Wallet className="text-[#d4af37] w-5 h-5" strokeWidth={1.75} aria-hidden />
                <h2 className="font-headline font-bold text-white uppercase tracking-widest text-xs">Ledger Entry</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Status</p>
                  <p className="text-xl font-headline font-bold text-white flex items-center gap-2">
                    {successData.planMessage}
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      aria-hidden
                    />
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Authentic Provision</p>
                  <p className="text-2xl font-headline font-bold text-indigo-400">+{successData.amountAdded}</p>
                </div>
                <div className="pt-6 border-t border-white/5">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Available Balance</p>
                  <p className="text-3xl font-headline font-extrabold text-emerald-400">
                    {successData.balanceAfter} <span className="text-sm font-medium text-slate-400">credits</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <h3 className="font-headline font-bold text-white text-sm uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-2">
              <span className="w-1 h-1 bg-[#d4af37] rounded-full" aria-hidden />
              Verified Workflows Unlocked
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Languages, title: "Hinglish AI", desc: "Bilingual transcription with cultural context sensitivity.", borderHover: "hover:border-indigo-500/40", blob: "bg-indigo-500/5 group-hover:bg-indigo-500/10", iconClass: "text-indigo-400" },
                { icon: Gem, title: "4K Mastery", desc: "High-bitrate exports without watermark or compression.", borderHover: "hover:border-[#d4af37]/40", blob: "bg-[#d4af37]/5 group-hover:bg-[#d4af37]/10", iconClass: "text-[#d4af37]" },
                { icon: Bolt, title: "Ultra-Fast", desc: "Bypass the queue with priority GPU processing clusters.", borderHover: "hover:border-indigo-500/40", blob: "bg-indigo-500/5 group-hover:bg-indigo-500/10", iconClass: "text-indigo-400" },
              ].map(({ icon: Icon, title, desc, borderHover, blob, iconClass }) => (
                <div
                  key={title}
                  className={`${styles.featureCard} border border-white/5 rounded-2xl p-6 ${borderHover} transition-all group overflow-hidden relative`}
                >
                  <div
                    className={`absolute -right-4 -top-4 w-20 h-20 ${blob} rounded-full blur-xl transition-colors`}
                    aria-hidden
                  />
                  <Icon className={`${iconClass} mb-4 w-8 h-8`} strokeWidth={1.5} aria-hidden />
                  <h4 className="text-white font-bold mb-2">{title}</h4>
                  <p className="text-xs text-slate-400 leading-normal">{desc}</p>
                </div>
              ))}
            </div>

            <div className="relative w-full rounded-2xl overflow-hidden aspect-21/7 border border-white/5">
              <Image
                src={HERO_IMAGE}
                alt="Professional interface"
                className="absolute inset-0 w-full h-full object-cover grayscale-[0.3] hover:grayscale-0 transition-all duration-1000"
                width={1000}
                height={1000}
              />
              <div className="absolute inset-0 bg-linear-to-r from-[#0a0b14] via-[#0a0b14]/40 to-transparent pointer-events-none" />
              <div className="absolute inset-y-0 left-8 flex flex-col justify-center max-w-[240px] z-10">
                <p className="text-[10px] font-bold text-[#d4af37] tracking-widest uppercase mb-1">Pro Feature</p>
                <h4 className="text-white font-headline font-bold text-lg leading-tight">Studio Grade Precision</h4>
                <p className="text-xs text-slate-400 mt-2">Enhanced timeline precision for perfect synchronization.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-16 mb-8 w-full max-w-xl">
          <Link
            href="/dashboard"
            className="group relative px-10 py-4 bg-white text-[#0a0b14] rounded-xl font-headline font-bold text-lg transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link
            href="/dashboard"
            className="px-10 py-4 text-slate-400 hover:text-white border border-white/10 hover:border-white/30 rounded-xl font-headline font-bold text-lg transition-all w-full md:w-auto flex items-center justify-center gap-2 bg-white/5"
          >
            Upload New File
            <PlusSquare className="w-5 h-5" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}

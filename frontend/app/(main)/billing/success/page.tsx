import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  Gem,
  Languages,
  PlusSquare,
  Wallet,
} from "lucide-react";
import styles from "./BillingSuccess.module.css";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Upgrade Successful | Dubbing Studio Premium",
  description: "Your plan is active. Premium transcription and dubbing tools are unlocked.",
};

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuANkuUENN3hh_DZUxKHRqbVi_usD1ApmGWBMVuRSQTe_ynvOF5-EUQ2T-NT7hSuopeG_Cb_DdLorATLyAusSONO66Vo4gw__lHU1CtTNfb-ESQEXVr0t1UJMU2wLB1qMDS12eReu7LH2_xcVNDeCioo4YTQvcwa-Pvp8dRrQL7BbpeVO0EL5QO0YBEE-gSvcQEIrAtpkOJsB7C0-_6r0u901XKnRsJsmAGnhWqGiQKqjYkAYGjVCIsbq8ssI7rs7pVHCiLLLOrXvos";

export default function BillingSuccessPage() {
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
            Upgrade{" "}
            <span className={`${styles.metallic} ${styles.goldGlow}`}>Successful</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Welcome to the inner circle. Your Pro Plan is now active, unlocking premium AI precision and studio-grade
            tools for your workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div
            className={`lg:col-span-4 rounded-2xl p-8 flex flex-col justify-between bg-[#141624] ${styles.premiumBorder}`}
          >
            <div>
              <div className="flex items-center gap-2 mb-8">
                <Wallet className="text-[#d4af37] w-5 h-5" strokeWidth={1.75} aria-hidden />
                <h2 className="font-headline font-bold text-white uppercase tracking-widest text-xs">Summary</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Active Plan</p>
                  <p className="text-xl font-headline font-bold text-white flex items-center gap-2">
                    PRO{" "}
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      aria-hidden
                    />
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Credits Added</p>
                  <p className="text-2xl font-headline font-bold text-indigo-400">+250</p>
                </div>
                <div className="pt-6 border-t border-white/5">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1">Available Balance</p>
                  <p className="text-3xl font-headline font-extrabold text-white">
                    262 <span className="text-sm font-medium text-slate-400">credits</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <h3 className="font-headline font-bold text-white text-sm uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-2">
              <span className="w-1 h-1 bg-[#d4af37] rounded-full" aria-hidden />
              Exclusive Benefits Unlocked
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

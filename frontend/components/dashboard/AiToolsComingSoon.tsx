"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import FadingCircle from "@/components/FadingCircle";
import axios from "@/utils/axios";
import type { AxiosError } from "axios";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const DEFAULT_PRODUCTS = [
  {
    key: "subtitles",
    title: "Subtitles",
    icon: "closed_caption",
    description:
      "Upload audio or video and get accurate transcripts with timing. Export to SRT, VTT, or ASS for editing and publishing.",
    href: "/dashboard",
    cta: "Create subtitles",
  },
  {
    key: "dubbing",
    title: "Dubbing",
    icon: "translate",
    description:
      "Turn your content into another language with AI voices, timing sync, and a full dubbing editor for polish and export.",
    href: "/dashboard",
    cta: "Start dubbing",
  },
] as const;

export type AiToolsComingSoonProps = {
  /** Passed to `/api/coming-soon/notify` as `pageKey` (default: `ai-tools`). */
  pageKey?: string;
  /** Passed to `/api/coming-soon/notify` as `source` (default: `dashboard-ai-tools`). */
  source?: string;
  className?: string;
};

export default function AiToolsComingSoon({
  pageKey = "ai-tools",
  source = "dashboard-ai-tools",
  className,
}: AiToolsComingSoonProps) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const canSubmit = useMemo(() => isValidEmail(email), [email]);

  const handleNotify = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setAlreadyRegistered(false);

      const resp = await axios.post("/api/coming-soon/notify", {
        email: trimmed,
        pageKey,
        source,
      });

      const data = (resp?.data ?? {}) as { alreadyRegistered?: boolean };

      setAlreadyRegistered(Boolean(data.alreadyRegistered));
      setIsSubmitted(true);
      setEmail("");
    } catch (e: unknown) {
      const axiosErr = e as AxiosError<{ message?: string }>;
      const message =
        axiosErr?.response?.data?.message ||
        axiosErr?.message ||
        "Could not save your email. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={[
        "relative min-h-[calc(100vh-4rem)] pt-10 pb-20 px-6 lg:px-10",
        className ?? "",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-24 -translate-x-1/2 -translate-y-1/4 -z-10"
      >
        <FadingCircle size={480} color="var(--color-primary)" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-8 top-40 translate-x-1/4 -z-10 opacity-80 hidden md:block"
      >
        <FadingCircle size={280} color="var(--color-secondary)" />
      </div>

      <section className="max-w-3xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
            AI Tools — Roadmap
          </span>
        </div>

        <h1 className="font-headline text-3xl sm:text-4xl md:text-h1 leading-[1.12] font-bold text-on-surface mb-4 tracking-tight">
          A whole suite is{" "}
          <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">
            on the way
          </span>
          .
        </h1>
        <p className="text-on-surface-variant text-body md:text-body-lg max-w-2xl mx-auto mb-3 font-light leading-relaxed">
          We&apos;re building lots more AI-powered tools for creators and teams. Stay tuned for
          batch processing, voices, workflows, and more.
        </p>
        <p className="text-sm text-on-surface-variant/90 max-w-xl mx-auto mb-10 font-medium">
          Drop your email and we&apos;ll let you know as each drop ships. No spam.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 text-left mb-12">
          {DEFAULT_PRODUCTS.map((p) => (
            <div
              key={p.key}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur p-6 shadow-md hover:border-primary/25 transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
                </div>
                <div>
                  <p className="text-[10px] font-label font-bold uppercase tracking-wider text-green-600 mb-0.5">
                    Available now
                  </p>
                  <h2 className="font-headline text-lg font-extrabold text-on-surface">{p.title}</h2>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{p.description}</p>
              <Link
                href={p.href}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary font-label hover:underline underline-offset-2"
              >
                {p.cta}
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          ))}
        </div>

        <div className="rounded-4xl border border-outline-variant bg-surface-container-lowest/80 p-8 md:p-10 shadow-lg backdrop-blur text-left max-w-2xl mx-auto">
          <p className="text-center text-sm font-headline font-bold text-on-surface mb-6">
            Get notified when new AI tools launch
          </p>

          {isSubmitted ? (
            <div className="rounded-3xl border border-outline-variant bg-primary/5 px-5 py-4 text-sm text-on-surface text-center">
              {alreadyRegistered
                ? "You're already on the list for AI tools updates. We'll be in touch."
                : "Thanks! We'll email you when new AI tools go live."}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                className="w-full flex-1 rounded-3xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface shadow-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                pill
                disabled={!canSubmit || isSubmitting}
                onClick={handleNotify}
                className="whitespace-nowrap"
              >
                {isSubmitting ? "Joining…" : "Notify me"}
              </Button>
            </div>
          )}

          {errorMessage ? <p className="mt-3 text-xs text-red-600 text-center">{errorMessage}</p> : null}

          {!isSubmitted ? (
            <p className="mt-3 text-xs text-on-surface-variant text-center">
              We&apos;ll only email you about AI tools and product updates from Kili.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import FadingCircle from "@/components/FadingCircle";
import axios from "@/utils/axios";
import type { AxiosError } from "axios";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function DocsComingSoonPage() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
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
        pageKey: "docs",
        source: "navbar",
      });

      const data = (resp?.data ?? {}) as { alreadyRegistered?: boolean };

      setSubmittedEmail(trimmed);
      setAlreadyRegistered(Boolean(data.alreadyRegistered));
      setIsSubmitted(true);
      setEmail("");
    } catch (e: unknown) {
      const axiosErr = e as AxiosError<{ message?: string }>;
      const message =
        axiosErr?.response?.data?.message ||
        axiosErr?.message ||
        "Could not register you right now. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative pt-32">
      <section className="max-w-9xl mx-auto px-8 mb-40 text-center relative z-10 overflow-x-clip">
        <div
          aria-hidden
          className="pointer-events-none absolute left-40 top-0 -translate-x-1/2 -translate-y-[15%] -z-10"
        >
          <FadingCircle size={560} color="var(--color-primary)" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute right-20 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90"
        >
          <FadingCircle size={360} color="var(--color-secondary)" />
        </div>

        <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
            Docs - Coming soon
          </span>
        </div>

        <h1 className="font-headline text-h1 md:text-display leading-[1.1] font-bold text-on-surface mb-6 tracking-tight max-w-4xl mx-auto">
          Learn the workflow.{" "}<br />
          <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">
            Ship faster.
          </span>
        </h1>
        <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          We’re polishing step-by-step guides for uploads, subtitles, dubbing, export, and best
          practices.
        </p>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-4xl border border-outline-variant bg-surface-container-lowest/80 p-8 md:p-10 shadow-lg backdrop-blur">
            {submittedEmail && !isSubmitted ? (
              <div className="rounded-3xl border border-outline-variant bg-primary/5 px-5 py-4 text-sm text-on-surface">
                You’re already on the list:{" "}
                <span className="font-semibold text-primary">{submittedEmail}</span>
              </div>
            ) : null}

            {isSubmitted ? (
              <div className="rounded-3xl border border-outline-variant bg-primary/5 px-5 py-4 text-sm text-on-surface">
                {alreadyRegistered
                  ? "You’re already on the list. We’ll notify you when Docs launches."
                  : "Thanks! We’ll notify you when Docs launches."}
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
                  {isSubmitting ? "Notifying..." : "Notify me"}
                </Button>
              </div>
            )}

            {errorMessage ? (
              <p className="mt-3 text-xs text-red-600">{errorMessage}</p>
            ) : null}

            {!isSubmitted ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                No spam. We’ll only email you about Docs availability.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}


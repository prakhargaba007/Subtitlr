"use client";

import { useToasterToasts } from "@/hooks/use-toast";

export default function Toaster() {
  const toasts = useToasterToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex w-full max-w-sm flex-col gap-3 p-4 sm:p-0 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const destructive = t.variant === "destructive";
        return (
          <div
            key={t.id}
            className={[
              "pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md font-body transition-opacity",
              destructive
                ? "border-error/30 bg-error-container text-on-error-container"
                : "border-slate-200/80 bg-surface-container-lowest/95 text-on-surface",
            ].join(" ")}
          >
            {t.title ? (
              <p
                className={
                  destructive
                    ? "font-headline text-sm font-bold"
                    : "font-headline text-sm font-bold text-on-surface"
                }
              >
                {t.title}
              </p>
            ) : null}
            {t.description ? (
              <p
                className={
                  destructive
                    ? "mt-1 text-sm opacity-90"
                    : "mt-1 text-sm text-on-surface-variant"
                }
              >
                {t.description}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

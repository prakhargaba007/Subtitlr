import type { Metadata } from "next";
import FadingCircle from "@/components/FadingCircle";

export const metadata: Metadata = {
  title: "Help | Kili",
  description: "Get help with uploads, processing, billing, and troubleshooting.",
};

export default function HelpPage() {
  return (
    <main className="relative pt-32 pb-24 overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute left-40 top-10 -translate-x-1/2 -translate-y-[15%] -z-10"
      >
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-20 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90"
      >
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>

      <section className="max-w-9xl mx-auto px-8 mb-40 text-center relative z-10 overflow-x-clip">
        <header className="max-w-3xl mx-auto">
          {/* <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
              Support
            </span>
          </div> */}

          <h1 className="font-headline text-h2 md:text-h1 leading-[1.1] font-bold text-on-surface mb-4 tracking-tight">
            Help Center
          </h1>
          <p className="text-on-surface-variant text-body-lg leading-relaxed font-light">
            Quick answers for common issues — and a fast way to reach us if you’re stuck.
          </p>
        </header>

        <div className="mt-12 max-w-5xl mx-auto">
          <div className="rounded-4xl  backdrop-blur text-left">
            <div className="space-y-10 text-on-surface">
              <section className="space-y-3">
                <h2 className="text-h4 font-headline font-bold">Getting started</h2>
                <ul className="list-disc pl-6 space-y-2 text-body text-on-surface-variant leading-relaxed">
                  <li>
                    Go to <a className="text-primary hover:underline" href="/dashboard">Dashboard</a>{" "}
                    to upload and manage projects.
                  </li>
                  <li>
                    Visit <a className="text-primary hover:underline" href="/pricing">Pricing</a>{" "}
                    to understand plans and credits.
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-h4 font-headline font-bold">Upload &amp; processing issues</h2>
                <ul className="list-disc pl-6 space-y-2 text-body text-on-surface-variant leading-relaxed">
                  <li>Try a smaller file to rule out network/timeouts.</li>
                  <li>Confirm audio is present and not fully silent.</li>
                  <li>If processing seems stuck, refresh and check the project status again.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-h4 font-headline font-bold">Billing</h2>
                <p className="text-body text-on-surface-variant leading-relaxed">
                  For plan changes, invoices, and credit questions, the fastest path is to send us a
                  message with your account email and a short description of what you need.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-h4 font-headline font-bold">Contact support</h2>
                <p className="text-body text-on-surface-variant leading-relaxed">
                  Use the{" "}
                  <a className="text-primary hover:underline" href="/feedback">
                    feedback form
                  </a>{" "}
                  and choose the type that fits best (bug, feature request, or general).
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


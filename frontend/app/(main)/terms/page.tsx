import type { Metadata } from "next";
import FadingCircle from "@/components/FadingCircle";

export const metadata: Metadata = {
  title: "Terms of Service | Dubbing Studio",
  description: "The terms that govern your use of Dubbing Studio.",
};

export default function TermsOfServicePage() {
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
              Legal
            </span>
          </div> */}

          <h1 className="font-headline text-h2 md:text-h1 leading-[1.1] font-bold text-on-surface mb-4 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-on-surface-variant text-body-lg leading-relaxed font-light">
            These terms govern your use of Dubbing Studio.
          </p>
          <p className="mt-3 text-xs text-on-surface-variant">
            Effective date: April 17, 2026
          </p>
        </header>

        <div className="mt-12 max-w-5xl mx-auto">
          <div className="rounded-4xl text-left">
            <div className="space-y-10 text-on-surface">
            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">1. Using the service</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                You may use Dubbing Studio only in compliance with applicable law and these terms.
                You’re responsible for activities that occur under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">2. Your content</h2>
              <div className="space-y-4 text-body text-on-surface-variant leading-relaxed">
                <p>
                  You retain ownership of the content you upload. You grant us a license to process
                  your content solely to operate and provide the service (for example, generating
                  transcripts, subtitles, and dubbing outputs).
                </p>
                <p>
                  You represent that you have the rights needed to upload and process your content,
                  including any necessary permissions from third parties.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">3. Prohibited use</h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-on-surface-variant leading-relaxed">
                <li>Do not misuse the service (for example, attempt to access it unlawfully).</li>
                <li>Do not upload content you don’t have rights to use.</li>
                <li>Do not disrupt, overload, or interfere with the service.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">4. Termination</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                We may suspend or terminate access if we reasonably believe you’ve violated these
                terms or if needed to protect the service, our users, or the public.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">5. Disclaimers</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                The service is provided “as is” and “as available.” We do not warrant that it will
                be uninterrupted, error-free, or meet your requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">6. Contact</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                If you have questions about these terms, reach out via the{" "}
                <a className="text-primary hover:underline" href="/feedback">
                  feedback form
                </a>
                .
              </p>
            </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


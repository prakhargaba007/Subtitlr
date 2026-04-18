import type { Metadata } from "next";
import FadingCircle from "@/components/FadingCircle";

export const metadata: Metadata = {
  title: "Privacy Policy | Kili",
  description: "How Kili collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
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

      <section className="max-w-9xl mx-auto px-6 md:px-8 relative z-10 flex flex-col items-center">
        <header className="max-w-3xl text-center">
          {/* <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
              Privacy
            </span>
          </div> */}

          <h1 className="font-headline text-h2 md:text-h1 leading-[1.1] font-bold text-on-surface mb-4 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-on-surface-variant text-body-lg leading-relaxed font-light">
            This policy explains what we collect, why we collect it, and the choices you have.
          </p>
          <p className="mt-3 text-xs text-on-surface-variant">
            Effective date: April 17, 2026
          </p>
        </header>

        <div className="mt-12 max-w-5xl ">
          <div className="space-y-10 text-on-surface">
            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">1. Information we collect</h2>
              <div className="space-y-4 text-body text-on-surface-variant leading-relaxed">
                <p>
                  <span className="font-semibold text-on-surface">Account information</span>: if you
                  create an account, we collect details like your email address and basic profile
                  information.
                </p>
                <p>
                  <span className="font-semibold text-on-surface">Content you upload</span>: videos,
                  audio, subtitles, transcripts, and related metadata you submit to generate
                  transcriptions, subtitles, or dubs.
                </p>
                <p>
                  <span className="font-semibold text-on-surface">Usage information</span>: how you
                  use the product (e.g., features you interact with, pages visited, and actions
                  taken).
                </p>
                <p>
                  <span className="font-semibold text-on-surface">Device &amp; log data</span>:
                  information typically sent by your browser or device, such as IP address, browser
                  type, and timestamps.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">2. How we use information</h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-on-surface-variant leading-relaxed">
                <li>Provide and improve Kili features and performance.</li>
                <li>Process your uploads to generate transcriptions, subtitles, and dubbing outputs.</li>
                <li>Prevent abuse, troubleshoot issues, and keep the service secure.</li>
                <li>Communicate with you about product updates, billing, and support.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">3. How we share information</h2>
              <div className="space-y-4 text-body text-on-surface-variant leading-relaxed">
                <p>
                  We do not sell your personal information. We may share information with service
                  providers that help us operate the product (for example, hosting, analytics,
                  payments, and email delivery). These providers are authorized to use information
                  only as needed to provide services to us.
                </p>
                <p>
                  We may also share information when required by law, or to protect the rights,
                  safety, and security of Kili and our users.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">4. Data retention</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                We retain personal information for as long as necessary to provide the service and
                for legitimate business purposes (such as security, compliance, and dispute
                resolution). Retention periods can vary depending on the type of data and how it’s
                used.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">5. Security</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                We use reasonable administrative, technical, and organizational safeguards designed
                to protect your information. No method of transmission or storage is 100% secure,
                so we can’t guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">6. Your choices</h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-on-surface-variant leading-relaxed">
                <li>
                  You can request access, correction, or deletion of certain personal information,
                  subject to applicable law.
                </li>
                <li>You can opt out of non-essential product communications.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">7. Children’s privacy</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                Kili is not directed to children under 13, and we do not knowingly collect
                personal information from children under 13.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-h4 font-headline font-bold">8. Contact us</h2>
              <p className="text-body text-on-surface-variant leading-relaxed">
                Questions about privacy? Contact us via the{" "}
                <a className="text-primary hover:underline" href="/feedback">
                  feedback form
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}


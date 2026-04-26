import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "Explore common workflows for subtitles, translations, and AI dubbing—content teams, creators, educators, and product marketers.",
  alternates: { canonical: "/use-cases" },
  keywords: [
    "creator captions",
    "education subtitles",
    "podcast transcription",
    "video localization",
    "marketing video subtitles",
    "AI dubbing use cases",
    "low cost dubbing",
    "free AI dubbing",
  ],
};

export default function UseCasesPage() {
  return (
    <main className="relative pt-32 pb-24">
      <section className="max-w-7xl mx-auto px-8">
        <header className="max-w-3xl">
          <h1 className="font-headline text-h2 md:text-h1 leading-[1.1] font-bold text-on-surface mb-4 tracking-tight">
            Use Cases
          </h1>
          <p className="text-on-surface-variant text-body-lg leading-relaxed font-light">
            Practical workflows for subtitles and dubbing across teams.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-8">
            <h2 className="font-headline text-xl font-bold mb-2">Creators & short-form</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Generate subtitles, highlight active words, and export formats ready for Reels/TikTok.
            </p>
          </div>
          <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-8">
            <h2 className="font-headline text-xl font-bold mb-2">Education & training</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Improve accessibility and reach with multilingual captions and voice dubs.
            </p>
          </div>
          <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-8">
            <h2 className="font-headline text-xl font-bold mb-2">Podcasts & interviews</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Clean transcripts with speaker changes and export SRT/VTT for distribution.
            </p>
          </div>
          <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-8">
            <h2 className="font-headline text-xl font-bold mb-2">Product & marketing</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Localize demos and announcements with fast subtitles and AI dubbing.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-on-primary font-bold font-headline hover:opacity-95 transition"
          >
            View pricing
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-outline-variant/30 bg-surface-container-lowest px-6 py-3 text-on-surface font-bold font-headline hover:bg-surface-container-low transition"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}


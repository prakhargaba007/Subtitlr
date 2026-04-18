import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product | Kili",
  description:
    "Subtitles, dubbing, and more AI tools for creators. Join the waitlist for what's next.",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}

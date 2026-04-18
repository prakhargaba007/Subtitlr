import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tools | Kili",
  description:
    "Explore current AI tools and join the waitlist for upcoming features from Kili.",
};

export default function AiToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

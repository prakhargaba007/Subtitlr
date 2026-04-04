import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Subtitlr",
  description: "Sign in to Subtitlr to manage transcriptions and subtitles.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

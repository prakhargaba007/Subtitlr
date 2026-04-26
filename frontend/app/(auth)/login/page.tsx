import { Suspense } from "react";
import Login from "@/components/auth/login";

export const metadata = {
  title: "Sign In | Kili",
  description: "Sign in to Kili to manage transcriptions and subtitles.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <Login />
    </Suspense>
  );
}

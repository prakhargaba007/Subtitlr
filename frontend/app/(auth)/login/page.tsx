import { Suspense } from "react";
import Login from "@/components/auth/login";

export const metadata = {
  title: "Sign In | Dubbing Studio",
  description: "Sign in to Dubbing Studio to manage transcriptions and subtitles.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <Login />
    </Suspense>
  );
}

import { Suspense } from "react";
import ProcessingView from "./ProcessingView";

export const metadata = {
  title: "Processing | Kili",
  description: "Your file is being transcribed.",
  robots: { index: false, follow: false },
};

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ProcessingView />
    </Suspense>
  );
}

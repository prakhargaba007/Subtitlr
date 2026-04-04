import { Suspense } from "react";
import ProcessingView from "./ProcessingView";

export const metadata = {
  title: "Processing | Subtitlr",
  description: "Your file is being transcribed.",
};

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ProcessingView />
    </Suspense>
  );
}

import { Suspense } from "react";
import ProcessingView from "@/app/processing/ProcessingView";

export const metadata = {
  title: "Processing | Dubbing Studio",
  description: "Your file is being transcribed.",
};

export default function DashboardProcessingPage() {
  return (
    <Suspense fallback={<div className="h-full bg-surface" />}>
      <ProcessingView />
    </Suspense>
  );
}

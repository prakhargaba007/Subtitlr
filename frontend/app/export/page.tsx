import { Suspense } from "react";
import ExportView from "./ExportView";

export const metadata = {
  title: "Export Ready | Kili",
  description: "Your subtitles are ready. Preview, edit, and download.",
};

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ExportView />
    </Suspense>
  );
}

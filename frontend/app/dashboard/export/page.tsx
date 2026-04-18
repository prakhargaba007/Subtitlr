import { Suspense } from "react";
import ExportView from "@/app/export/ExportView";

export const metadata = {
  title: "Export Ready | Kili",
  description: "Your subtitles are ready. Preview, edit, and download.",
};

export default function DashboardExportPage() {
  return (
    <Suspense fallback={<div className="h-full bg-surface" />}>
      <ExportView />
    </Suspense>
  );
}

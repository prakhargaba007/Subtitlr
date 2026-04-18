import { Suspense } from "react";
import DubbingEditorPage from "@/app/dubbing/editor/page";

export const metadata = {
  title: "Dubbing editor | Kili",
  description: "Edit your dubbed segments precisely.",
};

export default function DashboardDubbingEditorPage() {
  return (
    <Suspense fallback={<div className="h-full bg-surface" />}>
      <DubbingEditorPage />
    </Suspense>
  );
}


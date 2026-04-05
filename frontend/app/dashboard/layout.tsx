import type { Metadata } from "next";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardRightPanel from "@/components/dashboard/DashboardRightPanel";
import DashboardInit from "@/components/dashboard/DashboardInit";
import UploadFAB from "@/components/dashboard/UploadFAB";

export const metadata: Metadata = {
  title: "Launchpad | Subtitlr",
  description: "Your transcription workspace.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-on-surface">
      <DashboardInit />
      <DashboardSidebar />
      <DashboardHeader />
      <DashboardRightPanel />

      <main className="ml-20 lg:ml-64 xl:mr-80 pt-16 h-screen overflow-y-auto custom-scrollbar relative">
        {children}
      </main>

      <UploadFAB />
    </div>
  );
}

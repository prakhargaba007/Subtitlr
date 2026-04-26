import type { Metadata } from "next";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardInit from "@/components/dashboard/DashboardInit";
import UploadFAB from "@/components/dashboard/UploadFAB";

export const metadata: Metadata = {
  title: "Launchpad | Kili",
  description: "Your transcription workspace.",
  robots: { index: false, follow: false },
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
      {/* <DashboardHeader /> */}

      <main className="ml-20 lg:ml-64 h-screen overflow-y-auto custom-scrollbar relative">
        {children}
      </main>

      <UploadFAB />
    </div>
  );
}

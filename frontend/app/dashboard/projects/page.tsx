import ProjectList from "@/components/dashboard/ProjectList";

export default function DashboardProjectsPage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <ProjectList title="All Projects" pageSize={12} showSeeAll={false} layout="grid" />
    </div>
  );
}


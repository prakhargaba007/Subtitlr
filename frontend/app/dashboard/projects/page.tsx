"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProjectList, {
  DEFAULT_PROJECT_FILTERS,
  parseProjectFilters,
  type ProjectFilters,
} from "@/components/dashboard/ProjectList";

function DashboardProjectsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseProjectFilters(searchParams);

  const handleFiltersChange = (nextFilters: ProjectFilters) => {
    const params = new URLSearchParams(searchParams?.toString());
    const entries: Array<[keyof ProjectFilters, string]> = [
      ["type", DEFAULT_PROJECT_FILTERS.type],
      ["created", DEFAULT_PROJECT_FILTERS.created],
      ["status", DEFAULT_PROJECT_FILTERS.status],
      ["sort", DEFAULT_PROJECT_FILTERS.sort],
    ];

    for (const [key, defaultValue] of entries) {
      if (nextFilters[key] === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, nextFilters[key]);
      }
    }

    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="max-w-9xl mx-auto px-8 py-12">
      <ProjectList
        title="All Projects"
        pageSize={12}
        showSeeAll={false}
        layout="grid"
        showFilters
        initialFilters={filters}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}

export default function DashboardProjectsPage() {
  return (
    <Suspense fallback={<div className="max-w-9xl mx-auto px-8 py-12" />}>
      <DashboardProjectsContent />
    </Suspense>
  );
}


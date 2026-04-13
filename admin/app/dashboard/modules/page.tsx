"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModulesPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard/modules/all-modules");
  }, [router]);

  return null;
}

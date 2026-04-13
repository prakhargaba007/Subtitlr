"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoursesPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard/courses/all-courses");
  }, [router]);

  return null;
}
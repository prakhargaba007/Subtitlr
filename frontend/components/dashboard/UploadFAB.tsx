"use client";

import { useRouter } from "next/navigation";

export default function UploadFAB() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/dashboard")}
      aria-label="Upload new file"
      className="xl:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-on-primary shadow-xl shadow-primary/40 flex items-center justify-center z-50 hover:bg-primary/90 transition-colors"
    >
      <span className="material-symbols-outlined text-3xl">add</span>
    </button>
  );
}

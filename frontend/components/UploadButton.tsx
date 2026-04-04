"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const params = new URLSearchParams({
      name: file.name,
      size: String(file.size),
    });
    router.push(`/processing?${params.toString()}`);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.mp3,.wav,.m4a,.webm,.mov,.avi,.mkv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="primary"
        size="xl"
        className="w-full md:w-auto shadow-xl hover:shadow-primary/20"
        onClick={() => inputRef.current?.click()}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          upload_file
        </span>
        Upload File
      </Button>
    </>
  );
}

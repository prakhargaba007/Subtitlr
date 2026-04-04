"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type Toast = ToastInput & { id: string };

const TOAST_DURATION_MS = 4500;

let toastId = 0;
let memoryToasts: Toast[] = [];
const listeners = new Set<(toasts: Toast[]) => void>();

function emit() {
  const snapshot = [...memoryToasts];
  listeners.forEach((fn) => fn(snapshot));
}

export function toast(input: ToastInput) {
  const id = `toast-${++toastId}`;
  const entry: Toast = { id, ...input };
  memoryToasts = [...memoryToasts, entry];
  emit();
  globalThis.setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    emit();
  }, TOAST_DURATION_MS);
  return id;
}

export function useToast() {
  return {
    toast: useCallback((input: ToastInput) => toast(input), []),
  };
}

/** Subscribes to the toast list for rendering (used by Toaster). */
export function useToasterToasts() {
  const [toasts, setToasts] = useState<Toast[]>(() => [...memoryToasts]);

  useEffect(() => {
    const sync = (next: Toast[]) => setToasts(next);
    listeners.add(sync);
    sync([...memoryToasts]);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return toasts;
}

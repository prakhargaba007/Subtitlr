import React from "react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  cancelText?: string;
  confirmText?: string;
  confirmingText?: string;
  isConfirming?: boolean;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmVariant?: "danger" | "primary";
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  cancelText = "Cancel",
  confirmText = "Confirm",
  confirmingText = "Confirming...",
  isConfirming = false,
  confirmDisabled = false,
  onClose,
  onConfirm,
  confirmVariant = "danger",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 border-none cursor-default"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-2xl">
        <h3 className="text-lg font-extrabold font-headline text-on-surface">{title}</h3>
        <p className="mt-2 text-sm text-on-surface-variant font-body">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm font-headline font-bold hover:bg-surface-container transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isConfirming || confirmDisabled}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-headline font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:pointer-events-none ${
              confirmVariant === "danger"
                ? "bg-error-container text-on-error-container"
                : "bg-primary text-on-primary"
            }`}
          >
            {isConfirming ? confirmingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

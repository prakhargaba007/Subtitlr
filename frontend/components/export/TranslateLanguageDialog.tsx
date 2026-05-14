"use client";

export interface TranslateLangRow {
  lang_name: string;
  label: string;
}

type TranslateLanguageDialogProps = {
  open: boolean;
  onClose: () => void;
  languages: TranslateLangRow[];
  languagesError: string | null;
  languagesLoading: boolean;
  value: string;
  onChange: (langName: string) => void;
  creditsCost: number;
  creditsBalance: number | null;
  currentLanguage: string;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
};

export default function TranslateLanguageDialog({
  open,
  onClose,
  languages,
  languagesError,
  languagesLoading,
  value,
  onChange,
  creditsCost,
  creditsBalance,
  currentLanguage,
  isSubmitting,
  error,
  onConfirm,
}: TranslateLanguageDialogProps) {
  if (!open) return null;

  const canConfirm =
    Boolean(value.trim()) && !languagesLoading && !isSubmitting && languages.length > 0;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="translate-dialog-title"
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-outline-variant/10 flex items-start justify-between gap-3">
          <div>
            <h2 id="translate-dialog-title" className="font-headline font-bold text-on-surface text-base">
              Generate in another language
            </h2>
            {/* <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Timestamps stay the same; only line text is translated. A new subtitle job and dashboard project
              are created; the original stays unchanged.
            </p> */}
            <p className="text-[11px] text-on-surface-variant/80 mt-1.5">
              Current: <span className="font-medium text-on-surface capitalize">{currentLanguage}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {languagesLoading ? (
            <div className="h-11 rounded-xl bg-surface-container-low animate-pulse" />
          ) : languagesError ? (
            <p className="text-sm text-red-600/90">{languagesError}</p>
          ) : (
            <div>
              <label htmlFor="translate-target-lang" className="block text-[11px] font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Target language
              </label>
              <select
                id="translate-target-lang"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/25 bg-surface-container-lowest text-sm text-on-surface font-body focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="">Choose a language…</option>
                {languages.map((l) => (
                  <option key={l.lang_name} value={l.lang_name}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* {creditsBalance !== null && (
            <p className="text-[11px] text-on-surface-variant">
              Your balance: <span className="font-semibold text-on-surface">{creditsBalance}</span> credits
            </p>
          )} */}

          {error && <p className="text-sm text-red-600/90">{error}</p>}
        </div>

        <div className="px-5 py-4 bg-surface-container-low/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-outline-variant/10">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-sm font-headline font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-full text-sm font-headline font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                Translating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">translate</span>
                Translate 
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

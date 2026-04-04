/**
 * Module-level singleton to pass a File object between routes.
 * A File cannot be serialised into URL params or Redux state, so we hold
 * a reference here for the duration of the browser session.
 */
let pendingFile: File | null = null;

export const setPendingFile = (file: File | null): void => {
  pendingFile = file;
};

export const getPendingFile = (): File | null => pendingFile;

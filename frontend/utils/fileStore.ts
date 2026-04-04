/**
 * Module-level singleton to pass upload state between routes.
 * File objects and arbitrary state cannot be serialised into URL params or
 * Redux, so we hold references here for the duration of the browser session.
 */
let pendingFile: File | null = null;
let pendingLanguage: string = "";

export const setPendingFile = (file: File | null): void => {
  pendingFile = file;
};

export const getPendingFile = (): File | null => pendingFile;

export const setPendingLanguage = (lang: string): void => {
  pendingLanguage = lang;
};

export const getPendingLanguage = (): string => pendingLanguage;

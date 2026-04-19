/**
 * Module-level singleton to pass upload state between routes.
 * File objects and arbitrary state cannot be serialised into URL params or
 * Redux, so we hold references here for the duration of the browser session.
 */
let pendingFile: File | null = null;
let pendingLanguage: string = "";
let pendingMode: "subtitles" | "dubbing" = "dubbing";
let pendingTargetLanguage: string = "";
let pendingSourceLanguage: string = "";
let pendingYoutubeUrl: string = "";

export const setPendingFile = (file: File | null): void => {
  pendingFile = file;
  if (file) pendingYoutubeUrl = "";
};

export const getPendingFile = (): File | null => pendingFile;

export const setPendingLanguage = (lang: string): void => {
  pendingLanguage = lang;
};

export const getPendingLanguage = (): string => pendingLanguage;

export const setPendingMode = (mode: "subtitles" | "dubbing"): void => {
  pendingMode = mode;
};

export const getPendingMode = (): "subtitles" | "dubbing" => pendingMode;

export const setPendingTargetLanguage = (lang: string): void => {
  pendingTargetLanguage = lang;
};

export const getPendingTargetLanguage = (): string => pendingTargetLanguage;

export const setPendingSourceLanguage = (lang: string): void => {
  pendingSourceLanguage = lang;
};

export const getPendingSourceLanguage = (): string => pendingSourceLanguage;

export const setPendingYoutubeUrl = (url: string): void => {
  pendingYoutubeUrl = url;
  if (url) pendingFile = null;
};

export const getPendingYoutubeUrl = (): string => pendingYoutubeUrl;

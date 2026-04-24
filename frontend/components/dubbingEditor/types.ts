export type DubbingSegment = {
  segmentId: string;
  revision?: number;
  start: number;
  end: number;
  speaker_id: string;
  originalText?: string;
  translatedText?: string;
  timingStrategy?: string | null;
  dubbedAudioKey?: string | null;
};

export type SpeakerProfile = {
  speaker_id: string;
  voice_description?: string;
  elevenlabs_voice_id?: string | null;
};

export type EditorJob = {
  _id: string;
  status: string;
  originalFileName: string;
  fileType: "video" | "audio";
  duration: number;
  sourceLanguage: string;
  targetLanguage: string;
  originalVideoKey?: string | null;
  originalAudioKey?: string | null;
  dubbedVideoKey?: string | null;
  dubbedAudioKey?: string | null;
  dubbedVideoUrl?: string | null;
  dubbedAudioUrl?: string | null;
  speakerProfiles: SpeakerProfile[];
  segments: DubbingSegment[];
  error?: string | null;
};

export function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs - Math.floor(secs)) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function fmtTimeShort(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

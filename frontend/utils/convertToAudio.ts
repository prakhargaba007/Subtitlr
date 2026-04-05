/**
 * Converts a video File to a WAV audio File using the browser's Web Audio API.
 * Audio-only files are returned as-is without any processing.
 *
 * Why WAV? It requires zero extra libraries — we write the PCM header ourselves.
 * The backend (Whisper) handles WAV natively, so there's no quality loss.
 */

export type ConversionProgress = (pct: number) => void;

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // Interleave all channels into a single Float32 array
  const interleaved = new Float32Array(length * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  // Clamp and convert to signed 16-bit PCM
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const dataLength = pcm.buffer.byteLength;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF WAV header
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);               // fmt chunk size
  view.setUint16(20, 1, true);                // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true);  // block align
  view.setUint16(34, 16, true);               // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  new Int16Array(wavBuffer, 44).set(pcm);
  return wavBuffer;
}

/**
 * Converts any video file to a WAV audio File.
 * Audio files are returned unchanged.
 *
 * @param file     The source File (video or audio).
 * @param onProgress  Optional callback receiving 0–100 progress values.
 */
export async function convertToAudio(
  file: File,
  onProgress?: ConversionProgress,
): Promise<File> {
  if (file.type.startsWith("audio/")) return file;

  onProgress?.(5);

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(30);

  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();
  onProgress?.(70);

  const wavBytes = audioBufferToWav(audioBuffer);
  onProgress?.(95);

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const wavFile = new File([wavBytes], `${baseName}.wav`, { type: "audio/wav" });
  onProgress?.(100);

  return wavFile;
}

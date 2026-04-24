const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const { cleanupPath } = require("./audioUtils");

let _elevenlabs = null;
const getElevenLabs = () => {
  if (!_elevenlabs) _elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  return _elevenlabs;
};

// Replicate model for Demucs 2-stem separation — latest version as of Apr 2026
// htdemucs with stem=vocals splits into: vocals + no_vocals (background)
const REPLICATE_MODEL = "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77";

// How long to wait between Replicate polling requests (ms)
const REPLICATE_POLL_INTERVAL_MS = 3000;
// Maximum total wait time before giving up on Replicate (ms)
const REPLICATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Download a file from a URL to a local path.
 */
const downloadFile = (url, destPath) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${response.statusCode}: ${url}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        console.error(`[sourceSeparation] downloadFile failed for ${url}:`, err);
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });

/**
 * Call the Replicate API to run Demucs source separation.
 * Returns { vocalsUrl, backgroundUrl } — download URLs for the two stems.
 *
 * @param {string} audioPath - Path to the input mp3 file
 * @returns {Promise<{vocalsUrl:string, backgroundUrl:string}>}
 */
const separateViaReplicate = async (audioPath) => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const audioBase64 = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;

  // Create prediction
  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL,
      input: {
        audio: audioBase64,
        stem: "vocals",
        model: "htdemucs",
        output_format: "mp3",
      },
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.text();
    console.error("[sourceSeparation] Replicate create prediction failed:", err);
    throw new Error(`Replicate create prediction failed: ${err}`);
  }

  const prediction = await createResponse.json();
  const predictionId = prediction.id;

  // Poll until complete or timed out
  const startTime = Date.now();
  while (true) {
    if (Date.now() - startTime > REPLICATE_TIMEOUT_MS) {
      throw new Error("Replicate prediction timed out after 10 minutes");
    }

    await new Promise((r) => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));

    const pollResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      }
    );

    if (!pollResponse.ok) {
      console.error(`[sourceSeparation] Replicate poll failed with status ${pollResponse.status}`);
      throw new Error(`Replicate poll failed with status ${pollResponse.status}`);
    }

    const status = await pollResponse.json();

    if (status.status === "succeeded") {
      // Output is an object: { vocals: url, no_vocals: url }
      const output = status.output;
      if (!output || !output.vocals || !output.no_vocals) {
        throw new Error("Replicate returned unexpected output structure");
      }
      return { vocalsUrl: output.vocals, backgroundUrl: output.no_vocals };
    }

    if (status.status === "failed" || status.status === "canceled") {
      console.error(`[sourceSeparation] Replicate prediction ${status.status}:`, status.error);
      throw new Error(`Replicate prediction ${status.status}: ${status.error || "unknown error"}`);
    }

    // status is "starting" or "processing" — keep polling
  }
};

/**
 * Fallback: use ElevenLabs Audio Isolation API to extract clean vocals.
 * The background track will be the original audio (imperfect but usable).
 *
 * @param {string} audioPath
 * @param {string} outputDir
 * @returns {Promise<{vocalsPath:string, backgroundPath:string}>}
 */
const separateViaElevenLabs = async (audioPath, outputDir) => {
  console.warn("[sourceSeparation] Using ElevenLabs fallback — background track = original audio");

  const audioStream = fs.createReadStream(audioPath);
  const isolatedStream = await getElevenLabs().audioIsolation.convert({
    audio: audioStream,
  });

  const vocalsPath = path.join(outputDir, `vocals_${uuidv4()}.mp3`);
  const chunks = [];
  for await (const chunk of isolatedStream) {
    chunks.push(chunk);
  }
  fs.writeFileSync(vocalsPath, Buffer.concat(chunks));

  // Background = original (we don't have a clean background with this fallback)
  const backgroundPath = path.join(outputDir, `background_${uuidv4()}.mp3`);
  fs.copyFileSync(audioPath, backgroundPath);

  return { vocalsPath, backgroundPath };
};

/**
 * Last-resort fallback: no source separation at all.
 * Both vocals and background point to the original audio.
 * Transcription quality is lower (music bleeds in) but the pipeline still runs.
 *
 * @param {string} audioPath
 * @param {string} outputDir
 * @returns {{vocalsPath:string, backgroundPath:string}}
 */
const separateNoOp = (audioPath, outputDir) => {
  console.warn("[sourceSeparation] No separation available — using original audio for both stems");
  const vocalsPath     = path.join(outputDir, `vocals_${uuidv4()}.mp3`);
  const backgroundPath = path.join(outputDir, `background_${uuidv4()}.mp3`);
  fs.copyFileSync(audioPath, vocalsPath);
  fs.copyFileSync(audioPath, backgroundPath);
  return { vocalsPath, backgroundPath };
};

/**
 * Separate an audio file into two stems: vocals and background (music + SFX).
 *
 * Primary: Replicate API (Demucs htdemucs — clean separation of both stems)
 * Fallback: ElevenLabs Audio Isolation (vocals only; background = original)
 *
 * @param {string} audioPath - Absolute path to source mp3
 * @param {string} outputDir - Directory to write stem files into
 * @returns {Promise<{
 *   vocalsPath: string,
 *   backgroundPath: string,
 *   method: "replicate" | "elevenlabs_fallback"
 * }>}
 */
const separateVocalsAndBackground = async (audioPath, outputDir) => {
  fs.mkdirSync(outputDir, { recursive: true });

  // Try Replicate first
  if (process.env.REPLICATE_API_TOKEN) {
    try {
      const { vocalsUrl, backgroundUrl } = await separateViaReplicate(audioPath);

      const vocalsPath = path.join(outputDir, `vocals_${uuidv4()}.mp3`);
      const backgroundPath = path.join(outputDir, `background_${uuidv4()}.mp3`);

      await Promise.all([
        downloadFile(vocalsUrl, vocalsPath),
        downloadFile(backgroundUrl, backgroundPath),
      ]);

      return { vocalsPath, backgroundPath, method: "replicate" };
    } catch (replicateErr) {
      console.warn(
        `[sourceSeparation] Replicate failed (${replicateErr.message}), falling back to ElevenLabs`
      );
    }
  } else {
    console.warn(
      "[sourceSeparation] REPLICATE_API_TOKEN not set, falling back to ElevenLabs"
    );
  }

  // ElevenLabs fallback
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const { vocalsPath, backgroundPath } = await separateViaElevenLabs(audioPath, outputDir);
      return { vocalsPath, backgroundPath, method: "elevenlabs_fallback" };
    } catch (elErr) {
      console.warn(
        `[sourceSeparation] ElevenLabs fallback failed (${elErr.message}), using no-op separation`
      );
    }
  }

  // No-op last resort — pipeline continues without source separation
  const { vocalsPath, backgroundPath } = separateNoOp(audioPath, outputDir);
  return { vocalsPath, backgroundPath, method: "no_separation" };
};

module.exports = { separateVocalsAndBackground };

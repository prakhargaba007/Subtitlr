# AI Dubbing Pipeline Architecture

The dubbing pipeline is the core AI engine of the Kili Labs platform. It transforms an input video/audio file into a fully localized media asset using a complex, multi-stage, asynchronous workflow.

## 📁 Source Code
The entire orchestration happens within **[`../backend/controllers/dubbingController.js`](../backend/controllers/dubbingController.js)**.

## 🔄 The 7-Step Workflow

When a user submits a job via `POST /api/dubbing/`, the following steps execute:

### 1. Audio Extraction
If the input is a video (`.mp4`), `fluent-ffmpeg` extracts the audio track into a temporary `.mp3` file. This raw audio is saved as an artifact.

### 2. Source Separation (Vocals & Background)
The backend calls an external service (typically **Replicate** running the **Demucs** model) to split the audio into two isolated stems:
- `vocals.mp3`: Contains only the human speech.
- `background.mp3`: Contains music, sound effects, and ambient noise.
This step is crucial so that the new localized voice can be laid over the original background track without losing the video's original atmosphere.

### 3. Transcription & Diarization
The `vocals.mp3` track is sent to **Google Gemini**. Gemini performs speech-to-text (STT) and speaker diarization.
- It returns an array of segments with start/end timestamps, the transcribed text, and a `speaker_id`.
- An array of `speaker_profiles` is also generated.

### 4. Translation
The transcribed segments are passed to **OpenAI (GPT-4o-mini)**.
- The AI translates the text into the requested target language.
- It returns "speech-ready" translated text, taking care to maintain the conversational tone and context.

### 5. Text-to-Speech (TTS) Synthesis
For every translated segment, the backend generates a localized audio clip using the chosen TTS provider:
- **ElevenLabs**, **Inworld**, **Sarvam**, **Smallest AI**, or **Gemini TTS**.
- The `speaker_id` determines which specific voice profile is used for the generation to maintain consistency.

### 6. Timing Synchronization
Because languages have different pacing (e.g., Spanish takes longer to speak than English), the newly generated audio clips rarely match the exact duration of the original segments.
- `fluent-ffmpeg` is used to adjust the tempo (`atempo` filter) of the generated TTS clips.
- This ensures the localized audio fits perfectly within the original time boundaries, aiding in pseudo-lip-syncing and preventing audio overlap.

### 7. Audio Mixing & Video Muxing
Finally, the pipeline reassembles the media:
- The tempo-adjusted, localized TTS clips are sequenced onto a silent timeline.
- This new vocal track is mixed with the `background.mp3` extracted in Step 2.
- The final mixed audio is muxed (merged) back with the original video file using `ffmpeg`.
- The final output is uploaded to AWS S3, and the `DubbingJob` document is marked as `completed`.

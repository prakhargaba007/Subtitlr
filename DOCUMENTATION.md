# Documentation (deep dive)

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Data Model (MongoDB)](#data-model-mongodb)
4. [Storage (Local vs S3)](#storage-local-vs-s3)
5. [Background Jobs & Workers (BullMQ)](#background-jobs--workers-bullmq)
6. [Dubbing Pipeline](#dubbing-pipeline)
7. [Subtitle Pipeline](#subtitle-pipeline)
8. [Authentication & RBAC](#authentication--rbac)
9. [Auth Flow Walkthrough](#auth-flow-walkthrough)
10. [Middleware Layer](#middleware-layer)
11. [Billing (Dodo Payments)](#billing-dodo-payments)
12. [Operational Troubleshooting](#operational-troubleshooting)

---

## Overview

This document is the “why + how” reference for the **Kili Labs Video Transcribe** monorepo. For quick setup commands, start with the root `README.md` and each app’s README.

---

## What this system does

At a high level, the platform turns user-uploaded media into:

- **Transcripts** (timed text)
- **Subtitles** (SRT / VTT / ASS exports)
- **Dubbed audio/video** (translated speech synthesized via a chosen TTS provider, mixed back into the original media)

The long-running work is executed as **background jobs** (BullMQ/Redis) so the UI can poll for status while the backend runs FFmpeg + AI calls.

---

## Architecture overview

### Components

- **Frontend (`frontend/`)**: customer-facing Next.js app (upload, editor, preview, export)
- **Backend (`backend/`)**: Express API (auth, billing, orchestration, storage, queues)
- **Admin (`admin/`)**: internal dashboard (RBAC-protected insights + operations)

### Core dependencies

- **MongoDB**: persistent state (users/projects/files/jobs/usage)
- **Redis**: BullMQ queues + worker coordination
- **FFmpeg**: media extraction, mixing, muxing, timing adjustments

### AI providers (configurable)

- **Gemini**: transcription + translation + (optionally) TTS
- **OpenAI**: translation helpers + TTS (optional)
- **ElevenLabs / Inworld / Smallest.ai / Sarvam**: TTS options
- **Replicate (Demucs)**: optional vocal/background separation

---

## Data model (MongoDB)

The backend persists enough state to:

- Resume long-running jobs safely (retryable steps, status tracking)
- Let the UI poll for progress and render intermediate artifacts
- Track usage/credits/billing and audit cost-driving actions

### High-signal collections

- **Users & billing**
  - `User`, `UserSubscription`, `PlanCatalog`
  - `UserUsage`, `CreditTransaction`
- **Projects & assets**
  - `Project`, `File`
- **Processing jobs**
  - `DubbingJob`, `Subtitle`
- **Observability**
  - `ErrorLog`

---

## Storage (local vs S3)

The platform supports two storage strategies:

### Local storage

- Set `STORAGE_TYPE=local`
- Uploads and generated artifacts are stored under the backend’s filesystem (commonly under `public/` or a configured uploads directory).

### S3 storage

- Set `STORAGE_TYPE=s3`
- Provide bucket + IAM credentials + region.
- Optionally set `S3_PUBLIC_BASE_URL` to control how assets are served/embedded in the UI.

The frontend/admin often need **`NEXT_PUBLIC_S3_BASE_URL`** to render stored images and downloadable assets consistently.

---

## Background jobs & workers (BullMQ)

Long-running media workflows run asynchronously to avoid HTTP timeouts and to allow retries.

### Queue configuration

From `backend/utils/queue.js`:

| Setting | Value |
|---|---|
| Queue name | `video-processing` |
| Job name | `process-video` |
| Redis host | `REDIS_HOST` env or `localhost` |
| Redis port | `REDIS_PORT` env or `6379` |
| Job timeout | `18,000,000 ms` (5 hours) |
| Max attempts | `3` |
| Backoff | Exponential, starting at 1000 ms |

### Queueing

### Worker

- Start with `npm run worker` from `backend/`.
- Without the worker, API requests can enqueue jobs, but processing won’t progress.

### Typical job state flow (conceptual)

While exact status enums may differ by controller, most jobs follow a pattern like:

1. **queued** → worker receives job
2. **extracting** → FFmpeg pulls audio/video streams
3. **separating** (optional) → vocals/background split (Demucs)
4. **transcribing** → AI ASR (often Gemini)
5. **translating** → LLM translation + normalization
6. **generating** → TTS generation per segment
7. **syncing** → tempo correction (`atempo`) to match timing
8. **mixing/muxing** → combine tracks + mux into output video
9. **completed** (or **failed** with recoverable logs)

For dubbing specifics, see `docs/AI_DUBBING_PIPELINE.md`.

---

## Dubbing pipeline

This pipeline lives primarily in `backend/controllers/dubbingController.js` and related utilities.

### Stages (practical overview)

- **Audio extraction**: get a stable audio track from the source file.
- **(Optional) source separation**: isolate vocals so transcription and silence detection are cleaner.
- **Transcription + diarization**: timed segments + speaker hints.
- **Translation**: segment-level translation with formatting constraints.
- **Voice selection** (provider-dependent): map segments/speakers to voices.
- **TTS**: synthesize per segment.
- **Timing**: ensure each synthesized segment fits the target time window.
- **Mixing**: combine synthesized speech with background bed.
- **Muxing**: re-attach to the original video stream to produce final export.

### Provider selection and “auto” mode

`DUBBING_TTS_PROVIDER=auto` picks a provider based on available keys/config. To force one provider, set:

- `openai` / `inworld` / `smallest` / `elevenlabs` / `sarvam` / `gemini`

See `backend/.env.example` for all toggles and provider-specific settings.

---

## Subtitle pipeline

Subtitle generation lives primarily in `backend/controllers/subtitleController.js`.

Outputs usually include:

- **SRT**
- **VTT**
- **ASS**

### Optional VAD refinement (Silero)

The backend supports Silero VAD to improve “speech vs silence” alignment:

- `SUBTITLE_USE_SILERO_VAD=1` enables VAD timeline generation (requires a working Python environment + torch).
- There are two modes:
  - `full_audio`: Whisper on the full file, then filter cues via VAD overlap
  - `clips`: only transcribe VAD speech windows

All VAD configuration is documented inline in `backend/.env.example`.

---

## Authentication & RBAC

- The frontend and admin authenticate against the backend.
- The admin UI depends on backend admin routes (`/api/admin/*`) which enforce an **admin role** check on the JWT.

If the admin UI is reachable but requests return `401/403`, the authenticated user likely lacks the `admin` role or the token refresh flow is failing.

---

## Auth Flow Walkthrough

A step-by-step trace of what happens when a user logs in and makes an authenticated request.

### Step 1 — Login

1. The client sends `POST /api/auth/login` with `{ id, password }` (email/username + password)
2. `authController.login` validates credentials and calls `bcrypt.compare`
3. Two JWTs are created:
   - **Access token** (short-lived, e.g. 15 min) — contains `userId`, signed with `JWT_SECRET`
   - **Refresh token** (long-lived) — stored in the `RefreshToken` MongoDB collection
4. Both tokens are written as `HttpOnly` cookies (`accessToken`, `refreshToken`)
5. A **readable** `csrfToken` cookie is also set (same value as a claim in the access token; not HttpOnly so JavaScript can read it)
6. The response body returns basic user info

### Step 2 — Authenticated API request

1. The browser sends the `accessToken` cookie automatically (due to `withCredentials: true`)
2. `is-auth.js` middleware reads and verifies the JWT from the `accessToken` cookie
3. For `POST/PUT/PATCH/DELETE`: the middleware reads `csrfToken` cookie and compares to `X-CSRF-Token` header — rejects with 403 if they do not match
4. `req.userId` is set to the decoded user ID for downstream controllers

### Step 3 — Token refresh

1. The access token expires → backend returns `HTTP 401`
2. The frontend/admin Axios interceptor detects 401 and calls `POST /api/auth/refresh`
3. The backend validates the `refreshToken` cookie against the stored `RefreshToken` document (checks `User.tokenVersion`)
4. A **new access token** (and optionally a rotated refresh token) are issued as new cookies
5. The interceptor retries all queued requests with the new token

### Step 4 — Logout

1. `POST /api/auth/logout` — clears both token cookies and deletes the `RefreshToken` document
2. `POST /api/auth/logout-all` — increments `User.tokenVersion`, invalidating **all** existing refresh tokens

### CSRF protection summary

```text
Login response
  └─ Sets HttpOnly accessToken cookie       (cannot be read by JS)
  └─ Sets HttpOnly refreshToken cookie      (cannot be read by JS)
  └─ Sets readable csrfToken cookie         (readable by JS)

Every mutating request (POST/PUT/PATCH/DELETE)
  └─ Frontend reads csrfToken from document.cookie
  └─ Attaches it as X-CSRF-Token header
  └─ is-auth.js: cookie value === header value? ✓ proceed : ✗ 403
```

---

## Middleware Layer

The middleware stack for a typical authenticated request in request-arrival order:

```text
app.js global middleware
  1. trust proxy          — correct IP for rate limiting behind load balancers
  2. helmet               — CSP and security headers
  3. cookie-parser        — populates req.cookies
  4. CORS                 — validates origin, sets Allow-Credentials
  5. express.raw          — raw body (only for /api/webhooks/dodo)
  6. bodyParser.json      — 5 MB JSON body limit
  7. bodyParser.urlencoded

Route-level middleware (applied per route)
  8. is-auth.js           — JWT verification + CSRF check → sets req.userId
  9. is-admin.js          — role check (admin/sub-admin only) [optional]
 10. optional-user.js     — soft auth, sets req.userId if token present [optional]
 11. checkDubbingLimits   — idempotency, quota, concurrency, plan feature gate [dubbing routes]
 12. dubbingPrepareS3Input — S3-key-to-temp-file for dubbing [dubbing routes]
 13. subtitlePrepareS3Input — S3-key-to-temp-file for subtitles [subtitle routes]
 14. multer               — multipart file upload (applied inline in route files)

Global error handler
 15. Logs ErrorLog to MongoDB, emails admin, returns JSON error response
```

For a full description of each middleware file and what it sets on `req`, see [Middleware](./backend/DOCUMENTATION.md#middleware) in `backend/DOCUMENTATION.md`.

---

## Billing (Dodo Payments)

Billing is implemented in the backend and exposed to both the frontend and admin surfaces.

- See `docs/PAYMENTS.md` for a complete breakdown.
- Webhooks are received at `/api/webhooks/dodo` and verified using `DODO_PAYMENTS_WEBHOOK_KEY`.

---

## Operational troubleshooting

### “Processing never starts”

- Confirm **Redis** is running
- Confirm the backend **worker** is running (`backend: npm run worker`)
- Check that the job was actually enqueued (queue producer path executed)

### “Jobs fail quickly”

- Validate required AI keys (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, etc.)
- Confirm storage mode is configured correctly (`STORAGE_TYPE`, S3 keys)

### “Output media has timing issues”

- Review `DUBBING_MAX_ATEMPO` (and language-specific cap like `DUBBING_MAX_ATEMPO_HI`)
- Inspect segment durations vs synthesized audio duration

### “Admin shows auth errors”

- Ensure `NEXT_PUBLIC_BACKEND_URL` is correct in `admin/.env.local`
- Confirm the user has the `admin` role on the backend

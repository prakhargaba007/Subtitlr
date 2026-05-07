# Backend API — Deep Documentation

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [API Architecture](#api-architecture)
6. [Middleware](#middleware)
7. [API Endpoints](#api-endpoints)
8. [Database Models](#database-models)
9. [Authentication & Sessions](#authentication--sessions)
10. [Credit System](#credit-system)
11. [Storage System](#storage-system)
12. [Background Jobs & Workers (BullMQ)](#background-jobs--workers-bullmq)
13. [Controllers Reference](#controllers-reference)
14. [Utils Reference](#utils-reference)
15. [Environment Variables](#environment-variables)
16. [Maintenance Scripts](#maintenance-scripts)
17. [Deployment](#deployment)
18. [Troubleshooting](#troubleshooting)

---

## Overview

This backend is the core of the Kili Labs Video Transcribe platform. It is responsible for:

- **Auth & sessions** — JWT-based login/signup, OTP, Google OAuth, refresh tokens, CSRF
- **Projects & files** — upload management, S3/local storage, asset serving
- **Subtitle generation** — transcription pipeline using Gemini/Whisper + optional Silero VAD
- **Dubbing pipeline** — end-to-end job orchestration: extract → separate → transcribe → translate → TTS → sync → mix → mux
- **Billing** — Dodo Payments integration: subscriptions, webhooks, plan catalog, credit grants
- **Background processing** — BullMQ/Redis workers for long-running media jobs
- **Admin operations** — RBAC-protected routes for user and billing management

The `frontend/` and `admin/` apps communicate with this backend exclusively over HTTP/REST.

---

## Technology Stack

### Core

- **Node.js**: 22.x (required)
- **Express.js**: ^4.19.2
- **MongoDB**: via Mongoose ^8.4.1

### Security & Middleware

- **helmet**: ^8.1.0 (CSP, headers)
- **cors**: ^2.8.5
- **cookie-parser**: ^1.4.7
- **express-rate-limit**: ^8.4.0
- **express-validator**: ^7.1.0
- **jsonwebtoken**: ^9.0.2
- **bcryptjs**: ^2.4.3

### Media Processing

- **fluent-ffmpeg**: ^2.1.3
- **ffmpeg-static**: ^5.3.0 (bundled binary)
- **ffprobe-static**: ^3.1.0 (bundled binary)

### Storage

- **@aws-sdk/client-s3**: ^3.884.0
- **@aws-sdk/s3-request-presigner**: ^3.884.0
- **multer**: ^1.4.5-lts.1

### AI Providers

- **@google/genai**: ^1.34.0 (Gemini)
- **@google/generative-ai**: ^0.24.1 (Gemini legacy)
- **openai**: ^6.15.0 (GPT + TTS)
- **@elevenlabs/elevenlabs-js**: ^2.41.1
- **replicate**: ^1.4.0 (Demucs source separation)
- **smallestai**: ^1.0.1

### Queue & Notifications

- **bullmq**: ^5.56.8
- **expo-server-sdk**: ^3.15.0 (push notifications)

### Billing

- **dodopayments**: ^2.27.0

### Utilities

- **nodemailer**: ^6.9.14
- **sharp**: ^0.34.4
- **uuid**: ^10.0.0
- **yt-dlp-exec**: ^1.0.2
- **axios**: ^1.13.2

---

## Project Structure

```text
backend/
├── app.js                          # Express entrypoint — mounts all routes + global middleware
├── package.json
├── .env.example                    # Copy to .env and fill in values
│
├── controllers/                    # Route handlers and pipeline orchestration (21 files)
├── routes/                         # Route definitions mounted in app.js (21 files)
├── models/                         # Mongoose schemas (23 files)
├── middleware/                     # Custom middleware (6 files)
├── utils/                          # Shared utilities (40+ files organized by domain)
├── workers/                        # BullMQ worker entrypoints (3 files)
├── scripts/                        # One-off maintenance scripts (7 files)
│
├── voices/                         # Curated voice JSON files for Inworld TTS
└── public/                         # Static file serving (local storage mode only)
    └── uploads/                    # Uploaded + generated artifacts
```

---

## Getting Started

### Prerequisites

- **Node.js 22.x**
- **MongoDB** (local or hosted, e.g. MongoDB Atlas)
- **Redis** (local or hosted, e.g. Upstash — required for BullMQ)

### 1. Install

```bash
cd backend
cp .env.example .env
# Fill in at minimum: MONGO_ID, JWT_SECRET, and any AI keys you need
npm install
```

### 2. Start the API

```bash
npm run start
```

Uses `nodemon` so the server restarts on file changes. Default URL: `http://localhost:8080`.

### 3. Start the worker (required for processing)

```bash
npm run worker
```

In a separate terminal. Without the worker, jobs are enqueued but **will not process**.

### 4. Verify

```bash
curl http://localhost:8080/api/subtitles/languages
# Should return a list of supported languages (public endpoint, no auth needed)
```

---

## API Architecture

### Request flow

```text
Client (frontend/admin)
  ↓ HTTPS
app.js
  → trust proxy (for correct client IP behind load balancers)
  → helmet (CSP, security headers)
  → cookie-parser
  → CORS (allowed origins: see below)
  → express.raw (only for /api/webhooks/dodo — raw body needed for signature verification)
  → bodyParser.json (5 MB limit)
  → bodyParser.urlencoded (5 MB limit)
  → route module (routes/*.js)
    → auth middleware (is-auth / is-admin / optional-user)
    → feature middleware (checkDubbingLimits / prepareS3Input)
    → controller (controllers/*.js)
      → MongoDB (Mongoose models)
      → BullMQ (queue.js)
      → Storage (utils/storage.js)
      → AI providers (various utils)
      ↓
    JSON response
  → global error handler (logs ErrorLog, emails admin, returns JSON)
```

### CORS allowed origins

Hard-coded in `app.js`:

- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`
- `https://www.kililabs.io`
- `https://admin.kililabs.io`
- `process.env.FRONTEND_URL` (if set)
- `process.env.ADMIN_URL` (if set)

All with `credentials: true`.

### Rate limiting

Rate limiting is **not** applied globally — only on sensitive auth routes in `routes/authRoutes.js`:

| Limiter | Window | Max | Key |
|---|---|---|---|
| `userRateLimiter` | 10 minutes | 5 requests | `req.body.email` or `req.body.id` or client IP |
| `refreshLimiter` | 1 minute | 20 requests | client IP |

Applied to: OTP generate, signup, login, forgot-password, OTP verify, and token refresh.

### Standard response format

**Success:**

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Middleware

### `middleware/is-auth.js`

**Purpose**: Verify the user is logged in before accessing a protected route.

- Reads the JWT from the `accessToken` HttpOnly cookie or `Authorization: Bearer <token>` header
- On `POST/PUT/DELETE/PATCH` requests: reads the `csrfToken` readable cookie and checks the `X-CSRF-Token` request header — returns 403 if they do not match
- Verifies the token against `JWT_SECRET`
- Sets `req.userId` on the request for downstream use
- Returns **401** if the token is missing or invalid

### `middleware/is-admin.js`

**Purpose**: Restrict a route to admin users only.

- Runs after `is-auth.js` (requires `req.userId`)
- Loads the user from MongoDB
- Returns **403** if the user's `role` is not `admin` or `sub-admin`

### `middleware/optional-user.js`

**Purpose**: Attach user identity if a valid token is present, but do not fail if it is not.

- Attempts to read the JWT from cookie or Authorization header
- Sets `req.userId` if valid; leaves it undefined otherwise
- Used on routes accessible by both authenticated and anonymous users

### `middleware/checkDubbingLimits.js`

**Purpose**: Pre-flight checks before a dubbing job is accepted.

Checks in order:

1. **Idempotency** — if `idempotencyKey` was already used for a completed job, returns the existing job instead of creating a duplicate
2. **Quota** — reads the user's `PlanCatalog.featureFlags` for `maxInputMinutes`, `maxFileSizeMB`, `dailyLimitSeconds`, `monthlyLimitSeconds`, `dailyCostCapUSD`
3. **Concurrency** — checks `UserUsage.activeJobsCount` against `maxConcurrentJobs`
4. **Plan features** — validates that the requested TTS provider, source separation method, etc. are allowed on the user's plan

Returns **402** or **429** on limit exceeded.

### `middleware/subtitlePrepareS3Input.js`

**Purpose**: Allow subtitle generation to start from a file that is already in S3 (direct-upload flow).

- If `req.body.s3Key` is present, downloads the object from S3 into a temp file and sets `req.subtitleTmpProbeFile` so the controller can treat it identically to a multer upload
- Falls through to normal multer handling if `s3Key` is absent

### `middleware/dubbingPrepareS3Input.js`

**Purpose**: Same pattern for the dubbing pipeline.

- Reads `req.body.s3Key`, downloads to temp, sets `req.dubbingTmpProbeFile`
- When set, `dubbingRoutes.js` skips the multer upload step entirely

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | `/api/auth/opt-generate` | No | Yes | Generate and email a 6-digit OTP |
| POST | `/api/auth/signup` | No | Yes | Register with name/email/password/userName |
| POST | `/api/auth/login` | No | Yes | Login with email or userName + password |
| POST | `/api/auth/google-exchange` | No | No | Exchange Google OAuth code for session |
| POST | `/api/auth/forgot-password` | No | Yes | Send password-reset OTP email |
| POST | `/api/auth/verify-otp-reset-password` | No | Yes | Verify OTP and set new password |
| POST | `/api/auth/verify-otp` | No | Yes | Verify sign-in OTP |
| GET | `/api/auth/verify` | Yes | No | Verify that the current access token is valid |
| POST | `/api/auth/refresh` | No | Yes | Refresh access token using refresh cookie |
| POST | `/api/auth/logout` | No | No | Logout current session |
| POST | `/api/auth/logout-all` | Yes | No | Logout all sessions for this user |
| GET | `/api/auth/sessions` | Yes | No | List all active sessions |
| POST | `/api/auth/logout-session/:sessionId` | Yes | No | Revoke a specific session |

### Users (`/api/user`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/user/profile` | Yes | Get current user's profile |
| PUT | `/api/user/update-profile` | Yes | Update own profile (name, bio, picture) |
| POST | `/api/user/create` | Yes (admin) | Create a new user account |
| PUT | `/api/user/update-profile/:id` | Yes (admin) | Update any user's profile |
| DELETE | `/api/user/delete/:id` | Yes (admin) | Delete a user by ID |
| PUT | `/api/user/verify/:id` | Yes | Verify a user's email |
| GET | `/api/user/all` | Yes (admin) | List all users |
| GET | `/api/user/role/:role` | Yes | Get users by role |
| GET | `/api/user/:id` | No | Get public user profile by ID |
| PUT | `/api/user/deactivate` | Yes | Deactivate own account |
| PUT | `/api/user/reactivate` | Yes | Reactivate own account |
| DELETE | `/api/user/delete` | Yes | Delete own account |

### Projects (`/api/projects`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/projects?page=1&limit=10&archived=1` | Yes | List user's projects (optional: show archived) |
| PATCH | `/api/projects/:id` | Yes | Update project display name |
| POST | `/api/projects/:id/pin` | Yes | Pin a project to the top |
| POST | `/api/projects/:id/unpin` | Yes | Unpin a project |
| POST | `/api/projects/:id/archive` | Yes | Archive a project |
| POST | `/api/projects/:id/restore` | Yes | Restore an archived project |

### Subtitles (`/api/subtitles`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/subtitles/languages` | No | List supported transcription languages |
| POST | `/api/subtitles/upload-url` | Yes | Get presigned S3 PUT URL (S3 mode only) |
| POST | `/api/subtitles/generate` | Yes | Start a subtitle generation job (multipart file or `{ s3Key }`) |
| GET | `/api/subtitles/credits` | Yes | Get user's current credit balance |
| GET | `/api/subtitles/credits/history` | Yes | Paginated credit transaction history |
| GET | `/api/subtitles/credits/summary` | Yes | Aggregated credit usage summary |
| GET | `/api/subtitles/:id/export?format=srt\|vtt\|ass` | Yes | Download subtitle file |
| GET | `/api/subtitles/:id` | Yes | Get subtitle job details |
| GET | `/api/subtitles?page=1&limit=10` | Yes | List user's subtitle jobs |

### Dubbing (`/api/dubbing`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/dubbing/upload-url` | Yes | Get presigned S3 PUT URL for direct upload (S3 mode only) |
| POST | `/api/dubbing/start` | Yes | Start dubbing job (multipart file or `{ s3Key }` after direct upload) |
| POST | `/api/dubbing/start-youtube` | Yes | Start dubbing from a YouTube URL |
| GET | `/api/dubbing/voices/local-inworld` | Yes | List curated Inworld voice IDs |
| GET | `/api/dubbing/:id/editor` | Yes | Get editor payload (segments, profiles, signed URLs) |
| PATCH | `/api/dubbing/:id/segments/:segmentId` | Yes | Edit segment text, timing, or strategy |
| POST | `/api/dubbing/:id/segments` | Yes | Add a new segment with TTS audio |
| POST | `/api/dubbing/:id/segments/:segmentId/improve` | Yes | AI-rewrite translated text (duration-aware) |
| POST | `/api/dubbing/:id/segments/:segmentId/regenerate` | Yes | Re-run TTS for a segment |
| POST | `/api/dubbing/:id/rebuild` | Yes | Rebuild the full mix and output video |
| GET | `/api/dubbing/:id/subtitles?format=srt\|vtt\|ass&lang=translated\|original` | Yes | Export dubbing subtitles |
| GET | `/api/dubbing/:id` | Yes | Get a specific dubbing job |
| GET | `/api/dubbing?page=1&limit=10` | Yes | List user's dubbing jobs |

### Plans & Billing (`/api/plans`, `/api/billing`, `/api/admin/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/plans` | No | List all publicly active plans |
| GET | `/api/billing/subscription` | Yes | Get user's current subscription |
| GET | `/api/billing/current-plan` | Yes | Get user's current plan details |
| POST | `/api/billing/cancel` | Yes | Cancel subscription at end of billing period |
| POST | `/api/billing/resume` | Yes | Resume a cancelled subscription |
| POST | `/api/billing/dodo/checkout-session` | Yes | Create a Dodo Payments hosted checkout session |
| POST | `/api/webhooks/dodo` | No (signature verified) | Dodo Payments webhook receiver |
| GET | `/api/admin/billing` | Yes (admin) | Admin billing management |
| GET | `/api/admin/plans` | Yes (admin) | Admin plan catalog management |

### Files (`/api/files`)

Admin file management. Upload, list, search, delete, and get stats on uploaded assets.

### Other Routes

| Mount | Purpose |
|---|---|
| `/api/blog` | Blog CRUD (posts, comments) |
| `/api/categories` | Content category management |
| `/api/tags` | Tag management |
| `/api/contact` | Contact form submission |
| `/api/feedback` | User feedback (optional auth) |
| `/api/device-tokens` | Expo push token registration |
| `/api/transcribe` | Internal test transcription endpoint |
| `/api/coming-soon` | Coming-soon email capture |

---

## Database Models

### `User`

The core user account record.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | String | No | — | Display name |
| `email` | String | No | — | `required: false` supports temp users |
| `userName` | String | No | — | Auto-uppercased, must not contain `@` |
| `password` | String | No | — | bcrypt hashed |
| `tempUser` | Boolean | No | `false` | Temporary guest accounts |
| `role` | String enum | No | `customer` | `customer` \| `admin` \| `sub-admin` |
| `credits` | Number | No | `0` | Current spendable credits, min 0 |
| `welcomeCreditsGranted` | Boolean | No | `false` | Prevents double-granting welcome credits |
| `isVerified` | Boolean | No | `false` | Email verification status |
| `isActive` | Boolean | No | `true` | Account active/suspended |
| `isDeleted` | Boolean | No | `false` | Soft-delete flag |
| `profilePicture` | String | No | — | S3 key or URL |
| `language` | String | No | `"en"` | User's preferred language |
| `tokenVersion` | Number | No | `0` | Incremented to invalidate all refresh tokens |
| `activeSubscriptionId` | ObjectId → `UserSubscription` | No | `null` | Currently active paid plan |
| `preferences` | Object | No | — | `emailNotifications`, `pushNotifications`, `darkMode` |
| `createdAt` / `updatedAt` | Date | Auto | — | Mongoose timestamps |

### `DubbingJob`

Tracks every step of a dubbing pipeline run.

**Status enum:** `pending` → `extracting` → `separating` → `transcribing` → `translating` → `generating` → `syncing` → `merging` → `completed` / `failed`

| Field | Type | Required | Notes |
|---|---|---|---|
| `user` | ObjectId → `User` | Yes | Owner |
| `originalFileName` | String | Yes | |
| `fileType` | String | Yes | `video` or `audio` |
| `targetLanguage` | String | Yes | e.g. `"french"` |
| `sourceLanguage` | String | No | Default `"auto"` |
| `status` | String enum | No | Default `"pending"` |
| `idempotencyKey` | String | No | Prevents duplicate jobs from retries |
| `duration` | Number | No | Media duration in seconds |
| `creditsUsed` | Number | No | Credits debited for this job |
| `segments` | Array | No | TTS segment subdocuments |
| `originalVideoKey` | String | No | S3 key of the source file |
| `vocalsKey` | String | No | Separated vocals S3 key |
| `backgroundKey` | String | No | Separated background audio S3 key |
| `dubbedAudioKey` | String | No | Final dubbed audio S3 key |
| `dubbedVideoKey` | String | No | Final dubbed video S3 key |
| `ttsProvider` | String enum | No | Provider used for this job |
| `separationMethod` | String enum | No | `replicate`, `elevenlabs_fallback`, `no_separation` |
| `error` | String | No | Failure reason |
| `createdAt` / `updatedAt` | Date | Auto | |

**Segment subdocument fields:** `segmentId`, `start`, `end`, `speaker_id`, `originalText`, `translatedText`, `dubbedAudioKey`, `timingStrategy` (`padded` \| `stretched` \| `stretched_capped` \| `null`)

### `Subtitle` (model name: `SubtitleJob`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `user` | ObjectId → `User` | Yes | |
| `originalFileName` | String | Yes | |
| `fileType` | String | Yes | `audio` or `video` |
| `duration` | Number | Yes | Media duration in seconds |
| `creditsUsed` | Number | Yes | |
| `status` | String enum | No | `processing` \| `completed` \| `failed` |
| `language` | String | No | Default `"auto"` |
| `transcription` | String | No | Raw transcript text |
| `segments` | Array | No | `{ start, end, text }` timed cues |
| `originalFileKey` | String | No | S3/local key |
| `thumbnailKey` | String | No | |
| `errorMessage` | String | No | |
| `createdAt` / `updatedAt` | Date | Auto | |

### `Project`

Groups a subtitle or dubbing job into the user's project list.

| Field | Type | Required | Notes |
|---|---|---|---|
| `user` | ObjectId → `User` | Yes | |
| `kind` | String enum | Yes | `subtitle` or `dubbing` |
| `subtitleJob` | ObjectId → `SubtitleJob` | Conditional | Exactly one of `subtitleJob`/`dubbingJob` |
| `dubbingJob` | ObjectId → `DubbingJob` | Conditional | |
| `displayName` | String | No | User-set name, null by default |
| `pinnedAt` | Date | No | Set when pinned, null otherwise |
| `archivedAt` | Date | No | Set when archived, null otherwise |
| `aiUsage` | Array | No | Cost entries per AI call |
| `totalCostUsd` | Number | No | Aggregated cost in USD |

### `PlanCatalog`

Versioned plan definitions. New subscribers bind to current rows; old rows are kept for history.

Key fields:

| Field | Type | Notes |
|---|---|---|
| `key` | String | Internal plan identifier, e.g. `"premium_monthly"` |
| `displayName` | String | Shown to users, e.g. `"Premium"` |
| `interval` | String enum | `monthly` or `yearly` |
| `dodoProductId` | String | Matches the Dodo Payments subscription product |
| `creditsPerPeriod` | Number | Credits granted on each renewal |
| `isActivePublic` | Boolean | Whether this plan appears in public plan listing |
| `sortOrder` | Number | Display ordering |
| `featureFlags` | Object | Per-plan limits and feature toggles (see below) |

**`featureFlags` fields (key limits):**

| Field | Type | Notes |
|---|---|---|
| `maxInputMinutes` | Number or null | Max file duration per job |
| `maxFileSizeMB` | Number or null | Max upload size |
| `maxConcurrentJobs` | Number or null | Max simultaneous dubbing jobs |
| `dailyLimitSeconds` | Number or null | Daily dubbing quota |
| `monthlyLimitSeconds` | Number or null | Billing-cycle dubbing quota |
| `ttsProviders` | String[] | Allowed TTS providers, e.g. `["openai", "inworld"]` |
| `allowSourceSeparation` | Boolean | Whether vocal separation is enabled |
| `allowSpeakerDiarization` | Boolean | Whether multi-speaker mode is enabled |

### `UserSubscription`

Local mirror of a Dodo Payments subscription.

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → `User` | |
| `dodoSubscriptionId` | String | Unique Dodo subscription ID |
| `status` | String enum | `pending` \| `active` \| `on_hold` \| `cancelled` \| `expired` \| `failed` \| `unknown` |
| `creditsPerRenewal` | Number | Credits granted on each renewal (editable by admin) |
| `planCatalog` | ObjectId → `PlanCatalog` | The plan this subscription is on |
| `nextBillingDate` | Date | Next charge date |
| `cancelAtNextBillingDate` | Boolean | Graceful cancellation flag |

### `UserUsage`

Atomic usage tracking for quota enforcement. One document per user.

Uses a **two-phase reservation** lifecycle:

1. **RESERVE** on job start: `dailyReservedSeconds += duration`, `activeJobsCount += 1`
2. **CONFIRM** on completion: `dailyUsedSeconds += actualDuration`, `dailyReservedSeconds -= reservedDuration`, `activeJobsCount -= 1`
3. **REFUND** on failure/cancel: `dailyReservedSeconds -= unusedDuration`, `activeJobsCount -= 1`

Key fields: `activeJobsCount`, `dailyWindowDate`, `dailyUsedSeconds`, `dailyReservedSeconds`, `billingCycleStart`, `monthlyUsedSeconds`, `monthlyReservedSeconds`

---

## Authentication & Sessions

### How it works

1. On login/signup, the backend issues:
   - **Access token** (short-lived JWT, typically 15 min) — set as an HttpOnly `accessToken` cookie
   - **Refresh token** (long-lived JWT) — stored in the `RefreshToken` MongoDB collection and set as an HttpOnly `refreshToken` cookie
2. On every protected API request, `is-auth.js` reads the `accessToken` cookie and validates it
3. When the access token expires, the frontend's Axios interceptor calls `POST /api/auth/refresh` — the backend validates the refresh token from the cookie and issues a new access token
4. CSRF protection: on every mutating request, the frontend must send the value of the readable `csrfToken` cookie in the `X-CSRF-Token` header — `is-auth.js` rejects the request if they do not match

### Forced logout

The `User.tokenVersion` field is incremented when a user is force-logged-out or changes their password. All JWTs signed with an older `tokenVersion` are rejected.

### Session management

Sessions (refresh tokens) are tracked in `RefreshToken` collection:
- `GET /api/auth/sessions` — list all active sessions for the current user
- `POST /api/auth/logout-session/:sessionId` — revoke a specific session
- `POST /api/auth/logout-all` — revoke all sessions

---

## Credit System

Credits are the internal currency that gates how much transcription/dubbing a user can perform.

### How credits are stored

- `User.credits` — current spendable balance
- `User.welcomeCreditsGranted` — guards against double-granting welcome credits on signup

### Credit operations (in `utils/creditUtils.js`)

- **Grant**: add credits to `User.credits` (used on subscription renewal, welcome grants)
- **Debit**: subtract credits from `User.credits` (used after a job completes successfully)
- **Welcome credits**: automatically granted when a new user's account is created (once only)

### Usage tracking (in `utils/usageService.js` and `utils/usageTracker.js`)

- `usageService.js` — atomically reserves/confirms/refunds seconds in `UserUsage` to enforce plan quotas
- `usageTracker.js` — logs cost entries to `Project.aiUsage` (model name, provider, type, tokens, seconds, costUsd) for per-project cost accounting

---

## Storage System

Configured via `STORAGE_TYPE` in `.env`. Implemented in `utils/storage.js` as an abstraction layer.

### Local mode (`STORAGE_TYPE=local`)

- Uploads and generated artifacts stored in `backend/public/uploads/`
- Served by `app.js` as static files under `/public/uploads`
- Good for development; not suitable for production (files lost on restarts)

### S3 mode (`STORAGE_TYPE=s3`)

- All files uploaded to and read from an AWS S3 bucket
- Presigned PUT URLs are generated for direct browser-to-S3 uploads (`/api/dubbing/upload-url`, `/api/subtitles/upload-url`)
- Presigned GET URLs are used for serving private artifacts to the UI

Key env vars: `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`

---

## Background Jobs & Workers (BullMQ)

### Queue configuration (from `utils/queue.js`)

| Setting | Value |
|---|---|
| Queue name | `video-processing` |
| Job name | `process-video` |
| Redis host | `REDIS_HOST` or `localhost` |
| Redis port | `REDIS_PORT` or `6379` |
| Job timeout | 18,000,000 ms (5 hours) |
| Attempts | 3 |
| Backoff | Exponential, starting from 1000 ms |

### Worker files (in `workers/`)

| File | Purpose |
|---|---|
| `startWorker.js` | Entry point: connects MongoDB, imports `videoProcessor`, registers `SIGTERM`/`SIGINT` handlers |
| `videoProcessor.js` | BullMQ consumer for the `video-processing` queue — handles transcription/dubbing job execution |
| `stuckJobReaper.js` | Detects jobs that have been stuck in non-terminal states too long and marks them failed |

### Starting the worker

```bash
npm run worker
```

> Without the worker running, all dubbing and subtitle jobs will remain in a `processing` state and never complete.

---

## Controllers Reference

All 21 controllers are in `controllers/`:

| File | Responsibility |
|---|---|
| `authController.js` | OTP flow, signup, login, Google OAuth, password reset, JWT verify, refresh, logout, session list/revoke |
| `userController.js` | Profile read/update; admin user CRUD (create, update, delete, verify) |
| `subtitleController.js` | Presigned upload, subtitle job start, export (SRT/VTT/ASS), job listing, credits/history |
| `dubbingController.js` | Upload URL, start job (file or YouTube), editor payload, segment edits (patch/improve/regenerate/add), job rebuild, Inworld voice list, subtitle export from dubbing |
| `projectController.js` | List projects, patch display name, pin/unpin, archive/restore |
| `planCatalogController.js` | Public listing of active plans |
| `adminPlanCatalogController.js` | Admin: list all plans, create/update plan |
| `billingController.js` | User subscription status, current plan, cancel/resume, Dodo checkout session creation |
| `adminSubscriptionController.js` | Admin: patch `creditsPerRenewal` on a subscription |
| `dodoWebhookController.js` | Webhook receipt: signature verification, idempotent processing via billing service |
| `contactController.js` | Contact form submission and admin listing |
| `feedbackController.js` | User feedback submission (optional auth) and admin listing |
| `blogController.js` | Blog post CRUD, filtering, featured/related posts, comments integration |
| `categoryController.js` | Category CRUD, active listing, status toggle |
| `tagController.js` | Tag CRUD |
| `fileController.js` | Admin file upload, listing, search, stats, delete |
| `commentController.js` | Blog/post comment and reply management |
| `deviceTokenController.js` | Expo push token registration, send notifications to users/devices |
| `dashboardController.js` | Aggregate stats (legacy — route is commented out in app.js) |
| `transcribeTestController.js` | Authenticated test transcription endpoint and YouTube download debug |
| `comingSoonController.js` | Coming-soon email capture and acknowledgment email |

---

## Utils Reference

Utils are organized by domain:

### Auth & security

| File | Purpose |
|---|---|
| `authTokens.js` | JWT access/refresh token generation and cookie domain rules |
| `otpUtils.js` | Generate/store/verify OTP; send OTP emails |
| `creditUtils.js` | Credit grant/debit helpers, welcome credit logic |

### Storage & files

| File | Purpose |
|---|---|
| `storage.js` | Unified local/S3 abstraction (save, get, presign, delete) |
| `fileUpload.js` | Multer factory for typed uploads (image, doc, video) with size limits |
| `presignedUrlGenerator.js` | Wrapper for presigned PUT/GET URLs via storage adapter |
| `fileManager.js` | Deduplicate uploads by content hash; file record helpers |
| `imageMetadata.js` | Sharp-based image metadata extraction |
| `videoThumbnailUtils.js` | Random-frame JPEG thumbnail via FFmpeg |

### Queue & billing

| File | Purpose |
|---|---|
| `queue.js` | BullMQ queue setup and `addVideoProcessingJob` helper |
| `dodoClient.js` | Lazy-initialized Dodo Payments client |
| `planCatalogSeed.js` | Upsert `PlanCatalog` rows from `DODO_PLAN_CATALOG_JSON` env on boot |
| `usageService.js` | Atomic reserve/confirm/refund for dubbing usage (`UserUsage`) |
| `usageTracker.js` | Append AI cost entries to `Project.aiUsage` |
| `projectUtils.js` | Create `Project` rows after subtitle/dubbing jobs (idempotent) |

### Email & notifications

| File | Purpose |
|---|---|
| `mailer.js` | Nodemailer transporter with retry logic |
| `notifications.js` | Facade for Expo push notifications |
| `comingSoonEmail.js` | HTML acknowledgment email for coming-soon signups |
| `dubbingCompletionEmail.js` | Completion email with export link |

### Dubbing pipeline

| File | Purpose |
|---|---|
| `dubbingConfig.js` | Env-driven dubbing knobs (atempo caps, TTS tag allowlists) |
| `dubbingOutputUtils.js` | Local per-job artifact folder layout |
| `dubbingSegmentFlatten.js` | Flatten segments/sub-segments into timed TTS rows |
| `dubbingTextUtils.js` | Bracket-tag and text normalization for TTS scripts |
| `translationUtils.js` | OpenAI/Gemini translation prompt helpers |
| `timingSyncUtils.js` | FFmpeg `atempo` chains and fit-to-slot timing |
| `audioMergeUtils.js` | Duck/mix timed speech over background bed |
| `audioUtils.js` | Duration, chunking, FFmpeg probes, stream summaries, temp file cleanup |
| `sourceSeparationUtils.js` | Replicate Demucs / ElevenLabs vocal separation |
| `lipSyncRunner.js` | Optional Wav2Lip Python inference for lip-sync output |
| `youtubeDownloadUtils.js` | yt-dlp-exec download + FFmpeg merge for YouTube sources |

### Transcription & subtitle

| File | Purpose |
|---|---|
| `transcribeUtils.js` | Gemini-based transcription pipeline helpers |
| `subtitleUtils.js` | Whisper/Gemini subtitle transcription and segment helpers |
| `sileroVadUtils.js` | Optional Silero VAD timeline for speech/silence alignment |
| `languageCatalog.js` | Shared language maps and lists for ASR/TTS routing |

### TTS providers

| File | Provider |
|---|---|
| `ttsUtils.js` | ElevenLabs + OpenAI TTS |
| `inworldTtsUtils.js` | Inworld TTS (voices, synthesis, language mapping) |
| `localInworldVoices.js` | Load curated Inworld voice list from `voices/` |
| `geminiTtsUtils.js` | Gemini 2.x/3.x TTS |
| `geminiBatchTtsUtils.js` | Batched multi-line Gemini TTS with re-transcription for timestamps |
| `geminiKeyManager.js` | Pool/failover across multiple `GOOGLE_API_KEY*` env slots |
| `sarvamTtsUtils.js` | Sarvam Waves TTS for Indic languages |
| `smallestTtsUtils.js` | Smallest AI Waves API |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`. Full reference:

### App (required)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP server port |
| `MONGO_ID` | — | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/kili`) |
| `JWT_SECRET` | — | JWT signing secret — use a long random string in production |

### CORS (optional)

| Variable | Description |
|---|---|
| `FRONTEND_URL` | Extra allowed origin for CORS (your deployed frontend) |
| `ADMIN_URL` | Extra allowed origin for CORS (your deployed admin panel) |

### Storage

| Variable | Default | Description |
|---|---|---|
| `STORAGE_TYPE` | `local` | `local` or `s3` |
| `AWS_REGION` | — | S3 only |
| `S3_BUCKET` | — | S3 only |
| `AWS_ACCESS_KEY_ID` | — | S3 only |
| `AWS_SECRET_ACCESS_KEY` | — | S3 only |
| `S3_PUBLIC_BASE_URL` | — | S3 only — controls how asset URLs are built for the UI |

### AI — Gemini

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Primary Gemini API key (checked first for all Gemini calls) |
| `GEMINI_API_KEY` | Optional separate key for dubbing only |
| `GEMINI_MODEL` | Default model override (default: `gemini-2.0-flash`) |
| `INWORLD_VOICE_SELECTION_MODEL` | Model for Inworld voice selection (default: `gemini-2.0-flash`) |

### AI — OpenAI, ElevenLabs, Replicate

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Translation, voice picking, OpenAI TTS |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS and source separation fallback |
| `REPLICATE_API_TOKEN` | Demucs vocal separation (optional) |

### Dubbing — TTS provider

| Variable | Default | Description |
|---|---|---|
| `DUBBING_TTS_PROVIDER` | `auto` | `auto` \| `openai` \| `inworld` \| `smallest` \| `elevenlabs` \| `sarvam` \| `gemini` |
| `OPENAI_TTS_MODEL` | `tts-1` | OpenAI TTS model |
| `DUBBING_MAX_ATEMPO` | `1.5` | Max tempo speed-up to fit TTS into segment slot (0.5–2.0) |
| `DUBBING_MAX_ATEMPO_HI` | — | Stricter cap for languages like Hindi |

### Dubbing — Inworld TTS

| Variable | Description |
|---|---|
| `INWORLD_API_KEY` | Inworld TTS API key |
| `INWORLD_TTS_MODEL` | Default: `inworld-tts-1.5-max` |
| `INWORLD_DEFAULT_VOICE` | Default: `Jason` |
| `INWORLD_SPEAKING_RATE` | Default: `1` |

### Dubbing — Smallest.ai

| Variable | Description |
|---|---|
| `SMALLEST_API_KEY` | Smallest.ai API key |
| `SMALLEST_WAVES_MODEL` | Default: `lightning` |
| `SMALLEST_DEFAULT_VOICE` | Default: `emily` |

### Subtitles — Silero VAD (optional)

| Variable | Default | Description |
|---|---|---|
| `SUBTITLE_USE_SILERO_VAD` | `0` | Set to `1` to enable VAD-based speech filtering |
| `SUBTITLE_VAD_TRANSCRIBE_MODE` | `full_audio` | `full_audio` (best text) or `clips` (best silence alignment) |
| `SUBTITLE_VAD_MIN_SPEECH_OVERLAP` | `0.35` | Minimum fraction of cue that must overlap speech to keep it |
| `SILERO_PYTHON` | — | Path to Python binary with torch/silero installed |
| `SILERO_VAD_SCRIPT` | — | Absolute path to `scripts/silero_vad_timeline.py` |

### Lip-sync — Wav2Lip (optional, default disabled)

| Variable | Default | Description |
|---|---|---|
| `LIPSYNC_ENABLED` | `0` | Set to `1` to enable (requires Wav2Lip installation) |
| `LIPSYNC_PROVIDER` | `local` | Currently only `local` is supported |
| `WAV2LIP_DIR` | — | Absolute path to Wav2Lip directory |
| `WAV2LIP_CHECKPOINT` | — | Absolute path to `wav2lip_gan.pth` checkpoint |
| `LIPSYNC_TIMEOUT_MS` | `1800000` | Timeout for lip-sync inference |

### Billing — Dodo Payments

| Variable | Description |
|---|---|
| `DODO_PAYMENTS_API_KEY` | API key from Dodo Payments dashboard |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook signing secret (from Developer → Webhooks) |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` or `live_mode` (default: `live_mode`) |
| `DODO_CHECKOUT_RETURN_URL` | URL to redirect to after Dodo hosted checkout |
| `DODO_PLAN_CATALOG_JSON` | Optional JSON array — upserts `PlanCatalog` rows on server boot |

---

## Maintenance Scripts

Run from `backend/`:

| Script (npm run) | Source file | When to run |
|---|---|---|
| `fix-project-indexes` | `scripts/fixProjectIndexes.js` | Fix MongoDB indexes on the `Project` collection after schema changes |
| `backfill-projects` | `scripts/backfillProjects.js` | Create `Project` records for existing subtitle/dubbing jobs that predate the projects feature |

Additional scripts (run directly with `node`):

| File | Purpose |
|---|---|
| `scripts/seedPlanLimits.js` | Seed or update plan limit fields in `PlanCatalog` |
| `scripts/createGamePlayBadges.js` | Create gameplay badge definitions |
| `scripts/createXPMilestoneBadges.js` | Create XP milestone badge definitions |
| `scripts/testBadgeSystem.js` | Test badge award logic |
| `scripts/testGamePlayBadges.js` | Test gameplay badge logic |

---

## Deployment

### Minimum requirements

- MongoDB (MongoDB Atlas recommended for production)
- Redis (Upstash or self-hosted; required for BullMQ)
- Node.js 22.x runtime for the API
- Node.js 22.x runtime for the worker (run as a **separate process**)
- Storage: S3 bucket for uploads + generated artifacts (`STORAGE_TYPE=s3`)

### Recommended production topology

```text
                   ┌──────────────────┐
                   │   Load balancer   │
                   └────────┬─────────┘
                            │
             ┌──────────────▼──────────────┐
             │      API process(es)         │
             │      (npm run start)         │
             └──────┬──────────────┬────────┘
                    │              │
          ┌─────────▼──┐     ┌─────▼───────┐
          │  MongoDB   │     │   Redis      │
          └────────────┘     └─────┬───────┘
                                   │
                      ┌────────────▼────────────┐
                      │     Worker process(es)   │
                      │     (npm run worker)     │
                      └─────────────────────────┘
```

- Run API and worker as **separate processes/services** (worker makes long-running FFmpeg + AI calls)
- Use `STORAGE_TYPE=s3` — local disk storage is lost on container/VM restarts
- Set `FRONTEND_URL` and `ADMIN_URL` for production CORS

---

## Troubleshooting

### Jobs stuck in "processing" or "pending"

1. Confirm Redis is running: `redis-cli ping` should return `PONG`
2. Confirm the worker is running: `npm run worker`
3. Check BullMQ queue for failed jobs

### Mongo connection errors

- Verify `MONGO_ID` connection string
- Confirm MongoDB is reachable from the backend host
- For Atlas: check IP whitelist

### CORS errors from frontend/admin

- Confirm `FRONTEND_URL` / `ADMIN_URL` match the deployed origin exactly (protocol + domain + port)
- Confirm `credentials: true` is set on the frontend Axios instance

### Auth errors (401 / 403)

- 401 on protected routes: access token is missing or expired — frontend should trigger refresh via `POST /api/auth/refresh`
- 403 on admin routes: user's `role` is not `admin` or `sub-admin`
- CSRF errors: ensure the frontend reads the `csrfToken` cookie and sends it as `X-CSRF-Token` on mutating requests

### Billing webhooks failing

- Verify `DODO_PAYMENTS_WEBHOOK_KEY` matches the secret in Dodo dashboard
- The webhook endpoint must receive the **raw body** — ensure no middleware transforms it before `dodoWebhookRoutes`

### S3 assets not rendering in the UI

- Backend: check `STORAGE_TYPE=s3`, `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Backend: check `S3_PUBLIC_BASE_URL` — this is how asset URLs are constructed
- Frontend/admin: check `NEXT_PUBLIC_S3_BASE_URL` matches the expected base URL

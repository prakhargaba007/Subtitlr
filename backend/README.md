# Backend API + Workers

Express API that powers authentication, projects/files, subtitles & dubbing pipelines, and billing. Long-running processing runs in a separate **worker** process via **BullMQ (Redis)**.

---

## Table of Contents

- [Overview](#overview)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [API routes (high-level)](#api-routes-high-level)
- [Environment variables](#environment-variables)
- [Background jobs & workers](#background-jobs--workers)
- [Maintenance scripts](#maintenance-scripts)
- [Deep documentation](#deep-documentation)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

This service handles:

- **Auth & sessions** — JWT (HttpOnly cookie), refresh, CSRF, OTP
- **Projects & files** — uploads to local disk or S3, presigned URLs
- **Subtitles** — transcription pipeline (Gemini/Whisper + optional Silero VAD)
- **Dubbing** — end-to-end localization (extract → separate → transcribe → translate → TTS → sync → mix → mux)
- **Billing** — Dodo Payments subscriptions, webhooks, plan catalog, credit grants
- **Admin** — RBAC-protected management routes

---

## Technology stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js ^4.19.2
- **Database**: MongoDB + Mongoose ^8.4.1
- **Queue**: BullMQ ^5.56.8 (Redis)
- **Media**: fluent-ffmpeg + ffmpeg-static + ffprobe-static
- **Storage**: local filesystem or AWS S3
- **AI**: Gemini, OpenAI, ElevenLabs, Replicate (Demucs), Smallest.ai, Inworld, Sarvam
- **Billing**: Dodo Payments ^2.27.0

---

## Project structure

```text
backend/
├── app.js                     # Express entry point
├── .env.example               # Copy to .env and fill in values
├── controllers/               # Route handlers (21 files)
├── routes/                    # Route definitions (21 files)
├── models/                    # Mongoose models (23 files)
├── middleware/                # Auth, RBAC, limits, S3 prep (6 files)
├── utils/                     # Shared utilities (40+ files)
├── workers/                   # BullMQ worker entry points (3 files)
└── scripts/                   # Maintenance scripts (7 files)
```

---

## Getting started

### Prerequisites

- **MongoDB** running (local or hosted)
- **Redis** running (required for BullMQ — `localhost:6379` by default)

### Install

```bash
cd backend
cp .env.example .env
# Edit .env with MONGO_ID, JWT_SECRET, and any AI/billing keys
npm install
```

### Start the API

```bash
npm run start
```

Default URL: `http://localhost:8080`

### Start the worker (required for processing)

```bash
npm run worker
```

Run in a separate terminal. Without the worker, dubbing and subtitle jobs will be enqueued but **will never execute**.

---

## API routes (high-level)

All routes are mounted in `app.js`. Routes marked **[admin]** require the `admin` or `sub-admin` role.

| Route group | Key endpoints |
|---|---|
| `POST /api/auth/signup` | Register new user |
| `POST /api/auth/login` | Login (email/password or Google) |
| `POST /api/auth/refresh` | Refresh access token |
| `POST /api/auth/logout` | Logout current session |
| `GET /api/user/profile` | Get own profile |
| `GET /api/projects` | List user's projects |
| `GET /api/subtitles/languages` | Supported transcription languages (public) |
| `POST /api/subtitles/generate` | Start subtitle job |
| `GET /api/subtitles/:id/export?format=srt\|vtt\|ass` | Download subtitle file |
| `POST /api/dubbing/start` | Start dubbing job |
| `POST /api/dubbing/start-youtube` | Start dubbing from YouTube URL |
| `GET /api/dubbing/:id/editor` | Get editor payload |
| `POST /api/dubbing/:id/rebuild` | Rebuild full mix/video |
| `GET /api/plans` | List public plans (no auth) |
| `POST /api/billing/dodo/checkout-session` | Create checkout session |
| `POST /api/webhooks/dodo` | Dodo Payments webhook receiver |
| `GET /api/admin/billing` | [admin] Billing management |
| `GET /api/admin/plans` | [admin] Plan catalog management |

For the full endpoint table with HTTP methods, auth requirements, and query params, see `backend/DOCUMENTATION.md`.

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. Essential variables:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port (default `8080`) |
| `MONGO_ID` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `STORAGE_TYPE` | No | `local` (default) or `s3` |
| `AWS_REGION` | S3 only | AWS region |
| `S3_BUCKET` | S3 only | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | S3 only | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | S3 only | AWS secret key |
| `S3_PUBLIC_BASE_URL` | S3 only | Base URL for constructed asset URLs |
| `GOOGLE_API_KEY` | Yes (dubbing) | Gemini — transcription, translation, TTS |
| `OPENAI_API_KEY` | Yes (dubbing) | Translation + OpenAI TTS |
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs TTS |
| `REPLICATE_API_TOKEN` | Optional | Demucs source separation |
| `REDIS_HOST` | No | Default `localhost` |
| `REDIS_PORT` | No | Default `6379` |
| `DODO_PAYMENTS_API_KEY` | Billing | Dodo Payments API key |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Billing | Dodo webhook signing secret |

All available variables including Inworld, Smallest.ai, Sarvam, Silero VAD, Wav2Lip, and billing config are documented in `backend/.env.example` and the full [Environment Variables](./DOCUMENTATION.md#environment-variables) section of `DOCUMENTATION.md`.

---

## Background jobs & workers

| Setting | Value |
|---|---|
| Queue name | `video-processing` |
| Job name | `process-video` |
| Max job duration | 5 hours (`18,000,000 ms`) |
| Retry attempts | 3 (exponential backoff) |

Worker files:

- `workers/startWorker.js` — entry point, connects MongoDB, registers signals
- `workers/videoProcessor.js` — BullMQ consumer, executes dubbing/subtitle jobs
- `workers/stuckJobReaper.js` — marks stuck jobs as failed

---

## Maintenance scripts

```bash
# Fix MongoDB indexes on the Project collection
npm run fix-project-indexes

# Backfill Project records for pre-existing jobs
npm run backfill-projects
```

Additional scripts (run with `node scripts/<name>.js`): `seedPlanLimits.js`, `createGamePlayBadges.js`, `createXPMilestoneBadges.js`

---

## Deep documentation

For a full reference — model field schemas, all 21 controllers, 6 middleware files, 40+ utils categorized by domain, complete endpoint tables, auth/CSRF flow, credit system, and more — see:

**`backend/DOCUMENTATION.md`**

---

## Deployment

Minimum requirements:

- MongoDB
- Redis
- API process (`npm run start`)
- Worker process (`npm run worker`) — must run separately from the API

Recommended: use `STORAGE_TYPE=s3` in production so artifacts are not lost on restarts.

---

## Troubleshooting

### Jobs not processing

1. Check Redis is running (`redis-cli ping` → `PONG`)
2. Check worker is running (`npm run worker`)

### MongoDB errors

- Verify `MONGO_ID` is correct and MongoDB is reachable

### CORS errors from frontend/admin

- Set `FRONTEND_URL` and `ADMIN_URL` in `.env` to your deployed origins

### 401 / CSRF errors

- Ensure the frontend sends the `csrfToken` cookie value in the `X-CSRF-Token` header on all mutating requests
- See [Authentication & Sessions](./DOCUMENTATION.md#authentication--sessions) in `DOCUMENTATION.md`

### Billing webhook failures

- Verify `DODO_PAYMENTS_WEBHOOK_KEY` matches the Dodo dashboard secret
- The webhook route receives the raw request body — do not add extra body parsers before it

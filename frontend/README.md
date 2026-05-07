# Frontend (Next.js) — Documentation

User-facing web app for uploading media, managing projects, editing subtitles/dubbing, previewing results, and exporting.

---

## Table of Contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Deep documentation](#deep-documentation)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Routing map](#routing-map)
- [State management](#state-management)
- [API integration](#api-integration)
- [Media/editor architecture](#mediaeditor-architecture)
- [Development](#development)
- [Build & deployment](#build--deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

This app is the primary UI for end users. Typical flows:

- Authenticate, manage account/credits
- Create/manage projects
- Upload/import media
- Start subtitle/dubbing jobs
- Edit translated text/voices/timing (where supported by the UI)
- Preview audio/video and export final outputs

Long-running processing is executed by the backend worker; the frontend polls and renders job state in “processing” views.

---

## Tech stack

- **Framework**: Next.js 16.2 (App Router), React 19
- **Language**: TypeScript
- **State**: Redux Toolkit + React-Redux
- **Styling**: Tailwind CSS v4
- **Media**: Video.js + Wavesurfer.js (waveform + timeline UX)
- **HTTP**: Axios (see `utils/axios.ts`)
- **Icons**: Lucide + Material Symbols

---

## Project structure

```text
frontend/
├── app/                         # Next.js App Router routes/layouts
│   ├── (auth)/                  # login/register/forgot-password flows
│   ├── (main)/                  # marketing pages (pricing/terms/help/etc.)
│   ├── dashboard/               # logged-in user area (projects/files/billing)
│   ├── dubbing/                 # dubbing editor routes
│   └── processing/              # job tracker / progress UI
├── DOCUMENTATION.md             # deep dive for contributors
├── components/                  # reusable UI + feature components
├── redux/                       # Redux store + slices
├── utils/                        # axios client + helpers
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Deep documentation

For a deeper technical breakdown (architecture, routes, key components, editor state, Axios refresh flow), see:

- `frontend/DOCUMENTATION.md`

---

## Getting started

### Prerequisites

- Backend API running (default `http://localhost:8080`)
- For processing features: backend worker + Redis running

### Install

```bash
cd frontend
npm install
```

### Run (dev)

```bash
npm run dev
```

- **App URL**: `http://localhost:3000`

---

## Environment variables

Create `frontend/.env.local`.

### Required

- **`NEXT_PUBLIC_BACKEND_URL`**: base API URL used by Axios
  - Example: `http://localhost:8080`

### Optional (feature-dependent)

- **`NEXT_PUBLIC_SITE_URL`**
  - Used for canonical URLs in `app/sitemap.ts` and `app/robots.ts`
- **`NEXT_PUBLIC_STORAGE_TYPE`**: `local` | `s3`
  - Used by processing UX logic (e.g. when showing links / upload modes)
- **`NEXT_PUBLIC_DIRECT_S3_UPLOAD`**: `true` | `false`
  - Enables UI paths that assume direct-to-S3 upload is available
- **`NEXT_PUBLIC_S3_BASE_URL`**
  - Used for rendering assets stored on S3 (e.g. profile pictures)
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`**
  - Enables Google auth UI in `components/auth/AuthForm.tsx`

After changing env vars, restart the dev server.

---

## Routing map

High-signal route groups under `app/`:

- **`(auth)`**: authentication flows
- **`(main)`**: marketing/static pages
- **`dashboard`**: project + file management, billing/credits views
- **`dubbing`**: dubbing editor experience (preview + edits + export)
- **`processing`**: progress/status UI while backend jobs run

---

## State management

Redux is used to keep cross-cutting state available across nested route components:

- **Store**: `redux/store.ts`
- **User/session**: `redux/slices/userSlice.ts`
  - authenticated user info
  - credits / plan details
  - UI toggles used by multiple screens

When debugging “UI shows logged out randomly”, inspect:

- refresh-token handling in `utils/axios.ts`
- `userSlice` updates around login/refresh/logout actions

---

## API integration

All network calls should go through the configured Axios client:

- **Axios client**: `utils/axios.ts`
  - Uses `NEXT_PUBLIC_BACKEND_URL` as `baseURL`
  - Contains refresh-token logic used when requests return auth errors

If you add new endpoints, prefer:

- centralizing base URL + auth handling in one place (`utils/axios.ts`)
- keeping “API call” logic close to the feature area (or extracting a `services/` layer if it grows)

---

## Media/editor architecture

This frontend includes “timeline-style” media UX:

- **Video playback**: Video.js
- **Waveform/timeline**: Wavesurfer.js

The dubbing editor typically coordinates:

- video current time ↔ waveform cursor ↔ selected subtitle/segment
- segment text edits + per-segment settings (voice/provider-dependent)
- previewing generated audio segments and/or a composed track
- exporting final artifacts once the backend job reaches a completed state

When debugging editor issues, common failure points are:

- timebase mismatch (ms vs seconds) between UI components and backend timestamps
- stale job state (polling interval too long, or status not refreshed after mutation)
- asset URL mismatch (local vs S3 paths; base URL environment variables)

---

## Development

### Useful commands

```bash
npm run lint
npm run build
npm run start
```

### Recommended local workflow

- Start backend API + worker first
- Start frontend dev server
- Use the processing pages to validate end-to-end job progress

---

## Build & deployment

### Production build

```bash
npm run build
npm run start
```

### Required production environment

- `NEXT_PUBLIC_BACKEND_URL` must point to your deployed backend origin
- If using S3/CDN, ensure corresponding `NEXT_PUBLIC_*` base URLs match how assets are served

---

## Troubleshooting

- **API calls failing / baseURL is undefined**
  - Ensure `NEXT_PUBLIC_BACKEND_URL` exists in `frontend/.env.local`
  - Restart `npm run dev`

- **Auth refresh loop / repeated 401s**
  - Check backend auth/refresh endpoints
  - Inspect refresh logic in `utils/axios.ts`

- **Images not loading (S3 paths)**
  - Set `NEXT_PUBLIC_S3_BASE_URL`
  - Ensure backend storage mode matches your environment assumptions (local vs S3)

- **Processing pages show “stuck” statuses**
  - Confirm backend worker is running (`cd backend && npm run worker`)
  - Confirm Redis is running and reachable by the backend

# Frontend (Next.js) — Deep Documentation

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Architecture](#architecture)
7. [Key Routes (App Router)](#key-routes-app-router)
8. [Key Components](#key-components)
9. [State Management (Redux)](#state-management-redux)
10. [Editor State (Dubbing Editor Context)](#editor-state-dubbing-editor-context)
11. [API Integration (Axios + Refresh)](#api-integration-axios--refresh)
12. [Assets & Storage URLs (Local vs S3)](#assets--storage-urls-local-vs-s3)
13. [Environment Variables](#environment-variables)
14. [Development Guidelines](#development-guidelines)
15. [Build & Deployment](#build--deployment)
16. [Troubleshooting](#troubleshooting)

---

## Overview

The `frontend/` app is the primary user-facing web UI for Kili Labs Video Transcribe.

It is responsible for:

- user authentication and session UX
- project and file management
- starting subtitles/dubbing jobs
- providing an editor-like experience for previewing and adjusting results
- export flows and “processing” progress UI while the backend worker runs long jobs

This app **does not** perform heavy media work locally; instead it calls the backend API and renders job state.

---

## Features

### 1) Authentication

- login/register UI under `app/(auth)`
- session refresh behavior handled by the shared Axios client (`utils/axios.ts`)

### 2) Dashboard

- project list and project detail flows (routes under `app/dashboard`)
- upload UX (often via `components/dashboard/UploadZone.tsx` and related components)
- billing/credits screens (routes under `app/dashboard/billing`, `app/dashboard/credit-history`, etc.)

### 3) Processing / job tracking

- “processing” pages show in-progress statuses while the backend executes:
  - transcription/subtitles pipelines
  - dubbing pipelines

### 4) Dubbing editor

- editor routes under `app/dubbing/editor` and `app/dashboard/dubbing/editor`
- coordinates:
  - video playback
  - waveform/timeline
  - segment selection and edits
  - previewing segment audio and/or mixed audio (depending on the job outputs)

### 5) Export

- export routes under `app/export` / `app/dashboard/export` and dubbing exports under `app/dubbing/export` / `app/dashboard/dubbing/export`

---

## Technology Stack

### Core

- **Next.js**: 16.2 (App Router)
- **React**: 19
- **TypeScript**

### UI

- **Tailwind CSS**: v4
- **Icons**: Lucide + Material Symbols

### Media

- **Video.js**
- **Wavesurfer.js**

### State

- **Redux Toolkit** + `react-redux`

### HTTP

- **Axios** with:
  - `withCredentials: true` cookie support
  - CSRF header injection (if `csrfToken` cookie exists)
  - 401 auto-refresh logic

---

## Project Structure

```text
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login/register
│   ├── (main)/                   # marketing pages
│   ├── dashboard/                # logged-in area
│   ├── dubbing/                  # dubbing editor + export
│   ├── export/                   # export entry
│   └── processing/               # job progress UI
├── components/
│   ├── auth/                     # auth UI
│   ├── dashboard/                # dashboard UI
│   ├── dubbing/                  # dubbing preview/export views
│   └── dubbingEditor/            # timeline/editor shell + context
├── redux/
│   ├── store.ts
│   └── slices/userSlice.ts
├── utils/
│   └── axios.ts                  # API client + interceptors
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Backend API running (default `http://localhost:8080`)
- For processing features:
  - Redis running (BullMQ)
  - backend worker running (`backend: npm run worker`)

### Install

```bash
cd frontend
npm install
```

### Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Architecture

### Mental model

```text
Browser UI (Next.js)
  → calls backend API (Axios, cookies, refresh)
    → backend persists job state in MongoDB
    → worker executes long jobs via BullMQ/Redis
  ← UI polls/renders status + outputs (URLs)
```

### Time units (common source of bugs)

The editor works with timed segments. Be careful about:

- **seconds vs milliseconds** across UI widgets and backend segment timestamps
- keeping a single source of truth for current playback time (player ↔ waveform ↔ selected segment)

---

## Key routes (App Router)

Routes are defined by files in `app/**/page.tsx`.

High-signal routes include:

- Auth:
  - `app/(auth)/login/page.tsx`
- Main/marketing:
  - `app/(main)/page.tsx`, `app/(main)/pricing/page.tsx`, `app/(main)/privacy/page.tsx`, `app/(main)/terms/page.tsx`, `app/(main)/help/page.tsx`
- Dashboard:
  - `app/dashboard/page.tsx`
  - `app/dashboard/projects/page.tsx`
  - `app/dashboard/processing/page.tsx`
  - `app/dashboard/billing/page.tsx`, `app/dashboard/credit-history/page.tsx`
- Dubbing:
  - `app/dubbing/editor/page.tsx`
  - `app/dashboard/dubbing/editor/page.tsx`
  - `app/dubbing/export/page.tsx`
  - `app/dashboard/dubbing/export/page.tsx`
- Processing/export:
  - `app/processing/page.tsx`
  - `app/export/page.tsx`
  - `app/dashboard/export/page.tsx`

---

## Key components

This list is meant to help contributors find the “centers of gravity” quickly:

- **Auth**
  - `components/auth/AuthForm.tsx`: login UI (includes optional Google client id usage)
- **Dashboard**
  - `components/dashboard/DashboardSidebar.tsx`: navigation, user section
  - `components/dashboard/UploadZone.tsx`: media upload UX
  - `components/dashboard/ProjectList.tsx` / `ProjectCard.tsx`: project browsing
- **Dubbing preview/export**
  - `components/dubbing/DubbingVideoPlayer.tsx`
  - `components/dubbing/DubbingExportView.tsx`
- **Dubbing editor shell**
  - `components/dubbingEditor/EditorShell.tsx`: editor layout container
  - `components/dubbingEditor/BottomTimeline.tsx`: timeline/waveform interactions
  - `components/dubbingEditor/TopBar.tsx`, `LeftPanel.tsx`, `RightInspector.tsx`
  - `components/dubbingEditor/DubbingEditorContext.tsx`: editor state + media registry

---

## State management (Redux)

### Store

- **Location**: `redux/store.ts`
- **Reducers**:
  - `user`: `redux/slices/userSlice.ts`

### User slice

`userSlice.ts` is responsible for:

- `fetchUser`: calls `GET /api/user/profile` via the Axios instance
- `logoutUser`: calls `POST /api/auth/logout` and clears legacy localStorage items
- reducers:
  - `setUserDetails`
  - `clearUserDetails`

If you add new global state, keep slices small and feature-scoped.

---

## Editor state (Dubbing Editor Context)

The dubbing editor uses a dedicated context to coordinate state that is too editor-specific for Redux:

- **Location**: `components/dubbingEditor/DubbingEditorContext.tsx`

Key responsibilities:

- active job + jobId + refresh handler
- selected segment id + draft text
- “busy” state (`improve | save | regen | rebuild`) to coordinate UX
- **media registry** for:
  - `player` (HTMLVideoElement)
  - `audio` (HTMLAudioElement)
  - `ws` (WaveSurfer instance)
- undo/redo stacks for text and timing edits
- segment text version history (for quick rollback/compare)

This context is intentionally “editor-only”—it keeps tight coupling contained inside the editor feature.

---

## API integration (Axios + refresh)

### Axios client

- **Location**: `utils/axios.ts`
- **Base URL**: `NEXT_PUBLIC_BACKEND_URL`
- **Cookies**: `withCredentials: true`

### CSRF header behavior

For mutating methods (`POST/PUT/DELETE/PATCH`), it attempts to read a `csrfToken` cookie and sets:

- `X-CSRF-Token: <value>`

### 401 auto-refresh behavior

On `401`:

- requests queue while refresh is running
- refresh is executed via `POST <BACKEND>/api/auth/refresh` using *plain axios* to avoid recursion
- on refresh failure:
  - clears `userData` from localStorage
  - redirects to `/?error=session_expired` for protected routes

If you see infinite loops, verify:

- backend refresh endpoint behavior
- cookie settings (SameSite, domain, secure)
- that `NEXT_PUBLIC_BACKEND_URL` points to the correct origin

---

## Assets & storage URLs (local vs S3)

The frontend needs to render assets produced/stored by the backend:

- For S3-backed assets, `utils/axios.ts` exports:
  - `S3_BASE_URL`
  - `s3Url(keyOrUrl)` helper

Common pitfalls:

- backend uses `S3_PUBLIC_BASE_URL` while frontend uses `NEXT_PUBLIC_S3_BASE_URL`
- keys that already include a leading slash (the helper strips it)

---

## Environment variables

Create `frontend/.env.local`.

### Required

- `NEXT_PUBLIC_BACKEND_URL`

### Optional (feature-dependent)

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STORAGE_TYPE` (`local` | `s3`)
- `NEXT_PUBLIC_DIRECT_S3_UPLOAD` (`true` | `false`)
- `NEXT_PUBLIC_S3_BASE_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

---

## Development guidelines

- Prefer feature-local state unless multiple routes need it → then Redux
- Keep API logic centralized through `utils/axios.ts` (don’t create ad-hoc base URLs)
- In editor-like flows, be explicit about time units and state ownership
- When adding new environment variables, document them in:
  - `frontend/README.md`
  - this file (`frontend/DOCUMENTATION.md`)

---

## Build & deployment

### Local production build

```bash
npm run build
npm run start
```

### Production config checklist

- `NEXT_PUBLIC_BACKEND_URL` points to deployed backend
- if serving assets from S3/CDN:
  - `NEXT_PUBLIC_S3_BASE_URL` is correct
  - backend `S3_PUBLIC_BASE_URL` is correct

---

## Troubleshooting

### API calls failing / baseURL undefined

- ensure `NEXT_PUBLIC_BACKEND_URL` is set in `frontend/.env.local`
- restart dev server

### Stuck processing states

- confirm backend worker is running
- confirm Redis is running and reachable by backend

### Images/assets not rendering

- set `NEXT_PUBLIC_S3_BASE_URL` (frontend)
- verify backend `STORAGE_TYPE` and `S3_PUBLIC_BASE_URL`

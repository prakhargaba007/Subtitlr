# Kili Labs Video Transcribe

Monorepo for a video + audio **transcription**, **translation**, and **AI dubbing** platform.

- **`frontend/`**: user-facing Next.js app (projects, editor, export)
- **`backend/`**: Express API + media/AI pipelines (MongoDB + BullMQ)
- **`admin/`**: internal Next.js dashboard (RBAC-protected)

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Overview

Kili Labs Video Transcribe is a full-stack platform for:

- **Transcription** (timed text)
- **Subtitles** (SRT/VTT/ASS exports)
- **Dubbing** (translate + synthesize speech + mix/mux back into video)

The system is built around a **UI that starts jobs** and a **backend worker** that executes long-running media pipelines (FFmpeg + AI providers) via **BullMQ (Redis)**.

---

## Project Structure

```text
video transcribe/
├── frontend/                  # User app (Next.js 16)
│   └── README.md
├── backend/                   # API + queue producers + workers (Express)
│   ├── .env.example
│   └── README.md
├── admin/                     # Admin dashboard (Next.js 15 + Mantine)
│   └── README.md
├── docs/                      # Deep dives (billing, dubbing pipeline, etc.)
└── DOCUMENTATION.md           # Project-wide deep dive
```

---

## Features

### User app (frontend)

- Upload/import media and manage projects
- Interactive subtitle/dubbing editor with preview
- Export outputs (subtitles and/or dubbed video, depending on pipeline)

### Backend API + workers

- REST API for auth, projects/files, job creation/status, billing
- Background processing via BullMQ workers
- Media processing with FFmpeg (extract/mix/mux/timing)
- Pluggable AI integrations (Gemini/OpenAI/ElevenLabs/etc.)

### Admin portal

- Admin-only dashboard for operational oversight
- Billing and system monitoring views (depends on backend admin routes)

---

## Technology Stack

### Frontend

- **Framework**: Next.js 16.2, React 19
- **State**: Redux Toolkit
- **Styling**: Tailwind CSS v4

### Backend

- **Runtime**: Node.js 22.x
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Queue**: BullMQ (Redis)
- **Media**: FFmpeg (`fluent-ffmpeg` + `ffmpeg-static`)

### Admin

- **Framework**: Next.js 15.5, React 19
- **UI**: Mantine

---

## Getting Started

### Prerequisites

- **Node.js**: backend requires **Node 22.x** (see `backend/package.json`)
- **MongoDB**: local or hosted (default local: `mongodb://127.0.0.1:27017/...`)
- **Redis**: required for BullMQ queue + workers (default local: `localhost:6379`)

> FFmpeg is bundled via `ffmpeg-static` for most local dev workflows, but having a system FFmpeg install can still help when debugging.

### Quick Start

**Step 1 — Start the backend**

```bash
cd backend
cp .env.example .env
npm install
npm run start
```

- **Default URL**: `http://localhost:8080` (default `PORT=8080`)
- **Config**: edit `backend/.env` (AI keys, storage mode, billing, etc.)

**Step 2 — Start the worker** (required for processing)

```bash
cd backend
npm run worker
```

Run in a separate terminal. Without the worker, subtitle and dubbing jobs will be enqueued but never execute.

**Step 3 — Start the frontend**

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

Then start:

```bash
npm run dev
```

- **Default URL**: `http://localhost:3000`

**Step 4 — Start the admin portal** (optional)

```bash
cd admin
npm install
```

Create `admin/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

Then start:

```bash
npm run dev
```

- **Default URL**: `http://localhost:3001`

---

## Architecture

```text
┌───────────────────────────┐
│        Frontend           │
│    Next.js (User App)     │
│    http://localhost:3000  │
└──────────────┬────────────┘
               │ HTTP (REST)
               │
┌──────────────▼────────────┐
│          Backend           │
│   Express API + Orchestr.  │
│   http://localhost:8080    │
└──────────────┬────────────┘
               │
      ┌────────┼─────────┐
      │        │         │
┌─────▼───┐ ┌──▼──────┐ ┌─▼──────────┐
│ MongoDB │ │  Redis  │ │ Storage    │
│  Data   │ │ BullMQ  │ │ local / S3 │
└─────────┘ └──┬──────┘ └────────────┘
               │
      ┌────────▼─────────┐
      │     Worker        │
      │  FFmpeg + AI APIs │
      └───────────────────┘
```

The admin portal (`admin/`) is a separate Next.js app that talks to the same backend and relies on **admin-only routes** guarded by RBAC.

---

## Documentation

### Core component READMEs

- **Frontend**: `frontend/README.md`
- **Backend**: `backend/README.md`
- **Admin**: `admin/README.md`

### Deep dives

- **Project-wide deep dive**: `DOCUMENTATION.md`
- **Payments & Billing (Dodo Payments)**: `docs/PAYMENTS.md`
- **AI dubbing pipeline**: `docs/AI_DUBBING_PIPELINE.md`

---

## Development

### Typical workflow

- Run **backend API** + **worker** + **frontend** concurrently during feature work.
- When debugging “stuck processing”, always verify **Redis + worker** first.

### Useful scripts

- Frontend: `frontend/package.json`
- Backend: `backend/package.json` (includes `worker`, maintenance scripts)
- Admin: `admin/package.json`

---

## Deployment

This repo supports multiple deployment strategies (Docker/Vercel/VM), but the core requirements remain:

- A MongoDB instance
- A Redis instance
- Persistent storage for uploaded + generated artifacts (local disk or S3)
- A worker runtime capable of long-running FFmpeg + AI calls

For billing and dubbing specifics, see `docs/` and `DOCUMENTATION.md`.

---

## Security

- **JWT auth**: backend signs/validates user sessions via `JWT_SECRET`.
- **RBAC**: admin portal relies on backend routes that validate an `admin` role.
- **Secrets**: never commit `.env` files; keep keys only in environment variables / secret managers.

---

## Monitoring & Troubleshooting

### Processing never starts

- Confirm **Redis** is running
- Confirm **worker** is running (`cd backend && npm run worker`)

### API calls fail from frontend/admin

- Confirm `NEXT_PUBLIC_BACKEND_URL` is set and dev server restarted
- Confirm backend is reachable at the configured URL

---

## Ports & services (defaults)

- **Frontend**: `3000`
- **Admin**: `3001`
- **Backend**: `8080`
- **MongoDB**: `27017`
- **Redis**: `6379`

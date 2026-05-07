# Admin Panel — Deep Documentation

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Pages / Routing Map](#pages--routing-map)
7. [Components Reference](#components-reference)
8. [API Integration](#api-integration)
9. [Security Model](#security-model)
10. [Development Guidelines](#development-guidelines)
11. [Build & Deployment](#build--deployment)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The admin panel is a **Next.js 15 App Router** application that provides backoffice management for the Kili Labs platform. It is a separate process from the main `frontend/` (runs on port 3001) and targets the same Express API backend.

Key capabilities:

- **User management** — view, create, verify, and manage user accounts
- **Content management** — blog posts, categories, tags, courses, lessons, modules, quizzes, videos
- **File management** — upload, search, browse, and delete media assets
- **Billing management** — view and edit subscriptions, plan catalog
- **Notifications** — send push notifications to devices or users
- **Badges** — create and manage achievement badges
- **Analytics** — dashboard overview with stats

All routes under `/dashboard/*` are protected: only users with `role = admin` or `role = sub-admin` may access them.

---

## Technology Stack

### Core

- **Next.js**: ^15.5.12 (App Router, server components, server actions)
- **React**: ^19.2.4
- **TypeScript**: ^5.9.3

### UI

- **Mantine**: ^8.3.14 (component library — forms, modals, tables, notifications, charts, dates)
- **@tabler/icons-react**: ^3.36.1 (icon set used throughout the admin)
- **lucide-react**: ^0.563.0 (supplementary icons)
- **Tailwind CSS**: ^4.1.18 (utility classes for layout and spacing)
- **@mantine/charts**: ^8.3.14 (charts on the dashboard)

### HTTP & Data

- **axios**: ^1.13.5 (pre-configured with CSRF + 401 refresh)
- **date-fns**: ^4.1.0 / **moment**: ^2.30.1 (date formatting)
- **jszip**: ^3.10.1 (client-side ZIP export where needed)

---

## Project Structure

```text
admin/
├── app/                            # Next.js App Router pages
│   ├── page.tsx                    # Login page (route: /)
│   ├── layout.tsx                  # Root layout (Mantine, fonts)
│   └── dashboard/                  # All protected pages
│       ├── page.tsx                # Dashboard overview (route: /dashboard)
│       ├── badges/
│       │   └── page.tsx            # Badge management
│       ├── billing/
│       │   └── pricing-catalog/
│       │       └── page.tsx        # Plan catalog
│       ├── binge-content/
│       │   ├── all-youtube-binge/
│       │   │   └── page.tsx        # YouTube binge list
│       │   └── video-details/
│       │       └── [id]/
│       │           └── page.tsx    # Video detail view
│       ├── categories/
│       │   └── all-categories/
│       │       └── page.tsx        # Category list/CRUD
│       ├── courses/
│       │   ├── page.tsx            # Course management
│       │   └── all-courses/
│       │       └── page.tsx        # All courses list
│       ├── files/
│       │   └── page.tsx            # File manager
│       ├── image-orders/
│       │   ├── page.tsx            # Image order list
│       │   └── [orderNumber]/
│       │       └── page.tsx        # Order detail view
│       ├── lessons/
│       │   └── all-lessons/
│       │       └── page.tsx        # Lesson list/CRUD
│       ├── modules/
│       │   ├── page.tsx            # Module management
│       │   └── all-modules/
│       │       └── page.tsx        # All modules list
│       ├── notifications/
│       │   └── all-notifications/
│       │       └── page.tsx        # Notification management
│       ├── posts/
│       │   └── page.tsx            # Blog post management
│       ├── profiles/
│       │   ├── all-profiles/
│       │   │   └── page.tsx        # All users list
│       │   └── [id]/
│       │       └── page.tsx        # Individual user detail
│       ├── quizzes/
│       │   ├── all-quizzes/
│       │   │   └── page.tsx        # Quiz list
│       │   └── quiz-game/
│       │       └── page.tsx        # Quiz game manager
│       ├── tags/
│       │   └── all-tags/
│       │       └── page.tsx        # Tag list/CRUD
│       └── videos/
│           └── all-videos/
│               └── page.tsx        # Video list
│
├── components/                     # Reusable UI components (20 files)
├── utils/
│   └── axios.ts                    # Axios singleton with CSRF + 401 refresh
├── public/                         # Static assets
├── next.config.ts                  # Next.js config
├── tailwind.config.ts              # Tailwind config
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js 22.x**
- Backend API running at the URL set in `NEXT_PUBLIC_BACKEND_URL` (default: `http://localhost:8080`)

### Install

```bash
cd admin
cp .env.example .env.local
# Fill in NEXT_PUBLIC_BACKEND_URL at minimum
npm install
```

### Start dev server

```bash
npm run dev
```

Default URL: `http://localhost:3001` (uses `--port 3001` in the start script; Turbopack is enabled for dev).

---

## Environment Variables

Create `admin/.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Base URL of the Express backend (e.g. `http://localhost:8080`) |
| `NEXT_PUBLIC_S3_BASE_URL` | S3 mode | S3 base URL for resolving asset keys into public URLs |
| `NEXT_PUBLIC_CDN_BASE_URL` | Optional | CDN base URL — if set, assets are served from this origin instead of S3 directly |

> All `NEXT_PUBLIC_*` variables are embedded into the client bundle at build time. Never store secrets in them.

---

## Pages / Routing Map

### Authentication

| URL | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Login page — email/password form; on success stores `userRole` + `userData` in localStorage and redirects to `/dashboard` |

### Dashboard & overview

| URL | File | Description |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | Overview — stats, recent activity, and summary cards |

### User management

| URL | File | Description |
|---|---|---|
| `/dashboard/profiles/all-profiles` | `app/dashboard/profiles/all-profiles/page.tsx` | Paginated list of all users; supports search, filter by role, create/edit/delete via `UserModal` |
| `/dashboard/profiles/[id]` | `app/dashboard/profiles/[id]/page.tsx` | Individual user detail: profile data, subscription info, usage stats |

### Content management

| URL | File | Description |
|---|---|---|
| `/dashboard/posts` | `app/dashboard/posts/page.tsx` | Blog post list; create/edit/delete via `PostModal`; supports draft/published states |
| `/dashboard/categories/all-categories` | `app/dashboard/categories/all-categories/page.tsx` | Content category CRUD and status toggle |
| `/dashboard/tags/all-tags` | `app/dashboard/tags/all-tags/page.tsx` | Tag list and CRUD |
| `/dashboard/courses` | `app/dashboard/courses/page.tsx` | Courses landing — links to modules, lessons |
| `/dashboard/courses/all-courses` | `app/dashboard/courses/all-courses/page.tsx` | All courses list |
| `/dashboard/modules` | `app/dashboard/modules/page.tsx` | Module overview/landing |
| `/dashboard/modules/all-modules` | `app/dashboard/modules/all-modules/page.tsx` | All modules list with `LessonForm` integration |
| `/dashboard/lessons/all-lessons` | `app/dashboard/lessons/all-lessons/page.tsx` | All lessons; create/edit via `LessonForm` |
| `/dashboard/quizzes/all-quizzes` | `app/dashboard/quizzes/all-quizzes/page.tsx` | Quiz list; create/edit via `QuizForm` |
| `/dashboard/quizzes/quiz-game` | `app/dashboard/quizzes/quiz-game/page.tsx` | Interactive quiz game management (`QuizGameManager`) |

### Video & media

| URL | File | Description |
|---|---|---|
| `/dashboard/videos/all-videos` | `app/dashboard/videos/all-videos/page.tsx` | All uploaded videos — browse, filter, delete |
| `/dashboard/binge-content/all-youtube-binge` | `app/dashboard/binge-content/all-youtube-binge/page.tsx` | YouTube binge content list and management |
| `/dashboard/binge-content/video-details/[id]` | `app/dashboard/binge-content/video-details/[id]/page.tsx` | Individual video detail (comments, metadata) |
| `/dashboard/files` | `app/dashboard/files/page.tsx` | File manager: upload, search, bulk delete, stats |

### Badges

| URL | File | Description |
|---|---|---|
| `/dashboard/badges` | `app/dashboard/badges/page.tsx` | Badge list; create/edit badges with `BadgeIcon` preview |

### Billing

| URL | File | Description |
|---|---|---|
| `/dashboard/billing/pricing-catalog` | `app/dashboard/billing/pricing-catalog/page.tsx` | Plan catalog: list all plans, edit feature flags and credits per renewal |

### Notifications

| URL | File | Description |
|---|---|---|
| `/dashboard/notifications/all-notifications` | `app/dashboard/notifications/all-notifications/page.tsx` | Notification history, device token management, send new notifications |

### Orders

| URL | File | Description |
|---|---|---|
| `/dashboard/image-orders` | `app/dashboard/image-orders/page.tsx` | Image order list |
| `/dashboard/image-orders/[orderNumber]` | `app/dashboard/image-orders/[orderNumber]/page.tsx` | Individual order detail with line items |

---

## Components Reference

All 20 components live in `components/`:

| File | Purpose |
|---|---|
| `Navbar/AdminNavbar.tsx` | App shell sidebar — collapsible nav links, user info, logout |
| `Navbar/NavbarLinksGroup.tsx` | Mantine Accordion-based nested nav item group (icon + label + sub-links) |
| `AuthenticationImage.tsx` | Login page layout with split-panel image + form |
| `UserModal.tsx` | Create/edit user modal — name, email, password, role, profile picture |
| `PostModal.tsx` | Create/edit blog post modal — title, slug, content, tags, category, thumbnail, status |
| `LessonForm.tsx` | Full lesson editor — title, video, documents, content, quiz linking |
| `QuizForm.tsx` | Quiz create/edit form — question/option builder with multiple-choice support |
| `QuizGameManager.tsx` | Interactive quiz game admin: start/stop sessions, see live answers |
| `BadgeIcon.tsx` | Renders a badge with icon, background and border colors for preview |
| `RecentVideos.tsx` | Dashboard widget — shows the most recently uploaded videos |
| `DocumentsTab.tsx` | Upload/manage document attachments (PDF, DOC) for a lesson or resource |
| `FileSelector.tsx` | Browse + pick from previously uploaded files (opens modal of `/api/files` results) |
| `VideoSelector.tsx` | Browse + pick from uploaded videos |
| `CategorySelector.tsx` | Search-on-type category picker backed by `/api/categories` |
| `AuthorSelector.tsx` | Search-on-type user picker for assigning author/ownership |
| `UserSelector.tsx` | General-purpose user picker with search, used in notification targeting |
| `TagSelector.tsx` | Multi-select tag picker backed by `/api/tags` |
| `Notification/NotifiactionDashboardTab.tsx` | Compose and send push notifications (target: all / by user / by device) |
| `Notification/NotificationHistory.tsx` | Paginated list of previously sent notifications |
| `Notification/DeviceTokensTab.tsx` | View and manage registered Expo push tokens per user |

---

## API Integration

### Axios singleton (`utils/axios.ts`)

The admin uses a pre-configured Axios instance exported from `utils/axios.ts`. Every component that makes API calls imports from here — never creates its own Axios instance.

Key configuration:

```typescript
const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,  // send cookies on every request
});
```

### CSRF header injection

On every mutating request (`POST`, `PUT`, `DELETE`, `PATCH`), the request interceptor:

1. Reads the `csrfToken` cookie from `document.cookie` (this is a **readable** cookie set by the backend alongside the HttpOnly `accessToken`)
2. Attaches it as the `X-CSRF-Token` header

The backend's `is-auth.js` middleware compares this header to the cookie value and rejects the request with 403 if they do not match.

### 401 auto-refresh

When any request returns `HTTP 401`:

1. Concurrent requests are queued in `failedQueue` (not rejected immediately)
2. The interceptor calls `POST /api/auth/refresh` using `withCredentials: true` to get a new access token cookie
3. If refresh succeeds: all queued requests are retried with the new cookie
4. If refresh fails: all queued requests are rejected, `localStorage` is cleared, and the user is redirected to `/` (login)

The refresh endpoint itself is excluded from retry logic to prevent infinite loops.

---

## Security Model

### Role-based access control (RBAC)

| Role | Access |
|---|---|
| `customer` | No access to the admin panel |
| `sub-admin` | Can access all admin pages except plan catalog mutations |
| `admin` | Full access to all pages and destructive operations |

### How authentication is enforced

1. On login (`/`), the admin submits credentials to `POST /api/auth/login`
2. The backend sets an HttpOnly `accessToken` cookie + a readable `csrfToken` cookie + a `refreshToken` cookie
3. `userRole` and `userData` are stored in `localStorage` for UI-level gating (e.g. hiding buttons)
4. Each protected page / API call is validated by the backend (`is-auth.js` + `is-admin.js`)
5. If the access token expires, the 401 interceptor refreshes it transparently
6. If refresh fails, the user is signed out and returned to `/`

> The admin never performs access control purely in the browser. All sensitive operations are protected by `is-admin.js` on the backend, which checks the MongoDB user record for `admin` or `sub-admin` role.

---

## Development Guidelines

### Adding a new page

1. Create a file at `app/dashboard/<area>/page.tsx`
2. It will automatically be accessible at `/dashboard/<area>`
3. No explicit route registration is needed (Next.js App Router)

### Adding a new component

1. Create a `.tsx` file in `components/`
2. Import `utils/axios.ts` for all API calls — do not create new Axios instances
3. Use Mantine components for consistency (`@mantine/core`, `@mantine/form`, `@mantine/notifications`)
4. Use Tabler icons (`@tabler/icons-react`) for icons

### Building forms

Use `@mantine/form`:

```typescript
const form = useForm({
  initialValues: { name: "", email: "" },
  validate: { email: (v) => (/^\S+@\S+$/.test(v) ? null : "Invalid email") },
});
```

### Error handling

Use Mantine `notifications.show` for user-facing errors:

```typescript
import { notifications } from "@mantine/notifications";

notifications.show({
  title: "Error",
  message: error.response?.data?.message ?? "Something went wrong",
  color: "red",
});
```

---

## Build & Deployment

### Build

```bash
npm run build
```

Generates a production-optimized build in `.next/`.

### Start

```bash
npm run start
```

Starts the server on port 3001.

### Notes

- The admin is a **separate service** from `frontend/` — deploy it on its own host/subdomain (e.g. `admin.kililabs.io`)
- Add the admin origin (`ADMIN_URL` in `backend/.env`) to the backend's CORS allowed list
- All `NEXT_PUBLIC_*` env vars must be set at **build time** — they are baked into the static bundle

---

## Troubleshooting

### Login redirects back to `/` immediately

- Check that `NEXT_PUBLIC_BACKEND_URL` points to the running backend
- Check that the backend's CORS config includes the admin origin (`ADMIN_URL` in `backend/.env`)
- Check browser console for CORS or network errors

### Assets (images, videos) not loading

- Verify `NEXT_PUBLIC_S3_BASE_URL` or `NEXT_PUBLIC_CDN_BASE_URL` is set and matches the backend's `S3_PUBLIC_BASE_URL`

### 401 keeps looping / session not refreshing

- The `refreshToken` cookie domain must match the admin's origin
- Check that the backend sets cookies with `SameSite=None; Secure` in production (required for cross-origin cookies)

### API calls return 403 (CSRF)

- The `csrfToken` cookie must be readable by JavaScript (not HttpOnly)
- Ensure the admin domain matches the backend's cookie domain so the browser includes the cookie

### Mantine components not rendering correctly

- Confirm `MantineProvider` wraps the root layout in `app/layout.tsx`
- Confirm the Mantine CSS import (`@mantine/core/styles.css`) is present in the layout

# Admin Panel

Backoffice management for the Kili Labs platform — users, content, billing, notifications. Built with **Next.js 15 App Router** and **Mantine 8**.

> For detailed documentation of every page, component, and security model see **[admin/DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## Table of Contents

- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Pages](#pages)
- [Security model](#security-model)
- [Scripts](#scripts)

---

## Tech stack

- **Framework**: Next.js ^15.5.12 (App Router, Turbopack for dev)
- **UI library**: Mantine ^8.3.14 (forms, modals, tables, charts, notifications)
- **Icons**: @tabler/icons-react ^3.36.1 + lucide-react ^0.563.0
- **Styling**: Tailwind CSS ^4.1.18
- **HTTP client**: axios ^1.13.5 (CSRF + 401 auto-refresh built in)
- **Language**: TypeScript ^5.9.3

---

## Project structure

```text
admin/
├── app/
│   ├── page.tsx                          # Login page (/)
│   └── dashboard/
│       ├── page.tsx                      # Overview (/dashboard)
│       ├── badges/page.tsx               # Badge management
│       ├── billing/pricing-catalog/page.tsx  # Plan catalog
│       ├── binge-content/
│       │   ├── all-youtube-binge/page.tsx
│       │   └── video-details/[id]/page.tsx
│       ├── categories/all-categories/page.tsx
│       ├── courses/
│       │   ├── page.tsx
│       │   └── all-courses/page.tsx
│       ├── files/page.tsx                # File manager
│       ├── image-orders/
│       │   ├── page.tsx
│       │   └── [orderNumber]/page.tsx
│       ├── lessons/all-lessons/page.tsx
│       ├── modules/
│       │   ├── page.tsx
│       │   └── all-modules/page.tsx
│       ├── notifications/all-notifications/page.tsx
│       ├── posts/page.tsx                # Blog posts
│       ├── profiles/
│       │   ├── all-profiles/page.tsx     # All users
│       │   └── [id]/page.tsx             # User detail
│       ├── quizzes/
│       │   ├── all-quizzes/page.tsx
│       │   └── quiz-game/page.tsx
│       ├── tags/all-tags/page.tsx
│       └── videos/all-videos/page.tsx
│
├── components/                           # Reusable UI components (20 files)
│   ├── Navbar/
│   │   ├── AdminNavbar.tsx               # App shell sidebar
│   │   └── NavbarLinksGroup.tsx          # Nested nav groups
│   ├── AuthenticationImage.tsx           # Login layout
│   ├── UserModal.tsx                     # Create/edit user
│   ├── PostModal.tsx                     # Create/edit blog post
│   ├── LessonForm.tsx                    # Lesson editor
│   ├── QuizForm.tsx                      # Quiz editor
│   ├── QuizGameManager.tsx               # Live quiz session
│   ├── BadgeIcon.tsx                     # Badge preview
│   ├── RecentVideos.tsx                  # Dashboard widget
│   ├── DocumentsTab.tsx                  # Attachment manager
│   ├── FileSelector.tsx / VideoSelector.tsx
│   ├── CategorySelector.tsx / TagSelector.tsx
│   ├── AuthorSelector.tsx / UserSelector.tsx
│   └── Notification/
│       ├── NotifiactionDashboardTab.tsx
│       ├── NotificationHistory.tsx
│       └── DeviceTokensTab.tsx
│
└── utils/
    └── axios.ts                          # Axios singleton (CSRF + 401 refresh)
```

---

## Getting started

```bash
cd admin
cp .env.example .env.local
# Fill in NEXT_PUBLIC_BACKEND_URL
npm install
npm run dev
```

Admin panel opens at `http://localhost:3001`.

---

## Environment variables

Create `admin/.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API URL (e.g. `http://localhost:8080`) |
| `NEXT_PUBLIC_S3_BASE_URL` | S3 mode | Base URL for S3 asset keys |
| `NEXT_PUBLIC_CDN_BASE_URL` | Optional | CDN origin — assets are served from here if set |

---

## Pages

### Auth

- `/` — Login page

### Dashboard

- `/dashboard` — Overview stats and recent activity

### Users

- `/dashboard/profiles/all-profiles` — All users (search, filter, create, edit)
- `/dashboard/profiles/[id]` — User detail (profile, subscription, usage)

### Content

- `/dashboard/posts` — Blog post management
- `/dashboard/categories/all-categories` — Category CRUD
- `/dashboard/tags/all-tags` — Tag CRUD
- `/dashboard/courses` — Course management overview
- `/dashboard/courses/all-courses` — All courses
- `/dashboard/modules` / `/dashboard/modules/all-modules` — Module management
- `/dashboard/lessons/all-lessons` — Lesson list and editor
- `/dashboard/quizzes/all-quizzes` — Quiz list
- `/dashboard/quizzes/quiz-game` — Live quiz session manager

### Videos & Files

- `/dashboard/videos/all-videos` — All videos
- `/dashboard/binge-content/all-youtube-binge` — YouTube binge content
- `/dashboard/binge-content/video-details/[id]` — Video detail
- `/dashboard/files` — File manager (upload, search, delete)

### Billing & Orders

- `/dashboard/billing/pricing-catalog` — Plan catalog and feature flags
- `/dashboard/image-orders` — Image orders list
- `/dashboard/image-orders/[orderNumber]` — Order detail

### Other

- `/dashboard/badges` — Badge management
- `/dashboard/notifications/all-notifications` — Push notification management

---

## Security model

All `/dashboard/*` routes are protected server-side:

- Login calls `POST /api/auth/login` — backend issues HttpOnly `accessToken` cookie + `csrfToken` cookie
- Every mutating API request includes `X-CSRF-Token` header (read from `csrfToken` cookie by `utils/axios.ts`)
- 401 responses trigger automatic token refresh via `POST /api/auth/refresh`; if refresh fails, user is redirected to `/`
- Backend verifies the user's `role` is `admin` or `sub-admin` on every request via `is-admin.js`

See [Security Model](./DOCUMENTATION.md#security-model) in `DOCUMENTATION.md` for the full breakdown.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Start production server on port 3001 |
| `npm run lint` | ESLint check |

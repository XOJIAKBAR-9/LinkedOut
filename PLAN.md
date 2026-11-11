# LinkedOut — Plan & Decisions

A professional-network app, built on the prescribed stack. This file records what exists, where it
deviates from the brief (and why), and what comes next.

## Status

| Area | State |
|---|---|
| Monorepo (npm workspaces: `apps/web`, `apps/api`, `packages/shared`) | ✅ |
| Shared Zod schemas + TS types (auth, profile, posts, comments, reactions, messages, socket events) | ✅ |
| Auth: register/login (bcrypt), JWT access + rotating refresh token in httpOnly cookies, logout, email verification, forgot/reset password | ✅ |
| GitHub OAuth (Passport) — enabled when `GITHUB_CLIENT_ID/SECRET` are set | ✅ (untested against real GitHub) |
| Profiles: view, edit, avatar + banner upload, experience | ✅ (experience is read-only in the UI) |
| Network: connect, accept, ignore, remove, list | ✅ |
| Settings page + permanent account deletion (confirm, then password; removes data, uploads and sessions) | ✅ |
| Feed: posts with images, cursor pagination + infinite scroll, 5 reaction types, comments with one-level reply threads | ✅ |
| Messaging: 1:1 conversations, real-time delivery, typing indicators, chat dock, unread badge, 12 original stickers, edit (15 min) / delete for everyone, Seen/Sent receipts | ✅ |
| Notifications: reaction / comment / reply / connection, live via Socket.IO, unread badge | ✅ |
| Search: Postgres `tsvector` over people, posts, companies (prefix matching), people suggestions while typing (real accounts only) | ✅ |
| Swagger UI at `/api/docs` | ✅ |
| i18n: English, Russian, Uzbek (Latin) with a language switcher | ✅ |
| Seed: 50 users, 20 fictional companies, 200 posts, comments, reactions, connections, conversations, 6 groups | ✅ |
| Tests: 16 API (Vitest + Supertest, incl. Socket.IO), 8 component (RTL), 4 Playwright flows | ✅ unit/API pass; e2e written, not yet run |
| Groups UI, company pages, jobs | ⏳ data model + seed only |

## Architecture

```
apps/api/src
  config/       env (Zod-validated), passport
  routes/       URL → middleware → controller   (validation happens here)
  controllers/  HTTP in/out only: read req, call service, shape res, set cookies
  services/     business rules + Prisma; no Express types except Multer files
  middleware/   auth, validate, upload, rate limits, error handler
  lib/          prisma, logger, tokens, mailer, storage, serializers
  socket/       Socket.IO server + `emitToUser` used by services
  docs/         OpenAPI document
```

- **Errors**: services throw `AppError` (status + code). Zod, Multer and Prisma `P2002/P2025` errors are mapped
  centrally. Every error response is `{ error: { code, message, details? } }` (`ApiError` in shared).
- **Pagination**: cursor-based (`?cursor=<id>&limit=n` → `{ items, nextCursor }`), stable under inserts.
- **Real-time**: each socket joins `user:<id>`. Services call `emitToUser(...)`, which is a no-op when Socket.IO
  isn't running (e.g. API tests), so services stay testable without a socket server.

## Auth design

- **Access token**: JWT, 15 min, cookie `lo_access` (`httpOnly`, `SameSite=Lax`, `Secure` in prod, `Path=/`).
- **Refresh token**: opaque random string, 30 days, cookie `lo_refresh` scoped to `Path=/api/v1/auth` so it's only
  sent to auth endpoints. Only an HMAC of it is stored. Each refresh **rotates** it; replaying a used token
  revokes every session for that user (theft detection).
- The web client retries once on 401 after a single shared `/auth/refresh` call.
- Password reset revokes all sessions. Forgot-password always returns 204 (no account enumeration). Login
  compares against a dummy hash for unknown emails to keep timing similar.
- **CSRF**: cookies are `SameSite=Lax`, CORS allows only `WEB_ORIGIN` with credentials, and all mutations are
  non-GET with JSON or multipart bodies. Add a double-submit token if the API is ever served cross-site.
- Socket.IO authenticates with the same access cookie (or `auth.token`).

## Design system — "Exit interview"

Redline on paper: honest, a little rebellious, trustworthy. Dark (warm ink) is the primary theme; light is warm paper.
Live reference with every token and component: **`/styleguide`**.

- **Colour tokens** (`apps/web/src/index.css`): ink `#141312` / paper `#F6F1E7`, redline `#FF5B3A` (light `#B8321A`)
  for actions and quit stories, highlighter `#F5C542` for warnings and reasons, freedom green `#8FBF7F`. All text pairs ≥ 4.5:1.
- **Type**: Source Serif 4 (display, italic headlines) · IBM Plex Sans (UI) · IBM Plex Mono (structured fields, stamps).
  Self-hosted via Fontsource with Cyrillic + Latin Extended. Scale: 11 / 12 / 13 / 15 / 17 / 20 / 24 / 30 / 36.
- **Shape**: 4px spacing grid; 3px stamps, 6px controls/cards, full radius for avatars and reaction pills.
  Elevation is borders, not shadows (only menus/dialogs cast one).
- **Components**: Button (one redline primary per view), Input/Textarea, Card, Avatar, Badge (`stamp`, `highlight`, …), EmptyState.
- **Motion**: reaction pop, post publish, chat send — nothing else; all disabled under `prefers-reduced-motion`.
- **Post types**: Update · I quit (tilted red-pen stamp, company struck through) · Don't apply here (highlighter band) ·
  Red flag (redline bar). Typed posts carry company, role, time served and up to 4 reason tags, and may be anonymous.
- **Reactions**: Respect · Same · Run · Funny (Lucide icons, no emoji).

## Internationalisation

- **react-i18next** with one JSON file per language in `apps/web/src/i18n/locales` (`en`, `ru`, `uz`).
  Keys are type-checked against `en.json`; a test fails if any language is missing a key.
- Language is picked from `localStorage` (`lo-lang`), then the browser language, falling back to English.
  The switcher in the header (and on sign-in pages) changes it instantly and updates `<html lang>`.
- **Plurals** use i18next suffixes: English/Uzbek `_one/_other`, Russian `_one/_few/_many/_other`.
- **Validation**: shared Zod schemas use i18n keys as messages (`"validation.emailInvalid"`), so the same
  schema gives translated errors in the browser. The API returns machine-readable error codes
  (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, …, listed in `API_ERROR_CODES`); the client translates them via `errors.<CODE>`.
- **Dates**: `Intl` for English and Russian. Chromium's ICU data for Uzbek is incomplete (it prints "-43 min"
  and "2026 M11"), so Uzbek relative times and month names come from our own translations (`time.*`).
- Not translated: user-written content, and emails sent by the API (still English).
- To add a language: copy `en.json`, translate it, and add it to `LANGUAGES` in `src/i18n/index.ts`.

## Deviations from the brief (and why)

1. **Tailwind v3, not v4.** shadcn/ui's config and CSS-variable theming are most mature on v3; v4 changes the
   config model. Easy to upgrade later.
2. **shadcn/ui components are vendored by hand** (`src/components/ui`) rather than via the CLI, which needs network
   prompts. They're the standard shadcn sources; `components.json` is present so `npx shadcn add …` works from now on.
3. **OpenAPI is hand-written** (`apps/api/src/docs/openapi.ts`) rather than generated from Zod. It avoids another
   dependency while the API is small; switch to `@asteasolutions/zod-to-openapi` once endpoints stabilise.
4. **`searchVector` columns are Postgres generated columns**, added by hand-editing the first migration. Prisma
   models them as `Unsupported("tsvector") @default(dbgenerated())` so it neither writes nor tries to drop them.
   Any new migration touching those tables should keep that in mind.
5. **multer 2.x** instead of 1.x: 1.x has published vulnerabilities.
6. **No seeded avatars.** Fake users get initials instead of stock photos of real people.

## Running locally

See README.md. Short version: `npm install`, start Postgres (`npm run db:up` or any local Postgres 14+), copy
`apps/api/.env.example` → `apps/api/.env`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

## Next steps

1. Groups UI (list, join, group feed); the API needs routes on top of the existing models.
2. Company pages + linking experience to companies in the profile editor; add/edit/delete experience.
3. Run Playwright in CI (GitHub Actions with a Postgres service container).
4. Read receipts + unread counts per conversation (`lastReadAt` is already stored).
5. S3/R2 `Storage` implementation, and image resizing (sharp) before storing.
6. Real mailer (SMTP/Resend) behind the existing `Mailer` interface.
7. Generate OpenAPI from Zod; add an ESLint + Prettier config and a pre-commit hook.
8. Translate API emails (store a preferred language on the user).

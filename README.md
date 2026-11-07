# LinkedOut

A professional-network app: profiles, connections, a feed with reactions and comments, real-time
messaging and notifications, and full-text search. Available in English, Russian and Uzbek.

**Stack:** React + Vite + TypeScript, TanStack Query, Zustand, Tailwind + shadcn/ui · Node + Express +
Prisma + PostgreSQL · Socket.IO · Zod schemas shared between both sides. See [PLAN.md](PLAN.md) for design
notes and what's next.

```
apps/web/        React frontend (Vite, port 5173)
apps/api/        Express API (port 4000) — REST under /api/v1, Swagger at /api/docs
packages/shared/ Zod schemas + TypeScript types used by both
```

## Getting started

Requires Node 20+ and PostgreSQL 14+.

```bash
npm install
```

Start Postgres. With Docker:

```bash
npm run db:up
```

Or use any local Postgres and create a database (e.g. `createdb linkedout`).

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`: set `DATABASE_URL` if you're not using Docker, and replace both JWT secrets.

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:5173 and sign in as **demo@linkedout.test / password123** (every seeded user has that
password). In development, verification and password-reset emails are printed in the API console.

### Sending real emails (optional)

Without SMTP settings, verification and password-reset emails are only printed in the API console
(look for `📧`). To deliver them, fill in the `SMTP_*` lines in `apps/api/.env`. The API reloads by itself
and logs `SMTP ready` or a clear error. For Gmail:

1. Turn on 2-Step Verification for the Google account.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=<your Gmail address>`,
   `SMTP_PASS=<the 16-character App Password>` and `MAIL_FROM="LinkedOut <your Gmail address>"`.

Any other SMTP provider (Mailgun, Resend, Amazon SES, Brevo, …) works the same way with its own host and credentials.

### GitHub sign-in (optional)

Create an OAuth app at https://github.com/settings/developers with callback URL
`http://localhost:4000/api/v1/auth/github/callback`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
in `apps/api/.env`. The "Continue with GitHub" button appears automatically.

## Tests

API tests need a separate, disposable database (it is **reset** on every run):

```bash
createdb linkedout_test
```

```bash
TEST_DATABASE_URL=postgresql://USER@localhost:5432/linkedout_test npm test
```

With Docker Postgres, the default `TEST_DATABASE_URL` already points at `linkedout_test`; create it with
`docker compose exec db createdb -U linkedout linkedout_test`.

End-to-end tests (Playwright) run against the dev servers with a seeded database:

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Shared package watcher + API + web, together |
| `npm run build` | Production build of all packages |
| `npm run typecheck` | Type-check everything |
| `npm test` | API + component tests |
| `npm run test:e2e` | Playwright flows |
| `npm run db:migrate` / `db:seed` | Prisma migrations / reseed fake data |

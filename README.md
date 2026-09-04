# Third Wave BBQ — Maintenance & Operational Issues

Issue tracking for Third Wave BBQ's restaurants. A venue employee raises a problem
with photos, a priority and a due date; it gets assigned, commented on, and driven
to closed. Head Office sees the whole estate.

**Venue employees see only their own venue's issues. Head Office sees every
venue.** That boundary is the point of the feature, and it is enforced on the
server for every read — including photos.

---

## Running it

```bash
cp .env.example .env
docker compose up --build
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001/api>
- Postgres: `localhost:5433` (`bbq` / `bbq`)

Migrations run at API start, and the database is seeded on first boot with three
venues, nine users and twenty issues. Re-running never overwrites existing data —
the seed only fills an empty database.

Pick a user from the switcher in the top right. Good ones to try:

| User | Role | Sees |
|---|---|---|
| Tom Nguyen | Newtown staff | Newtown only |
| Dana Ellis | Newtown manager | Newtown only |
| Rafi Haddad | Bondi staff | Bondi only |
| Priya Raman | Head Office | Everything, plus a per-venue breakdown |

Sign in as Newtown staff, open an issue, then switch to Bondi staff on the same
URL. You get a not-found page, not a permission error — see below for why.

---

## ⚠️ Authentication is stubbed

`api/src/auth/dev-auth.guard.ts` trusts an `X-User-Id` request header. **Anyone can
impersonate any user, Head Office included, by editing a request.** This is fine
for building and demoing and must be replaced before the app is reachable by
anyone you do not trust.

Replacing it is a single-file change. The guard's only job is to put an `AuthUser`
(`{ id, name, email, role, venueId }`) on `req.user`; nothing downstream cares how
it got there. Also set `NODE_ENV=production` on the API, which removes the
`/api/dev/users` endpoint the switcher depends on.

---

## Architecture

```
docker-compose.yml     postgres + api + web; named volumes for the DB and uploads
api/                   NestJS 10 · Prisma · PostgreSQL 16
web/                   Next.js 15 (App Router) · Tailwind
```

### How venue isolation works

1. **One helper.** `api/src/common/scope.ts` turns a user into a Prisma `where`
   fragment. Every issue query composes it. No controller writes its own venue
   predicate.
2. **In the service layer, not the controller.** A future non-HTTP caller inherits
   the rule instead of re-deriving it.
3. **404, never 403.** A 403 on another venue's issue would confirm the issue
   exists. Out-of-scope reads are indistinguishable from missing ones.
4. **Photos are streamed, not static.** `GET /api/issues/:id/attachments/:aid`
   re-runs the same check before reading from disk. Files are stored under random
   UUID names outside any web root. *Serving the upload directory with
   `express.static` or an nginx alias would silently bypass all of this.*
5. **Assignment is validated server-side.** An assignee must work at the issue's
   venue or be Head Office. The UI dropdown is a convenience, not a control.
6. **Uploads are sniffed.** The declared `Content-Type` is ignored; the leading
   bytes decide whether a file is a real JPEG/PNG/WebP/HEIC. Rejected files are
   deleted rather than left on disk.

The browser cannot attach an auth header to an `<img src>`, so photos are proxied
through `web/app/photo/[issueId]/[attachmentId]/route.ts`, which reads the session
cookie and calls the scoped API route. The proxy grants nothing extra — a viewer
without access gets the API's 404 passed straight back.

### Status workflow

```
OPEN ⇄ IN_PROGRESS
  ↓        ↓
    CLOSED  → OPEN  (reopen)
```

`closedAt` is derived from the status, never sent by the client. Illegal
transitions are rejected with a 400 naming what is allowed.

---

## API

All routes are under `/api` and require the `X-User-Id` header (see the warning
above), except `GET /api/health` and `GET /api/dev/users`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/me` | the current user |
| `GET` | `/dev/users` | switcher list; not registered in production |
| `GET` | `/venues` | HO: all. Venue user: their own. |
| `GET` | `/venues/:id/assignable-users` | venue members + all Head Office |
| `GET` | `/issues` | filtered and paginated, see below |
| `POST` | `/issues` | HO must pass `venueId`; venue users cannot |
| `GET` | `/issues/:id` | with comments, photos, reporter, assignee |
| `PATCH` | `/issues/:id` | title, description, priority, status, assigneeId, dueDate |
| `POST` | `/issues/:id/attachments` | multipart, field `files`, max 8 × 10 MB |
| `GET` | `/issues/:id/attachments/:aid` | streams the image, scoped |
| `DELETE` | `/issues/:id/attachments/:aid` | uploader, venue manager or HO |
| `GET`/`POST` | `/issues/:id/comments` | |
| `GET` | `/notifications`, `/notifications/unread-count` | own only |
| `POST` | `/notifications/:id/read`, `/notifications/read-all` | |
| `GET` | `/dashboard/summary` | scoped counts; per-venue table for HO |

**List filters:** `status` and `priority` (repeatable or comma-separated),
`assigneeId` (accepts `me`), `reporterId`, `unassigned`, `overdue`, `q` (title and
description), `venueId` (**Head Office only — ignored for venue users, not
rejected**), `sort` (`createdAt|updatedAt|dueDate|priority|status|title`), `dir`,
`page`, `pageSize` (max 100).

Frontend filters live in the URL, so a filtered view can be sent to a colleague and
the back button behaves.

---

## Local development without Docker

Postgres still comes from Compose:

```bash
docker compose up -d postgres

cd api
npm install
export DATABASE_URL="postgresql://bbq:bbq@localhost:5433/bbq?schema=public"
export UPLOAD_DIR=/tmp/bbq-uploads
npx prisma migrate deploy && npx ts-node prisma/seed.ts
npm run build && npm run start:prod

cd ../web
npm install
export API_INTERNAL_URL=http://127.0.0.1:3001/api
export NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run build && npm run start
```

Use `127.0.0.1`, not `localhost`, for `API_INTERNAL_URL`. Node's `fetch` resolves
`localhost` to `::1` first and the API binds IPv4, so `localhost` fails with
`ECONNREFUSED` while curl (which falls back) works fine.

---

## Not built

- **Automated tests.** The isolation rules are verified by hand. A Jest e2e suite
  pinning them is the first thing to add — a regression here leaks one venue's
  data to another and would do so silently.
- Real authentication (see above), an audit trail of field changes, email
  notifications, users belonging to more than one venue, and a mobile-specific UI
  pass. The layout is responsive but was designed desktop-first.

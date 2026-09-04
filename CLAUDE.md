# CLAUDE.md

Maintenance and operational issue tracking for Third Wave BBQ. Head Office plus
multiple restaurant venues. Next.js frontend, NestJS API, PostgreSQL, Docker
Compose, deployed to an Ubuntu VPS.

## Layout

```
api/   NestJS 10 · Prisma · Postgres      (port 3001, all routes under /api)
web/   Next.js 15 App Router · Tailwind   (port 3000)
```

## Commands

```bash
docker compose up --build          # whole stack; migrates and seeds on first boot
docker compose logs -f api         # API logs
docker compose down -v             # reset, including the database and uploads

cd api  && npx tsc --noEmit        # typecheck
cd web  && npx tsc --noEmit && npm run build
```

Postgres is on host port **5433**, not 5432, to avoid clashing with a local install.

After changing `api/prisma/schema.prisma`:

```bash
cd api
DATABASE_URL="postgresql://bbq:bbq@localhost:5433/bbq?schema=public" \
  npx prisma migrate dev --name <what-changed>
```

## The rule that matters

**Venue employees see only their own venue's issues. Head Office sees all
venues.** This is the feature's reason to exist. Treat any change that touches
issue reads as security-relevant.

- **`api/src/common/scope.ts` is the single source of truth.** `issueVenueScope()`
  returns a Prisma `where` fragment. Every issue query composes it. **Never write
  a venue predicate by hand** — add to that helper instead.
- **Scope in services, not controllers.** Controllers pass `req.user` down and do
  nothing else. Anything loading an issue calls
  `IssuesService.getScopedIssueOrThrow()`, which is why comments and attachments
  inherit isolation for free rather than reimplementing it.
- **Out-of-scope reads return 404, not 403.** A 403 confirms the issue exists.
- **A venue user's `venueId` query param is ignored, not rejected.** Only Head
  Office can narrow by venue.
- **Photos are streamed through an authenticated route**, never served statically.
  `express.static` or an nginx alias over `UPLOAD_DIR` would silently bypass every
  rule above. Files are random UUIDs on disk; `originalName` is display-only and
  must never be used to build a path.
- **Assignment is checked server-side**: an assignee must be at the issue's venue
  or be Head Office. The UI dropdown is a convenience, not a control.
- **Uploads are sniffed** (`api/src/attachments/file-signature.ts`) — the declared
  `Content-Type` is not trusted. Rejected files are deleted, not left on disk.

## Auth is stubbed

`api/src/auth/dev-auth.guard.ts` trusts an `X-User-Id` header. Anyone can
impersonate anyone. It is a deliberate, isolated seam: replacing it means
producing an `AuthUser` (`{ id, name, email, role, venueId }`) on `req.user` and
nothing downstream changes. `GET /api/dev/users` powers the frontend switcher and
disappears when `NODE_ENV=production`.

The web side mirrors this: `lib/cookie.ts` holds the cookie name, `lib/session.ts`
reads it, `middleware.ts` redirects to `/welcome` when it is unset.

**Do not deploy this to a public host.** Flag it if a task moves in that
direction.

## Conventions

- **Data model** (`api/prisma/schema.prisma`): `Issue.venueId` is denormalised onto
  the issue, not derived through the reporter, so scoping is one indexed predicate
  and survives a user changing venues.
- **Status transitions** live in `api/src/issues/status.ts` as a pure function.
  `OPEN ⇄ IN_PROGRESS`, both → `CLOSED`, `CLOSED` → `OPEN` to reopen. `closedAt` is
  derived from the status, never accepted from the client.
- **Notifications** go through `NotificationsService.emit()`, which suppresses
  notifying the actor about their own action. Never write `notification` rows
  directly.
- **Validation**: DTOs with class-validator. The global pipe uses `whitelist` and
  `forbidNonWhitelisted`, so an unexpected body field is a 400 — this is what stops
  a venue user PATCHing `venueId` onto an issue.
- **Frontend fetching**: server components only, through `web/lib/api.ts`. Filters
  are URL search params so views are shareable and the back button works. Mutations
  are server actions in `web/app/actions.ts` plus `revalidatePath`. There is no
  client data-fetching library; do not add one without reason.
- **`web/lib/api.ts` imports `next/headers`** and therefore cannot be imported from
  a client component. Client-safe URL helpers live in `web/lib/urls.ts`.

## Gotchas that have already bitten

- **Node 18 has no global `File`.** `entry instanceof File` throws in server
  actions. Duck-type instead (see `selectFiles` in `web/app/actions.ts`).
- **`localhost` resolves to `::1` in Node's fetch** while the API binds IPv4. Use
  `127.0.0.1` for `API_INTERNAL_URL` outside Docker, or it fails with
  `ECONNREFUSED` even though curl works.
- **Prisma needs Debian, not Alpine.** `node:20-alpine` produces "could not parse
  schema engine response" from the musl OpenSSL builds. The API image is
  `node:20-slim` with `openssl` installed; keep it that way.
- **Don't add `prisma/**` to `api/tsconfig.json`'s `include`** — it shifts the
  build root and `dist/main.js` becomes `dist/src/main.js`. `ts-node` runs the seed
  fine without it.
- **Browsers don't send auth headers on `<img src>`.** Photos go through the Next
  proxy route, not straight at the API.

## Testing

There is **no automated test suite** — verification has been by hand. If you touch
scoping, assignment or status transitions, re-run the checks in the README, and
prefer adding a real test over repeating them manually.

## Pull requests

Bug fixes and features go on a branch and land through a PR — see
`.claude/skills/github-commit/SKILL.md`. Never commit straight to `main`.

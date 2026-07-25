# LeadFlow — Backend

A JSON API and permission-aware backend for a small sales team's lead management workflow.
Public capture form intake, role-based internal access (admin/member), full lead lifecycle
(status pipeline, assignment, notes, activity trail), pagination/filtering, and an automated
test suite that runs against a real Postgres database.

> This directory is the **backend only**. The frontend (React) is being built separately
> in Lovable — see the prompt handed off alongside this package. This README documents the
> API surface the frontend integrates against.

## Stack

- **Runtime**: Node.js 22, TypeScript, Express 4
- **Database**: PostgreSQL 16, via Drizzle ORM (pure TypeScript, no native binary — chosen
  specifically to avoid the Prisma query-engine binary download that broke in restricted
  network environments during development)
- **Auth**: JWT stored in an httpOnly cookie, plus a double-submit CSRF cookie/header pair
- **Validation**: Zod schemas on every mutating endpoint
- **Tests**: Vitest + Supertest, run against a real (not mocked) Postgres test database

## Architecture & data model

```
users        id, name, email (unique), password_hash, role[admin|member], active, created_at
leads        id, name, email, phone, company, source, message, status, assigned_to_id (FK users),
             created_by_id (FK users), created_at, updated_at
notes        id, lead_id (FK leads, cascade), author_id (FK users), body, created_at
activities   id, lead_id (FK leads, cascade), actor_id (FK users), type, metadata (json text),
             created_at
```

- `leads.status` is a Postgres enum: `new → contacted → qualified → proposal → won`, with
  `lost` reachable from any active stage. Transitions are enforced server-side
  (`src/lib/validation.ts#STATUS_TRANSITIONS`) — you cannot jump stages or leave a closed
  (`won`/`lost`) lead.
- `activities` is **append-only** — nothing in the codebase updates or deletes a row in this
  table. Every mutation (`LEAD_CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `NOTE_ADDED`,
  `FIELDS_UPDATED`) writes one entry, giving each lead a full audit trail.
- Indexes on `leads.status`, `leads.assigned_to_id`, `leads.created_at`, and `notes.lead_id`
  support the list/filter/detail query patterns the API actually uses.

## Permission model

| Action                          | Public | Member                          | Admin |
|----------------------------------|:------:|:--------------------------------:|:-----:|
| Submit capture form               | ✅     | —                                 | —     |
| View/list leads                   | —      | only leads assigned to them, or unassigned | all |
| Edit lead fields, add notes, change status | — | only leads assigned to them, or unassigned | all |
| Reassign a lead                   | —      | ❌                                | ✅    |
| Create a user                     | —      | ❌                                | ✅    |
| List users                        | —      | ✅ (read-only, for display)       | ✅    |

Enforcement happens **in the route handlers and SQL `WHERE` clauses**, not just in the UI —
a member's `GET /api/leads` query is filtered at the database level, and a member calling
`GET /api/leads/:id` for a teammate's lead gets a real `403`, not a redacted `200`. See
`src/routes/leads.ts` (`visibilityFilter`, `assertCanAccessLead`) and
`src/__tests__/auth.test.ts` for the tests that pin this down.

### Security guardrails implemented

- Passwords hashed with bcrypt (cost 12), never logged or returned by any endpoint
- JWT in an `httpOnly`, `sameSite=lax` cookie (`secure` in production) — inaccessible to
  client-side JS, mitigating XSS token theft
- Double-submit CSRF: a separate, JS-readable cookie whose value must be echoed in an
  `x-csrf-token` header on every state-changing request; GET/HEAD/OPTIONS are exempt
- Rate limiting: 5/min per IP on the public capture form, 10/15min on login, 120/min general
- `helmet` security headers, strict CORS with credentials scoped to `CLIENT_ORIGIN`
- Zod validation on every request body/query — malformed input never reaches the database
- Generic "Invalid email or password" on login regardless of whether the email exists, to
  avoid user enumeration
- Honeypot field on the public form to silently drop unsophisticated bot submissions
  without leaking a validation error that would help a bot detect it

## Getting started

```bash
cd server
cp .env.example .env        # then edit DATABASE_URL / JWT_SECRET as needed
npm install
npm run db:generate         # only needed if you change src/db/schema.ts
npm run db:migrate          # applies drizzle/*.sql to your database
npm run db:seed             # creates one admin + one member account, plus a sample lead
npm run dev                 # starts the API on http://localhost:4000
```

Seeded credentials (override via env vars — see `.env.example`):

| Role   | Email                | Password       |
|--------|-----------------------|----------------|
| admin  | admin@leadflow.dev    | Admin#12345    |
| member | member@leadflow.dev   | Member#12345   |

### Running tests

Tests run against a **real Postgres database**, not mocks — create one and point
`DATABASE_URL` at it:

```bash
createdb leadflow_test    # or: psql -c "CREATE DATABASE leadflow_test;"
# server/.env.test already points at leadflow_test on localhost — edit if needed
npm test
```

The suite covers: unauthenticated access blocked, wrong-password rejection, CSRF
enforcement (missing and mismatched tokens), role boundaries (member blocked from
reassignment and user creation), cross-member data isolation (member A cannot see or act
on member B's lead, at both the list and detail endpoints), the public-capture-to-lead
flow (including honeypot handling and the 5/min rate limit), and the full internal
lifecycle flow (create → assign → note → status transitions, including a rejected
invalid transition → activity trail), plus pagination and filtering.

## API reference

Base path: `/api`. All responses are JSON. Authenticated routes read the session from the
`leadflow_token` cookie — there is no `Authorization: Bearer` mode.

**Every non-GET request from a logged-in session must include the `x-csrf-token` header**,
set to the current value of the (non-httpOnly) `leadflow_csrf` cookie.

### Response shapes

Success: `{ "data": ... }`, list endpoints add `{ "data": [...], "pagination": {...} }`.
Error: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`.

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No content (logout) |
| 400 | Validation error / bad request (`VALIDATION_ERROR`, `BAD_REQUEST`) |
| 401 | Not authenticated / bad credentials (`UNAUTHORIZED`) |
| 403 | Authenticated but not permitted (`FORBIDDEN`) — wrong role, cross-member access, or missing/invalid CSRF token |
| 404 | Resource not found (`NOT_FOUND`) |
| 409 | Conflict, e.g. duplicate email (`CONFLICT`) |
| 429 | Rate limited (`RATE_LIMITED`) |
| 500 | Unhandled server error (`INTERNAL_ERROR`) |

### Auth

**`POST /api/auth/login`** — public. Body: `{ email, password }`. Sets the auth + CSRF
cookies on success. Rate limited (10/15min per IP).
→ `200 { data: { user: { id, name, email, role } } }`

**`POST /api/auth/logout`** — clears both cookies. → `204`

**`GET /api/auth/me`** — requires auth. → `200 { data: { user } }`

### Public capture (no auth)

**`POST /api/public/leads`** — rate limited (5/min per IP).
Body: `{ name, email, phone?, company?, message?, website? }` (`website` is a hidden
honeypot field — leave it empty in real forms).
→ `201 { data: { received: true } }` (deliberately does not return the created lead's id
or any internal fields to an unauthenticated caller)

### Leads (auth required)

**`GET /api/leads`** — list, paginated and filtered. Members only ever see leads assigned
to them or unassigned.
Query params: `page` (default 1), `pageSize` (default 20, max 100), `status`,
`assignedToId`, `q` (matches name/email/company), `sort` (`createdAt` \| `-createdAt` \|
`updatedAt` \| `-updatedAt`, default `-createdAt`).
→ `200 { data: [lead...], pagination: { page, pageSize, total, totalPages } }`

**`GET /api/leads/:id`** — full detail including `notes[]` and `activity[]`. `403` if a
member requests a lead assigned to a teammate.

**`PATCH /api/leads/:id`** — update `name`/`email`/`phone`/`company`/`message`. Logs
`FIELDS_UPDATED`.

**`POST /api/leads/:id/assign`** — **admin only**. Body: `{ assignedToId: number | null }`.
Logs `ASSIGNED`.

**`POST /api/leads/:id/status`** — Body: `{ status }`. Enforces the pipeline transition
table; invalid jumps return `400`. Logs `STATUS_CHANGED`.

**`POST /api/leads/:id/notes`** — Body: `{ body }` (1–4000 chars). Logs `NOTE_ADDED`.
→ `201 { data: note }`

### Users

**`GET /api/users`** — any authenticated user. Returns `{ id, name, email, role, active }[]`
(no password data), used to populate assignee dropdowns and display names.

**`POST /api/users`** — **admin only**. Body: `{ name, email, password (min 8 chars), role }`.
→ `201 { data: { id, name, email, role } }`, or `409` if the email is taken.

## Deployment (free tier)

Any Node-hosting free tier with a managed Postgres add-on works (Render, Railway, Fly.io).
Render example:

1. Push this repo to GitHub.
2. Create a Render **PostgreSQL** instance (free tier) — copy its **Internal Database URL**.
3. Create a Render **Web Service** from the repo, root directory `server`.
   - Build command: `npm install && npm run build && npm run db:migrate`
   - Start command: `npm start`
   - Environment: `DATABASE_URL` (from step 2), `JWT_SECRET` (generate a long random
     string), `NODE_ENV=production`, `CLIENT_ORIGIN` (your deployed frontend URL)
4. After the first deploy, run `npm run db:seed` once via Render's shell (or a one-off job)
   to create the admin/member accounts.
5. Deploy the frontend separately (e.g. Vercel/Netlify) with `VITE_API_URL` pointing at the
   Render service URL, and add that frontend origin as `CLIENT_ORIGIN` on the backend.

## Project structure

```
server/
  src/
    app.ts               Express app wiring (middleware, routes, error handler)
    index.ts              Process entrypoint
    db/
      schema.ts           Drizzle table + enum definitions
      client.ts           Postgres connection pool + Drizzle instance
      migrate.ts           Migration runner (npm run db:migrate)
      seed.ts               Demo data seeder (npm run db:seed)
    lib/
      auth.ts               JWT signing/verification, cookie config
      password.ts           bcrypt hashing helpers
      validation.ts        Zod schemas + pipeline transition rules
      activity.ts           Activity-trail logger
      errors.ts             AppError, centralized error handler
    middleware/
      auth.ts               requireAuth, requireRole, csrfProtection
      rateLimit.ts          Public form / login / general API limiters
    routes/
      auth.ts, public.ts, leads.ts, users.ts
    __tests__/
      testUtils.ts          Shared test app/db helpers
      auth.test.ts           Auth + RBAC + isolation tests
      publicCapture.test.ts   Public capture flow tests
      leadLifecycle.test.ts    Full lifecycle + pagination/filtering tests
  drizzle/                 Generated SQL migrations
```

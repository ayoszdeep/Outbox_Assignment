# Outbox — Email Scheduler Service & Dashboard

A production-shaped email scheduling service: an API accepts send requests, persists them to
PostgreSQL, schedules them as **BullMQ delayed jobs** in Redis (no cron anywhere), and a
separate worker process sends them through **Ethereal** SMTP under per-sender throttling and
hourly rate limits. A React dashboard sits on top for composing, scheduling and tracking.

Everything survives a restart of the API, the worker, or Redis itself, and no email is ever
sent twice.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Getting started](#getting-started)
5. [Running in Docker](#running-in-docker)
6. [Ethereal Email setup](#ethereal-email-setup)
7. [Demo video](#demo-video)
8. [Demo walkthrough](#demo-walkthrough)
9. [Frontend](#frontend)
10. [API reference](#api-reference)
11. [Scheduling: how it works](#scheduling-how-it-works)
12. [Throughput, rate limiting and concurrency](#throughput-rate-limiting-and-concurrency)
13. [Idempotency and restart safety](#idempotency-and-restart-safety)
14. [Google login](#google-login)
15. [Slack notifications on rate-limit hits](#slack-notifications-on-rate-limit-hits)
16. [Email search (Elasticsearch)](#email-search-elasticsearch)
17. [Live queue dashboard (Bull Board)](#live-queue-dashboard-bull-board)
18. [Database schema](#database-schema)
19. [Features implemented](#features-implemented)
20. [Requirement checklist](#requirement-checklist)
21. [What was verified](#what-was-verified)
22. [Assumptions, shortcuts and trade-offs](#assumptions-shortcuts-and-trade-offs)

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | TypeScript, Express 5 |
| Queue | BullMQ 5 on Redis 7 (ioredis) |
| Database | PostgreSQL 16 with Sequelize 6 + `sequelize-cli` migrations |
| SMTP | Ethereal Email via Nodemailer (a real Ethereal mailbox per sender) |
| Search | Elasticsearch 8 |
| Queue UI | Bull Board (`@bull-board/express`) |
| Auth | Google OAuth through Firebase, verified server-side with Firebase Admin, then an app JWT |
| Alerts | Slack OAuth v2 (`incoming-webhook` scope) |
| Logging | Winston with daily-rotating files and a per-request correlation id |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Redux Toolkit, React Router 7 |
| Infra | Docker Compose for Postgres, Redis and Elasticsearch; a `Dockerfile` that builds the backend image used by both the API and the worker |

---

## Architecture

```text
                 ┌──────────────────────────────┐
  Browser  ──────▶  React dashboard (Vite :3005) │
                 └───────────────┬──────────────┘
                                 │  /api proxied to :3001
                 ┌───────────────▼──────────────────────────────────┐
                 │  Express API  (:3001)                            │
                 │  • auth (Google / email+password) → JWT          │
                 │  • senders, campaigns, email status, search      │
                 │  • Slack OAuth                                   │
                 │  • Bull Board at /admin/queues                   │
                 │  • on boot: ensure ES index + reconcile queue    │
                 └───┬───────────────┬──────────────────┬───────────┘
                     │ writes        │ enqueues         │ indexes
              ┌──────▼──────┐  ┌─────▼──────┐   ┌───────▼────────┐
              │ PostgreSQL  │  │   Redis    │   │ Elasticsearch  │
              │ source of   │  │ BullMQ     │   │ search index   │
              │ truth       │  │ delayed    │   │                │
              │             │  │ jobs +     │   │                │
              │             │  │ counters   │   │                │
              └──────▲──────┘  └─────┬──────┘   └───────▲────────┘
                     │               │ due jobs         │
                 ┌───┴───────────────▼──────────────────┴────────┐
                 │  Worker process (npm run worker)              │
                 │  • concurrency = WORKER_CONCURRENCY           │
                 │  • claims each email, then sends via Ethereal │
                 │  • per-sender min-delay lock                  │
                 │  • per-sender hourly quota (Redis counters)    │
                 │  • over limit → reschedule + Slack alert      │
                 └───────────────────────────────────────────────┘
```

**The API and the worker are separate processes on purpose.** The API owns HTTP only; the
worker owns sending. Either can be restarted or scaled without touching the other, and a slow
SMTP host cannot block incoming requests.

---

## Repository layout

```text
src/
  config/            env config, Postgres, Redis, Winston, Firebase Admin
  controllers/       thin HTTP handlers
  db/
    migrations/      sequelize-cli migrations (the schema source of truth)
    models/          Sequelize models (snake_case columns, camelCase attributes)
  middlewares/       JWT auth, correlation id, error handlers
  processors/        the BullMQ worker: claim → throttle → rate limit → send
  queues/            queue definition
  routers/           /api/v1/* and /api/slack/*
  services/          business logic (campaign, email, sender, slack, search, reconciliation)
  utils/             AES-256-GCM encryption, JWT, typed errors
  workers/           worker entrypoint (npm run worker)
frontend/
  src/
    components/      auth/, compose/, dashboard/, layout/, ui/ (reusable primitives)
    pages/           Login, Signup, Dashboard, Compose, EmailDetail, Settings
    services/        api.ts, authApi.ts, emailApi.ts, slackApi.ts
    store/           Redux Toolkit auth slice
    types/           shared API/prop interfaces
    utils/           lead-file parser (mirrors the backend parser)
docker-compose.yml   Postgres + Redis + Elasticsearch (infrastructure only)
Dockerfile           backend image; the API and the worker are the same image, different command
.dockerignore        keeps node_modules/, frontend/, logs/ and .env out of the build context
```

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker Desktop
- A Firebase project with **Google** sign-in enabled (for login)
- Optional: a Slack app with the `incoming-webhook` scope (for rate-limit alerts)

### 1. Configure environment

```bash
cp .env.example .env               # backend
cp frontend/.env.example frontend/.env.local   # frontend Firebase web config
```

Fill in `.env`. The values that matter most:

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | API port | `3001` |
| `FRONTEND_URL` | Where to send the browser back after Slack OAuth | `http://localhost:3005` |
| `DB_*` | PostgreSQL connection | see `.env.example` |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection | `127.0.0.1:6390` |
| `ELASTICSEARCH_URL` | Elasticsearch node | `http://127.0.0.1:9200` |
| `WORKER_CONCURRENCY` | Jobs processed in parallel by one worker | `3` |
| `MIN_DELAY_MS` | Minimum gap between two sends for the same sender | `2000` |
| `MAX_EMAILS_PER_HOUR` | Hard ceiling on emails per sender per hour | `100` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | App session token | — / `7d` |
| `SMTP_ENCRYPTION_KEY` | Key for AES-256-GCM encryption of stored SMTP passwords | — |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin service account | — |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` | Slack app credentials | — |

Nothing above is hardcoded in the source: every limit is read through `src/config/index.ts`.

> Ethereal needs no configuration. Each sender gets its own real Ethereal mailbox, created
> on demand through `nodemailer.createTestAccount()`.

### 2. Start infrastructure

```bash
docker compose up -d
docker compose ps                       # all three should be healthy
docker exec redis redis-cli ping        # PONG
curl http://127.0.0.1:9200              # Elasticsearch info
```

Compose maps Postgres to **5433**, Redis to **6390** and Elasticsearch to **9200** on the
host, so it will not clash with local installs on the default ports.

Compose starts the three backing services only. To run the API and the worker as containers too,
see [Running in Docker](#running-in-docker); the steps below run them on the host.

### 3. Install and migrate

```bash
npm install
npm run db:migrate
```

### 4. Run the three processes

Each in its own terminal:

```bash
npm run dev                      # 1. API        → http://localhost:3001
npm run worker                   # 2. sender     → "Worker started / Waiting for jobs..."
cd frontend && npm install && npm run dev    # 3. dashboard → http://localhost:3005
```

Useful URLs:

```text
Dashboard    http://localhost:3005
API health   http://localhost:3001/api/v1/ping/health
Bull Board   http://localhost:3001/admin/queues
```

The frontend calls the API through Vite's `/api` proxy (`frontend/vite.config.ts`), so there
is no CORS configuration in development. If you deploy the two on different origins, add a
CORS middleware to `src/server.ts` or put both behind one reverse proxy.

---

## Running in Docker

Two separate things are containerised, and it is worth being clear about which is which:

| File | Covers | Started by |
| --- | --- | --- |
| `docker-compose.yml` | Postgres 16, Redis 7, Elasticsearch 8 — **infrastructure only** | `docker compose up -d` |
| `Dockerfile` | The **backend image**. The API and the worker are the same image run with different commands | `docker build` + `docker run` (below) |

The frontend is not containerised — it is excluded in `.dockerignore` and runs on the host with
`npm run dev`. `docker compose up` therefore starts the three backing services and **not** the
app; the API and worker containers are started explicitly as shown below.

### 1. Build the image

```bash
docker build -t outbox-api:local .
```

### 2. Point the container at the Compose services

Inside the Compose network the app reaches the services by **service name on their internal
ports**, not the host-mapped ones. This is the one thing that catches people out: `.env` holds
the host values (`127.0.0.1:5433`, `127.0.0.1:6390`), which are wrong from inside a container,
so they are overridden on the command line.

| From the host | From inside the network |
| --- | --- |
| `DB_HOST=127.0.0.1`, `DB_PORT=5433` | `DB_HOST=postgres`, `DB_PORT=5432` |
| `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6390` | `REDIS_HOST=redis`, `REDIS_PORT=6379` |
| `ELASTICSEARCH_URL=http://127.0.0.1:9200` | `ELASTICSEARCH_URL=http://elasticsearch:9200` |

The network is named after the project folder — `outbox_assignment_default`. Confirm yours with
`docker network ls`.

### 3. Run migrations, the API and the worker

```bash
# Migrations (one-off; the container exits when done)
docker run --rm   --network outbox_assignment_default --env-file .env   -e DB_HOST=postgres -e DB_PORT=5432   outbox-api:local npm run db:migrate

# API  → http://localhost:3001
docker run -d --name outbox-api   --network outbox_assignment_default --env-file .env   -e DB_HOST=postgres -e DB_PORT=5432   -e REDIS_HOST=redis -e REDIS_PORT=6379   -e ELASTICSEARCH_URL=http://elasticsearch:9200   -p 3001:3001   outbox-api:local

# Worker — same image, different command, no port to publish
docker run -d --name outbox-worker   --network outbox_assignment_default --env-file .env   -e DB_HOST=postgres -e DB_PORT=5432   -e REDIS_HOST=redis -e REDIS_PORT=6379   -e ELASTICSEARCH_URL=http://elasticsearch:9200   outbox-api:local npm run worker
```

Check them:

```bash
curl http://localhost:3001/api/v1/ping/health   # OK
docker logs outbox-api        # "PostgreSQL connection established", reconciliation, server up
docker logs outbox-worker     # "Worker started / Waiting for jobs..."
docker rm -f outbox-api outbox-worker           # stop and remove
```

The frontend still runs on the host and reaches the containerised API through the same Vite
`/api` proxy, because the API is published on `localhost:3001` exactly as it is in a local run.

### Why the image is built the way it is

- **No `tsc` build step — the app runs from TypeScript through `ts-node`, as it does locally.**
  `src/` also contains plain `.js` files (the Sequelize models, the migrations and the worker
  entrypoint) and `tsconfig` has `allowJs` off, so a compiled `dist/` would be missing them and
  would crash on first `require`.
- **Dev dependencies are kept in the image on purpose.** `ts-node` and `typescript` run the app
  and `sequelize-cli` runs the migrations, so a `--omit=dev` install would not boot.
- **`python3`, `make` and `g++` are installed before `npm ci`.** `argon2` compiles from source
  whenever no prebuilt binary matches the platform, and without the toolchain the install fails.
- **`TS_NODE_TRANSPILE_ONLY=true`.** Types are checked in development with `npx tsc --noEmit`;
  skipping the check at every container start keeps boot fast and stops a type error from taking
  the service down.
- **`node:20-bookworm-slim`** as the base, matching the Node 20+ requirement.

### Known gap

`docker-compose.yml` does **not** define `api` and `worker` services, so there is no
single-command `docker compose up` that brings up the whole system — the two app containers are
run manually as above. Adding them as two more Compose services (same `build: .`, one with
`command: npm run worker`, both with `depends_on` the healthchecks) is the obvious next step and
would remove the environment overrides, since Compose would inject the service names itself.

---

## Ethereal Email setup

**Nothing to configure, and no credentials to paste.** [Ethereal](https://ethereal.email) is a
fake SMTP service: messages are accepted, never delivered to the real world, and viewable in a
web inbox. This project uses it per sender.

### How it works here

1. When a sender is created — automatically on first login, or through **+ Add Sender** /
   `POST /api/v1/senders` with just a `name` — the backend calls
   `nodemailer.createTestAccount()`. Ethereal returns a brand-new mailbox: host
   `smtp.ethereal.email`, port `587`, and a generated user and password.
2. The connection is verified with `transporter.verify()` before the sender is saved (retried up
   to 3 times), so a sender that exists is a sender that can actually send.
3. The SMTP password is **encrypted with AES-256-GCM** (`SMTP_ENCRYPTION_KEY`) before it goes in
   the database, and decrypted only when a transport is built for a send.
4. Every send logs a preview link in the worker terminal:

   ```text
   Ethereal preview: https://ethereal.email/message/ar97lALEqXPha2R7ar972lz99noLc0D...
   ```

   Open it in a browser to read the exact email that went out — subject, HTML body, headers.

So **multiple senders** each get their own real SMTP mailbox and their own hourly quota, which
is what the per-sender rate limiting is built around. `GET /api/v1/senders` lists the generated
addresses.

### Using a specific Ethereal account instead

If you want a fixed mailbox (for example to log into `ethereal.email` and keep a history),
create one at <https://ethereal.email/create> and pass its credentials when creating the sender:

```http
POST /api/v1/senders
Authorization: Bearer <jwt>

{
  "name": "Marketing",
  "email": "your.account@ethereal.email",
  "smtpHost": "smtp.ethereal.email",
  "smtpPort": 587,
  "smtpUser": "your.account@ethereal.email",
  "smtpPassword": "the-generated-password",
  "hourlyLimit": 50
}
```

Any SMTP provider works the same way — the sender row is just host, port, user and password — but
Ethereal is the default so nothing can ever reach a real inbox by accident.

### Environment variables, in one place

- Backend: copy `.env.example` → `.env`. The table in [Getting started](#getting-started)
  explains every variable; the ones you must fill in yourself are `DB_PASSWORD`, `JWT_SECRET`,
  `SMTP_ENCRYPTION_KEY`, the three `FIREBASE_*` values, and the `SLACK_*` values if you want
  Slack alerts. **No email credentials are needed.**
- Frontend: copy `frontend/.env.example` → `frontend/.env.local` with your Firebase web config.
- `docker-compose.yml` reads `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` and `REDIS_PORT`
  from the same root `.env`, so the containers and the app can never disagree.

---

## Demo video

**Link:** _add your unlisted video link here before submitting_

Max 5 minutes, covering:

| # | Section | Shows |
| --- | --- | --- |
| 1 | Setup & architecture | Docker services healthy, API + worker + frontend running, 30s tour of the flow |
| 2 | Google login | Real Google consent screen → dashboard with name, email and avatar in the header |
| 3 | Compose & schedule | CSV upload with the detected address count, pacing fields, start time, Schedule |
| 4 | Scheduled → Sent | Both tabs, worker log sending, an Ethereal preview of a real email |
| 5 | Restart scenario | Stop the API and worker mid-schedule, restart, future emails still fire at their original times, nothing re-sent |
| 6 | Rate limiting under load | A batch larger than the hourly limit: the excess rescheduled into the next hour window in Bull Board, plus the Slack alert |

---

## Demo walkthrough

1. Open `http://localhost:3005` → **Continue with Google** → the real Google consent screen.
2. You land on the dashboard. The top header shows your name, email and avatar, with Logout.
   A working Ethereal sender is provisioned for the account on first login.
3. **Compose New Email**
   - pick the sender (or **+ Add Sender** to provision another Ethereal mailbox),
   - type recipients and/or **Upload List** a CSV/TXT — the detected address count is shown,
   - write the subject and body,
   - set the delay between emails and the hourly limit,
   - click the clock icon to pick a start time, or just **Send** to start immediately.
4. **Scheduled** tab lists what is queued, with recipient, subject, scheduled time and status.
5. Watch the worker terminal: it prints an `https://ethereal.email/message/...` preview link
   for each delivery. Open one to see the actual email.
6. **Sent** tab lists delivered and failed attempts with the send time.
7. Use the header search box to search across recipient, subject and body (Elasticsearch).
8. `http://localhost:3001/admin/queues` shows the live queue: delayed, active and completed.
9. To watch rate limiting: schedule more emails than the hourly limit you set. The excess move
   to the next hour window instead of failing, and **Settings → Slack** can be connected so a
   message lands in Slack the moment a sender hits its limit.

---

## Frontend

React 19 + TypeScript + Tailwind. Pages are thin; logic lives in `services/` and reusable
pieces in `components/`.

| Route | What it does |
| --- | --- |
| `/login`, `/signup` | Google OAuth button plus email/password, sharing one `authApi` module |
| `/dashboard` | **Scheduled Emails** — recipient, subject, scheduled time, status |
| `/dashboard/sent` | **Sent Emails** — recipient, subject, sent time, status (`sent` / `failed`) |
| `/compose` | Compose + lead upload + pacing + start time, posts to the schedule API |
| `/email/:id` | One email: sender, recipient, body, timestamps, attempts, failure reason |
| `/settings/slack` | Connect / disconnect Slack, connection health and last error |

Details worth calling out:

- **Reusable UI primitives** — `ui/Button` (variants, sizes, built-in spinner), `ui/Input`
  (label + error), `dashboard/StatusBadge` (single source of truth for status wording and
  colour), `layout/UserMenu`, `auth/GoogleButton`.
- **Typed end to end** — `types/email.ts` and `types/auth.ts` describe API responses and props;
  no `any` in the data path.
- **Loading and empty states** on every list and on the detail page; errors surface as inline
  messages or toasts rather than silent failures.
- **Lead counting happens with the same rules as the backend** — `utils/csvParser.ts` mirrors
  `parseLeadEmails` in `src/services/campaign.service.ts`, so the "42 email addresses detected"
  in Compose is exactly how many emails get scheduled. Typed recipients and an uploaded file
  are merged into one list, header rows and extra columns are ignored, duplicates collapsed.
- **Protected routes** — `AppLayout` redirects to `/login` without a session; the session lives
  in Redux and is rehydrated from `localStorage`.

Scripts: `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint),
`npm run preview`.

---

## API reference

All `/api/v1` routes except `auth/*` and `ping/*` require `Authorization: Bearer <jwt>`.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | `{ name, email, password }`, password ≥ 8 chars |
| `POST` | `/api/v1/auth/signin` | `{ email, password }` → user + JWT |
| `POST` | `/api/v1/auth/firebase` | `{ idToken }` from Google sign-in → user + JWT |
| `GET` | `/api/v1/auth/me` | Decoded session |

### Senders

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/senders` | `{ name }` alone provisions a fresh Ethereal mailbox; custom SMTP fields are accepted too. Optional `hourlyLimit` (capped by `MAX_EMAILS_PER_HOUR`) |
| `GET` | `/api/v1/senders` | Sender list (never returns SMTP passwords) |
| `DELETE` | `/api/v1/senders/:id` | Scoped to the signed-in user |

### Scheduling

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/campaigns/schedule` | `multipart/form-data`: `senderId`, `subject`, `body`, `startTime` (ISO), `file` (CSV/TXT leads), optional `delayMs`, `hourlyLimit` → `{ campaignId, leadCount, emailCount, jobsCreated }` |
| `POST` | `/api/v1/emails/schedule` | JSON single email: `recipient`, `subject`, `body`, `senderId`, `scheduledAt` |

### Status and search

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/emails?status=scheduled&page=1&limit=20` | `status` ∈ `scheduled` \| `processing` \| `sent` \| `failed`; paginated |
| `GET` | `/api/v1/emails/search?q=internship` | Elasticsearch full-text over recipient, subject, body |
| `GET` | `/api/v1/emails/:id` | One email with its sender joined, including `errorMessage` |

### Slack

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/slack/connect-url` | Returns the authorize URL as JSON (used by the dashboard) |
| `GET` | `/api/slack/connect` | Same, as a 302 redirect |
| `GET` | `/api/slack/callback` | OAuth redirect target; redirects back to `FRONTEND_URL/settings/slack` |
| `GET` | `/api/slack/status` | `connected`, `status`, `lastError`, `lastErrorAt` |
| `POST` | `/api/slack/disconnect` | Removes the connection |

### Ops

```text
GET /api/v1/ping            {"message":"Pong!"}
GET /api/v1/ping/health     OK
GET /admin/queues           Bull Board UI
```

---

## Scheduling: how it works

Scheduling one campaign:

1. `POST /api/v1/campaigns/schedule` parses the lead file and opens a **transaction**.
2. One `Campaign` row plus one `Email` row per recipient are inserted, each with
   `sequenceNumber` and `scheduledAt = startTime + (index × delayMs)`.
3. For every email a BullMQ job is added with `jobId = email-<id>` and
   `delay = scheduledAt - now`, and the job id is written back to `Emails.bull_job_id`.
4. The transaction commits, then every email is indexed into Elasticsearch.

The worker is woken by Redis when a job's delay elapses — nothing polls, and nothing sweeps
the table on a timer.

### No cron, anywhere

- No OS cron, no `crontab`.
- No `node-cron`, no `agenda`, no `node-schedule`, no `setInterval` scheduling loop.
- `grep -ri "cron" src/ frontend/src/` returns nothing.

Timing comes entirely from **BullMQ delayed jobs**, which keep their due times in a Redis
sorted set.

---

## Throughput, rate limiting and concurrency

### Worker concurrency

The worker is constructed with `concurrency: serverConfig.WORKER_CONCURRENCY` (default `3`).
Parallel jobs are safe because each one first **claims** its email with a conditional update:

```sql
UPDATE "Emails" SET status = 'processing', attempts = attempts + 1
WHERE id = :id AND status = 'scheduled'
```

Only the worker whose update affects exactly one row proceeds; everyone else returns early.
That single line is what makes a duplicate, redelivered or replayed job a no-op.

### Minimum delay between sends: **2 seconds**

`MIN_DELAY_MS=2000`, so **one sender sends at most one email every 2 seconds.** It is enforced
with a per-sender Redis lock (`throttle:sender:<senderId>:lock`) held for the SMTP send plus a
`MIN_DELAY_MS` cooldown, then released.

A job that cannot take the lock does **not** block its worker slot. It puts the email back to
`scheduled` and re-queues itself as a new delayed job `MIN_DELAY_MS + jitter` later; the jitter
stops a burst from re-colliding in lockstep. The lock's TTL (`max(MIN_DELAY_MS × 2, 30s)`) is
only a crash guard so a dead worker cannot freeze a sender forever — it is deliberately not
used as the retry interval.

The limit is **per sender**, not global: with three senders the service sends roughly three
emails every two seconds.

### Emails per hour

Per-sender, Redis-backed, and safe across multiple workers and instances. The counter key is
`rate:<senderId>:<YYYYMMDDHH>` (UTC hour window, TTL 1 hour). There is no in-memory counting.

The effective limit for an email is the strictest of the three:

```text
min(campaign.hourlyLimit, sender.hourlyLimit, MAX_EMAILS_PER_HOUR)
```

A slot is reserved with a single Lua script, so the check and the increment cannot race:

```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])   -- over limit: roll back, do not consume quota
  return -1
end
return count
```

**Reservations are released when nothing was actually sent** — a throttle bounce or a failed
SMTP attempt calls `releaseRateSlot`. Without that, retries would silently eat the hourly
quota and the service would deliver fewer than the limit every hour.

### When the hourly limit is reached

Jobs are never dropped and never permanently failed. The email is:

1. set back to `status = 'scheduled'`,
2. given a slot from that sender's scheduling cursor (below),
3. re-queued as a new BullMQ delayed job for that time,
4. re-indexed in Elasticsearch so the dashboard shows the new time,
5. and **one** Slack alert is sent per sender per hour window.

### Sender-level ordering

`sequenceNumber` is numbered per campaign, so every campaign starts again at 1. Spacing a
reschedule purely by `nextHour + delayMs × (sequenceNumber - 1)` would hand two different
campaigns on the same sender the **identical** timestamp, and they would then fight over that
sender's send lock.

Slots are allocated from one Redis cursor per sender instead,
`schedule:sender:<id>:cursor`:

```lua
local cursor = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = earliest
if cursor + gap > slot then slot = cursor + gap end   -- never hand out a slot twice
redis.call('SET', KEYS[1], slotStr, 'PX', ttl)
return slotStr
```

`earliest` is still `nextHour + delayMs × (sequenceNumber - 1)`, so a campaign can never be
reordered against itself: its slot n+1 is requested no earlier than its slot n. The cursor then
pushes that slot forward until it sits at least `MIN_DELAY_MS` past whatever the sender already
holds, so two campaigns interleave instead of colliding:

```text
campaign A seq 1,2,3  ->  +0s   +2s   +4s
campaign B seq 1,2,3  ->  +6s   +8s  +10s     (B seq 1 no longer lands on A seq 1)
```

The same allocator handles a send-lock bounce, so concurrent bounces for one sender queue up in
arrival order instead of retrying on top of each other.

### Behaviour with 1000+ emails due at the same time

With `MAX_EMAILS_PER_HOUR=100` and 1000 emails due at once:

- the first 100 reserve a slot and send, spaced `MIN_DELAY_MS` apart per sender;
- the remaining 900 find the counter exhausted and are rescheduled into the next hour window,
  in sequence order, each on its own slot;
- one Slack alert fires on the first rejection in that window;
- the next window sends the next 100, and so on, so the backlog drains at the configured rate
  instead of being dropped;
- rescheduling costs one Redis round trip and a requeue — it never holds a worker slot open,
  so the pool keeps moving.

Redis holds the delayed set, so this schedule survives a restart of both processes.

### Trade-offs

The reasoning behind rescheduling instead of blocking, custom Redis counters instead of BullMQ's
built-in `limiter`, and fixed hour windows instead of a sliding window is collected in
[Assumptions, shortcuts and trade-offs](#assumptions-shortcuts-and-trade-offs).

---

## Idempotency and restart safety

| Risk | Guard |
| --- | --- |
| Two workers pick up the same email | Conditional `scheduled → processing` claim; the loser returns early |
| A job is redelivered after a crash | Same claim, plus an explicit `status === 'sent'` short-circuit |
| Duplicate enqueue of the same email | Deterministic `jobId = email-<id>`; BullMQ ignores a duplicate id |
| API or worker restarts | Delay lives in Redis, not in process memory; future emails fire at their original time |
| Redis volume lost | On boot, `reconcileScheduledEmails()` re-creates a delayed job for every `scheduled` email that has no job behind it |
| Worker killed mid-send | On boot, emails stuck in `processing` for more than 5 minutes with no live job are returned to `scheduled` and re-queued — otherwise the claim could never match them again and they would be stranded |
| Transient SMTP failure | 3 attempts with exponential backoff; the row stays `scheduled` until the final attempt, then becomes `failed` with the error message |
| A sender's SMTP password at rest | AES-256-GCM encrypted with `SMTP_ENCRYPTION_KEY`, decrypted only when building a transport |

Already-sent emails are never re-sent by reconciliation: it only looks at rows that are still
`scheduled`, or `processing` with no live job.

---

## Google login

Real Google OAuth, no mock:

1. The dashboard opens the Google consent screen through Firebase
   (`signInWithPopup` + `GoogleAuthProvider`).
2. The resulting **Google ID token** is posted to `POST /api/v1/auth/firebase`.
3. The backend verifies it with the **Firebase Admin SDK** (`verifyIdToken`) — an unverified or
   expired token is rejected with 401.
4. On first login the user row is created (`auth_provider = firebase-google`, avatar stored) and
   a working Ethereal sender is provisioned for them.
5. The backend issues its own JWT, which every later request carries.

Logout clears both the Firebase session and the local session, so the next Google login shows
the account chooser again instead of silently reusing the old session.

Email + password login also works (Argon2 hashes) for quick testing without Google.

---

## Slack notifications on rate-limit hits

A real OAuth v2 flow, per user:

```text
Settings → Connect Slack
   → GET /api/slack/connect-url   (returns the authorize URL for this user; the state is a
                                   signed JWT, so the callback knows who is connecting)
   → Slack authorize screen       (scope: incoming-webhook — the user picks the channel)
   → GET /api/slack/callback      → stores webhook URL + channel + team for that user
                                  → redirects back to /settings/slack?slack=connected
   → rate limit hit → look up that user's webhook → POST the alert
```

The alert is an actual HTTP POST to the user's Slack webhook at the moment a sender hits its
hourly limit, naming the sender, the limit and how many emails were pushed to the next window.

Slack is treated as a **non-critical** path, so a Slack problem can never cost an email:
`sendRateLimitAlert` returns `{ delivered, reason }` and never throws, and the email is
rescheduled either way.

| Situation | Behaviour |
| --- | --- |
| User never connected Slack | Logged, `reason: not_connected`, email still sends |
| OAuth fails or state expired | Redirect back with the error; **no partial row is written** |
| Server missing Slack config | `503` with a clear message; the dashboard shows a toast |
| Webhook revoked (403/404/410) | Connection marked `invalid`, dashboard prompts a reconnect, email unaffected |
| Slack down or timing out | 8s timeout, logged, email unaffected |
| User reconnects later | `status` returns to `active` and alerts resume with no redeploy |

One alert per sender per hour window, claimed with `SET alert:<senderId>:<hour> NX`, so a
thousand rate-limited jobs produce one message rather than a thousand. A transient failure
releases the claim so a later job can retry; `not_connected` keeps it, to avoid pointless
retries.

---

## Email search (Elasticsearch)

- The index (default `emails`) is created on API boot if missing, with explicit mappings.
- Every email is indexed when it is scheduled, and **re-indexed on every status change** —
  sent, failed, throttled or rate-limit rescheduled — so search results never go stale.
- `GET /api/v1/emails/search?q=...` is a `multi_match` over `recipient`, `subject` and `body`,
  filtered by `userId` so one account can never see another's mail. The dashboard search box
  uses it directly.
- Elasticsearch is **not** on the critical path: indexing failures are logged and swallowed, so
  a dead Elasticsearch degrades search but never stops an email from being scheduled or sent.
  Search itself returns `503` when the cluster is unreachable.

---

## Live queue dashboard (Bull Board)

`http://localhost:3001/admin/queues` serves the real BullMQ queue: delayed jobs with their due
times, active jobs, completed and failed counts, job data and retry controls — useful for
watching a rate-limit reschedule move a job into the next hour.

> It is mounted without auth for local development. Put it behind an admin guard or a private
> network before deploying.

---

## Database schema

Migrations in `src/db/migrations/` are the source of truth (`npm run db:migrate`).

| Table | Purpose |
| --- | --- |
| `Users` | Account, `password_hash` (nullable for Google users), `firebase_uid`, `auth_provider`, `avatar_url` |
| `Senders` | Per-user SMTP identity: host, port, user, **encrypted** password, `hourly_limit` |
| `Campaigns` | One scheduling request: subject, body, `start_time`, `delay_ms`, `hourly_limit` |
| `Emails` | One row per recipient: `sequence_number`, `scheduled_at`, `sent_at`, `status`, `attempts`, `error_message`, unique `bull_job_id` |
| `SlackConnections` | One per user: webhook URL, channel, team, `status`, `last_error`, `last_error_at` |

All foreign keys cascade on delete, so removing a user removes their senders, campaigns and
emails.

---

## Features implemented

### Backend

**Scheduler**
- `POST /api/v1/campaigns/schedule` — CSV/TXT lead list → one `Campaign` + one `Email` row per
  recipient, each enqueued as a BullMQ **delayed job** at `startTime + (index × delayMs)`.
- `POST /api/v1/emails/schedule` — single email at a given `scheduledAt`.
- Tolerant lead parsing: header or no header, one column or many, comma / semicolon / tab, BOM,
  duplicates collapsed.
- Separate worker process (`npm run worker`) consumes due jobs and sends over Ethereal SMTP.
- Multiple senders per user, each with its own auto-provisioned Ethereal mailbox and hourly quota.
- No cron anywhere — all timing comes from BullMQ's Redis-backed delayed set.

**Persistence**
- PostgreSQL is the source of truth (migrations in `src/db/migrations/`); Redis holds the schedule.
- `Emails.bull_job_id` ties every row to its job, so the two stores can always be reconciled.
- On boot: `ensureSearchIndex()` then `reconcileScheduledEmails()`, which re-creates a delayed job
  for any `scheduled` email missing one, and rescues emails stranded in `processing` by a killed
  worker (older than 5 minutes, no live job).
- Restarting the API or the worker changes nothing: future emails still fire at their original
  times, and already-sent emails are never touched.

**Rate limiting**
- Per-sender hourly quota in Redis, key `rate:<senderId>:<YYYYMMDDHH>`, reserved by a single Lua
  script so check-and-increment cannot race across workers or instances.
- Effective limit = `min(campaign.hourlyLimit, sender.hourlyLimit, MAX_EMAILS_PER_HOUR)`.
- Over-limit emails are **rescheduled into the next hour window**, never dropped or failed, and
  given a slot from a per-sender cursor so order is preserved and two campaigns never collide.
- Reservations are rolled back when nothing was actually sent, so retries cannot eat the quota.
- One Slack alert per sender per hour window, delivered to that user's own webhook.

**Concurrency**
- `WORKER_CONCURRENCY` jobs in parallel (default 3).
- Safe in parallel through a conditional `scheduled → processing` claim: exactly one worker wins,
  the rest return early — the same guard that gives idempotency across restarts.
- A per-sender Redis lock enforces `MIN_DELAY_MS` (2s) between sends for one sender, without
  holding a worker slot: a job that cannot take the lock requeues itself with jitter.
- 3 attempts with exponential backoff; the row only becomes `failed` on the final attempt.

**Supporting**
- Real Google OAuth (Firebase popup → Firebase Admin `verifyIdToken` → app JWT) and
  email/password login with Argon2.
- Elasticsearch indexing on create and on **every** status change; search filtered by user.
- Slack OAuth v2 per user, with connection health, disconnect and reconnect.
- Bull Board at `/admin/queues` for live queue visibility.
- SMTP passwords encrypted at rest (AES-256-GCM); Winston logs with a per-request correlation id.
- Dockerised backend: one `Dockerfile` builds the image that runs the API, the worker and the
  migrations, alongside Compose for Postgres, Redis and Elasticsearch
  ([Running in Docker](#running-in-docker)).

### Frontend

**Login**
- Google sign-in on both the login and signup screens, sharing one `authApi` module.
- Email/password as a fallback; signup signs the new account straight in.
- Session in Redux, rehydrated from `localStorage`; `AppLayout` guards every private route.
- Logout clears both the Firebase and the local session.

**Dashboard**
- Top header with the user's name, email, avatar and Logout.
- **Scheduled** and **Sent** tabs, plus a primary **Compose New Email** button.
- Search box across recipient, subject and body, served by Elasticsearch.

**Compose**
- Sender picker with inline **+ Add Sender** (provisions a new Ethereal mailbox).
- Recipients typed as chips and/or a CSV/TXT upload — **the number of detected addresses is shown**,
  counted with the same rules the backend uses, with duplicates and ignored rows called out.
- Subject, rich-text body, delay between emails (seconds), hourly limit.
- Start time: send now, a date/time picker, or quick picks; disabled and labelled while submitting.

**Tables**
- Scheduled: recipient, subject, scheduled time, status.
- Sent: recipient, subject, sent time, status (`sent` / `failed` — failed attempts appear here too).
- Row click opens the detail view: sender, recipient, body, timestamps, attempt count and the
  delivery error when one exists.
- Loading spinners and purpose-written empty states on every list, the detail page and search.

**Code quality**
- Reusable primitives: `ui/Button` (variants, sizes, spinner), `ui/Input`, `StatusBadge`,
  `UserMenu`, `GoogleButton`.
- API access isolated in `services/` (`api`, `authApi`, `emailApi`, `slackApi`); shared interfaces
  in `types/`; no `any` in the data path.
- Settings page for Slack: connect, disconnect, connection health and last error.

---

## Requirement checklist

| Requirement | Where |
| --- | --- |
| Accept email send requests via API | `POST /api/v1/campaigns/schedule`, `POST /api/v1/emails/schedule` |
| Schedule for a specific time | `scheduledAt` → BullMQ `delay` |
| BullMQ + Redis as the persistent scheduler | `src/queues/mailer.queues.ts`, `src/processors/scheduled-email.processor.ts` |
| No cron jobs | No cron library or OS cron; `grep -ri cron src/` is empty |
| Relational DB | PostgreSQL + Sequelize migrations |
| Ethereal SMTP, multiple senders | A real Ethereal mailbox per sender, `src/services/sender.service.ts` |
| Survives restarts, no duplication | Redis delayed set + conditional claim + boot reconciliation |
| Searchable via Elasticsearch | `src/services/email-search.service.ts`, indexed on write and on every status change |
| Live BullMQ dashboard | Bull Board at `/admin/queues` |
| Configurable worker concurrency | `WORKER_CONCURRENCY` |
| Minimum delay between sends | `MIN_DELAY_MS`, 2s default, per-sender Redis lock |
| Emails-per-hour rate limit, per sender, multi-worker safe | Redis Lua counters keyed `rate:<sender>:<hour>` |
| Limits configurable, not hardcoded | All read from `src/config/index.ts` |
| Over-limit jobs delayed, not dropped, order preserved | Per-sender scheduling cursor + requeue |
| Slack OAuth per user + live alert on limit hit | `src/services/slack.service.ts`, `src/routers/slack.router.ts` |
| Slack disconnect/reconnect handled | `status` field, connect/disconnect endpoints, no redeploy needed |
| Real Google OAuth login → dashboard | Firebase popup + Firebase Admin verification |
| Header with name, email, avatar, logout | `frontend/src/components/layout/UserMenu.tsx` |
| Scheduled / Sent tabs + Compose button | `frontend/src/pages/Dashboard.tsx` |
| Compose: subject, body, lead upload with detected count, start time, delay, hourly limit | `frontend/src/components/compose/ComposeForm.tsx` |
| Loading and empty states | `EmailList`, `EmailDetailPage`, `SenderSelect`, `SlackConfig` |
| Reusable components, DRY, typed | `components/ui/`, `services/`, `types/` |

---

## What was verified

Run against the real stack (Docker Postgres + Redis + Elasticsearch, API, worker):

- Signup and login return a JWT, and a working Ethereal sender is provisioned automatically.
- A campaign uploaded as a **multi-column CSV with a header** (`name,email,company`) parsed all
  three addresses and created three delayed jobs.
- Emails were delivered through Ethereal with live preview URLs; `sent_at` and status were
  written back and re-indexed.
- With `hourlyLimit=2` and three emails, two were sent and the third was rescheduled into the
  next hour window, with a Slack attempt logged as `not_connected` and the email untouched.
- With `hourlyLimit=1` and a 60-recipient batch: 1 sent, 59 still scheduled, 8 already moved to
  the next hour window, **0 recipients sent more than once**, 0 emails dropped.
- Killing the API and **flushing Redis entirely**, then restarting: reconciliation reported
  `1 jobs repaired`, the rebuilt job kept its original due time, and already-sent emails were
  not re-sent.
- `GET /api/v1/emails/search?q=...` returned the expected hits with up-to-date statuses;
  `GET /api/v1/emails/:id` returned the joined sender; unknown ids give 404 and missing tokens 401.
- `npx tsc --noEmit` (backend) and `npm run build` (frontend) both pass; `npx oxlint` reports no
  errors.
- The Vite dev server proxies `/api` to the backend correctly.
- `docker build -t outbox-api:local .` completes, and the resulting image was run against the
  Compose services on the `outbox_assignment_default` network: the **API** container connected to
  Postgres, ran reconciliation and answered `/api/v1/ping/health` with `OK`; the **worker**
  container reached Redis and logged `Worker started / Waiting for jobs...`; and
  `npm run db:migrate` in the same image reported the schema already up to date.

Not covered by an automated test: the Slack authorize screen and the live Slack message need a
real Slack workspace, and the Google consent screen needs a real browser session.

---

## Assumptions, shortcuts and trade-offs

### Assumptions

- **One Ethereal mailbox per sender, provisioned on demand.** The brief asks for sending from
  multiple senders through Ethereal, so "sender" is modelled as a first-class row with its own
  SMTP credentials and its own hourly quota, rather than one shared account.
- **Rate limiting is per sender, not global.** A global cap would make "multiple senders"
  meaningless under load. `MAX_EMAILS_PER_HOUR` still acts as a hard ceiling that no
  per-sender or per-campaign value can exceed.
- **Hour windows are UTC.** Counter keys are `rate:<senderId>:<YYYYMMDDHH>` in UTC so behaviour
  does not shift with the server's timezone; times shown in the dashboard are local.
- **Google login via Firebase counts as "real Google OAuth".** The consent screen is Google's
  own, and the ID token is verified server-side with the Firebase Admin SDK — nothing is mocked.
  Firebase saves hand-rolling the token exchange and refresh.
- **Slack alerts use incoming webhooks** rather than `chat.postMessage`. The user chooses the
  destination channel on Slack's own authorize screen, so no channel ID has to be configured
  server-side and the app needs only one scope.
- **One campaign never mails the same address twice**, so duplicates in a lead list are collapsed
  at parse time.
- **The email body is HTML the signed-in user wrote themselves**, so it is rendered as HTML in
  the detail view and sent as HTML. A multi-tenant product would sanitise it server-side.

### Shortcuts

- **No automated test suite.** Verification was done end to end by hand against the real stack
  (see [What was verified](#what-was-verified)). Unit tests around the rate limiter, the slot
  allocator and the lead parser would be the first thing to add.
- **Bull Board is unauthenticated.** Fine locally, but it must sit behind an admin guard or a
  private network before any public deployment.
- **No CORS middleware.** Development goes through Vite's `/api` proxy, so it is not needed; a
  split deployment would need `cors` configured in `src/server.ts`.
- **Offset-based pagination**, which is fine at this scale but drifts under heavy concurrent
  inserts. Keyset pagination would be the next step.
- **Templating is minimal** — the same subject and body go to every recipient in a campaign.
  There is no `{{firstName}}` merge-field substitution, so extra CSV columns are parsed for
  addresses and otherwise ignored.
- **No unsubscribe, bounce handling or open tracking.** Out of scope for the brief, and Ethereal
  cannot report bounces anyway.

### Trade-offs

- **Reschedule instead of blocking.** Bouncing a throttled job costs an extra Redis round trip
  and a requeue, but it keeps worker slots free. Holding the slot and sleeping was the earlier
  design: it starved the pool and tripped BullMQ's stalled-job timeout under load.
- **Custom Redis counters instead of BullMQ's `limiter`.** BullMQ's limiter is per queue, so it
  cannot express "per sender per hour", and it cannot tell us the exact moment a sender was
  rejected — which is what the Slack alert needs. The cost is that this logic is ours to maintain.
- **Fixed hour windows over a sliding window.** A fixed window allows up to 2× the limit across a
  window boundary (two adjacent half-hours). A sliding window would smooth that out but needs a
  timestamp stored per send; the fixed window is far cheaper and is what the brief describes.
- **At-least-once delivery.** If a process dies in the gap between a successful SMTP handshake and
  the `status = 'sent'` write, reconciliation retries that email after 5 minutes. Exactly-once
  would need a provider-side idempotency key, which Ethereal does not offer. The 5-minute window
  is the deliberate trade: long enough never to steal a job from a live worker, short enough that
  a crashed send is not stranded.
- **Separate API and worker processes** mean two terminals in development, in exchange for being
  able to restart or scale either independently — and a slow SMTP host never blocks HTTP.
- **Per-sender locking** means a slow SMTP host slows only that sender, not the whole queue.
- **Single Redis.** Multiple workers are safe against each other, but Redis itself is a single
  point of failure in this setup; the boot reconciliation is what limits the damage if it is lost.

---

## Stopping everything

```bash
# Ctrl+C the API, worker and frontend, then:
docker compose stop        # keeps your data
docker compose down -v     # deletes Postgres, Redis and Elasticsearch volumes
```

If you ran the API and worker as containers instead of on the host, remove those first — they are
not part of Compose:

```bash
docker rm -f outbox-api outbox-worker
```

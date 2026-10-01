# Notification Service

Backend email scheduling service built with Express, TypeScript, PostgreSQL, Sequelize, BullMQ, Redis, Nodemailer/Ethereal, Elasticsearch, Firebase Admin, Slack OAuth, and Bull Board.

## Requirements

- Node.js 20+
- Docker Desktop
- Firebase project for Google sign-in
- Optional Slack app credentials for OAuth alerts

## Configure `.env`

Create `.env` in the project root. Keep it out of Git and never commit private keys.

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Email_Scheduler
DB_USER=postgres
DB_PASSWORD=ayosz2004
REDIS_HOST=127.0.0.1
REDIS_PORT=6390
ELASTICSEARCH_URL=http://127.0.0.1:9200
ELASTICSEARCH_INDEX=emails
WORKER_CONCURRENCY=3
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100
```

Firebase Admin also requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Slack alerts require `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`.

## Start Infrastructure

On a clean machine:

```powershell
docker compose up -d
docker compose ps
```

The Compose file starts PostgreSQL, Redis, and Elasticsearch. If Redis or Elasticsearch are already running outside Compose, do not start duplicate containers on the same ports.

```powershell
docker exec redis redis-cli ping
(Invoke-WebRequest http://127.0.0.1:9200).Content
```

Redis should return `PONG`.

## Install and Migrate

```powershell
npm install
npm run db:migrate
npx tsc --noEmit
```

## Start the Application

Use two terminals. The API and worker are intentionally separate processes.

### Terminal 1: API

```powershell
npm run dev
```

### Terminal 2: Worker

```powershell
npm run worker
```

Expected worker output:

```text
Worker started
Waiting for jobs...
```

## Useful URLs

```text
Health:      http://127.0.0.1:3001/api/v1/ping/health
Bull Board:  http://127.0.0.1:3001/admin/queues
Slack OAuth: http://127.0.0.1:3001/api/slack/connect
```

The API is mounted under `/api/v1`.

## Main API Flow

1. Firebase Google sign-in produces a Firebase ID token.
2. Exchange it at `POST /api/v1/auth/firebase`.
3. Use the returned backend JWT as `Authorization: Bearer <token>`.
4. Create one or more senders with `POST /api/v1/senders`.
5. Schedule one email with `POST /api/v1/emails/schedule` or a CSV campaign with `POST /api/v1/campaigns/schedule`.
6. The worker consumes BullMQ delayed jobs and sends through the selected SMTP/Ethereal sender.

Email status APIs:

```text
GET /api/v1/emails?status=scheduled
GET /api/v1/emails?status=sent&page=1&limit=20
GET /api/v1/emails?status=failed
GET /api/v1/emails/search?q=internship
```

## Throughput, Rate Limiting and Concurrency

All limits are read from the environment through `src/config/index.ts`. Nothing is hardcoded.

| Variable | Meaning | Default |
| --- | --- | --- |
| `WORKER_CONCURRENCY` | Jobs the BullMQ worker processes in parallel | `3` |
| `MIN_DELAY_MS` | Minimum gap between two sends for the same sender | `2000` |
| `MAX_EMAILS_PER_HOUR` | Hard ceiling on emails per sender per hour | `100` |

### Worker concurrency

The worker is created with `concurrency: serverConfig.WORKER_CONCURRENCY`. Parallel jobs are
safe because every job claims its email with a conditional update before doing any work:

```sql
UPDATE "Emails" SET status = 'processing' WHERE id = :id AND status = 'scheduled'
```

Only the worker whose update affects one row proceeds; the rest return early. That makes a
duplicate or redelivered job a no-op, which is also what protects us across restarts.

### Minimum delay between sends: 2 seconds

`MIN_DELAY_MS=2000`, so **a single sender sends at most one email every 2 seconds.** It is
enforced with a per-sender Redis lock (`throttle:sender:<senderId>:lock`) that is held for the
duration of the SMTP send plus a `MIN_DELAY_MS` cooldown, then released.

A job that cannot get the lock does **not** block its worker slot. It puts the email back to
`scheduled` and re-queues itself as a new delayed job `MIN_DELAY_MS + jitter` later. The jitter
stops a burst from re-colliding in lockstep. The lock's TTL (`max(MIN_DELAY_MS * 2, 30s)`) is
only a crash guard so a dead worker cannot freeze a sender forever, and is deliberately not
used as the retry interval.

The limit is per sender, not global: with three senders the service sends roughly three emails
every two seconds.

### Emails per hour

Per-sender, Redis-backed, and safe across multiple workers and instances. The counter key is
`rate:<senderId>:<YYYYMMDDHH>` (UTC hour window, TTL 1 hour). There is no in-memory counting.

The effective limit for an email is the strictest of the three:

```text
min(campaign.hourlyLimit, sender.hourlyLimit, MAX_EMAILS_PER_HOUR)
```

A slot is reserved with a single Lua script so that the check and the increment cannot race:

```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])   -- over limit: roll back, do not consume quota
  return -1
end
return count
```

**Reservations are released when nothing was actually sent** - a throttle bounce or a failed
SMTP attempt calls `releaseRateSlot`. Without that, retries would silently eat the hourly
quota and the service would deliver fewer than `MAX_EMAILS_PER_HOUR` per hour.

### When the hourly limit is reached

Jobs are never dropped and never permanently failed. The email is:

1. set back to `status = 'scheduled'`,
2. given a slot from that sender's scheduling cursor (see below),
3. re-queued as a new BullMQ delayed job for that time,
4. re-indexed in Elasticsearch so the dashboard reflects the new time.

One Slack alert is sent per sender per hour window, claimed with `alert:<senderId>:<hour> NX`
so that a thousand rate-limited jobs produce one message, not a thousand. A transient Slack
failure releases the claim so a later job can retry; `not_connected` keeps it, to avoid
pointless retries.

### Sender-level ordering

`sequenceNumber` is numbered per campaign, so every campaign starts again at 1. Spacing a
reschedule purely by `nextHour + delayMs * (sequenceNumber - 1)` would therefore hand two
different campaigns on the same sender the **identical** timestamp, and they would then fight
over that sender's send lock.

Slots are allocated from one Redis cursor per sender instead, `schedule:sender:<id>:cursor`:

```lua
local cursor = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = earliest
if cursor + gap > slot then slot = cursor + gap end   -- never hand out a slot twice
redis.call('SET', KEYS[1], slot, 'PX', ttl)
return slot
```

`earliest` is still `nextHour + delayMs * (sequenceNumber - 1)`, so a campaign can never be
reordered against itself: its slot n+1 is requested no earlier than its slot n. The cursor then
pushes that slot forward until it sits at least `MIN_DELAY_MS` past whatever the sender already
holds, so two campaigns interleave instead of colliding:

```text
campaign A seq 1,2,3  ->  +0s   +2s   +4s
campaign B seq 1,2,3  ->  +6s   +8s  +10s     (B seq 1 no longer lands on A seq 1)
```

The same allocator handles a send-lock bounce, so concurrent bounces for one sender queue up in
arrival order rather than retrying on top of each other.

### Behaviour with 1000+ emails scheduled for the same time

With `MAX_EMAILS_PER_HOUR=100` and 1000 emails due at once:

- the first 100 reserve a slot and send, spaced `MIN_DELAY_MS` apart per sender;
- the remaining 900 find the counter exhausted, and are rescheduled into the next hour window
  in sequence order;
- one Slack alert fires on the first rejection of that hour;
- the next window sends the next 100, and so on, so the backlog drains at the configured rate
  instead of being dropped.

Redis holds the delayed set, so this schedule survives a restart of both the API and the
worker. On boot `reconcileScheduledEmails()` re-creates a delayed job for any email still
`scheduled` in the database that has no job in Redis, which covers a lost Redis volume.

### Trade-offs

- **Reschedule instead of blocking.** Bouncing a throttled job costs an extra Redis round trip
  and a requeue, but it keeps worker slots free. Holding the slot and sleeping was the earlier
  design and it starved the worker pool and tripped BullMQ's stalled-job timeout under load.
- **Custom Redis counters instead of BullMQ's `limiter`.** BullMQ's limiter is per queue, not
  per sender, and cannot express "per sender per hour" or notify Slack on the exact rejection.
  The cost is that the logic is ours to maintain.
- **Counter rollback over a sliding window.** Fixed hour windows allow a burst across a window
  boundary (up to 2x the limit over two adjacent half-hours). A sliding window would smooth
  that out at the cost of storing a timestamp per send; the fixed window is what the brief asks
  for and is far cheaper.
- **Per-sender locking means a slow SMTP host slows only that sender,** not the whole queue.

### No cron anywhere

Scheduling is entirely BullMQ delayed jobs. There is no `node-cron`, no `agenda`, no
`crontab`, and no polling loop - `grep -ri "cron" src/` returns nothing.

## Slack Alerts (optional integration)

Slack is a **non-critical** path. Email scheduling is the critical path, so a Slack problem is
always logged and swallowed - `sendRateLimitAlert` returns `{ delivered, reason }` and never
throws. The email is rescheduled either way.

Connect flow:

```text
GET /api/slack/connect  ->  Slack authorize  ->  GET /api/slack/callback
                                                       |
                                         stores token + channel per user
                                                       |
                                    rate limit hit -> look up user's connection -> post
```

The authorize request asks only for the `incoming-webhook` scope, so the user picks the
target channel during authorization and no channel has to be configured by hand. The
callback stores the webhook URL, the chosen `channel_id` and the `team_id` Slack returns,
and alerts are plain HTTP POSTs to that webhook.

Handled failures:

| Situation | Behaviour |
| --- | --- |
| User never connected Slack | Logged, `reason: not_connected`, email still sends |
| OAuth fails or state expired | `400` with the Slack error; **no partial row is written** |
| Server missing Slack config | `503` with a clear message |
| Token revoked / invalid | Connection marked `invalid`, email unaffected |
| Channel not found / archived | Token kept, error recorded, email unaffected |
| Slack down or timing out | 8s timeout, logged, email unaffected |
| User reconnects later | `status` resets to `active`; alerts resume with no redeploy |

`GET /api/slack/status` reports `connected`, `status`, and the `lastError` / `lastErrorAt` of
the most recent failure so a dashboard can prompt a reconnect.

Endpoints:

```text
GET  /api/slack/connect      Start OAuth (auth required)
GET  /api/slack/callback     OAuth redirect target
GET  /api/slack/status       Connection health
POST /api/slack/disconnect   Remove the connection
```

## Stop Services

Stop the API and worker with `Ctrl+C`. Stop Compose services without deleting volumes:

```powershell
docker compose stop
```

Do not run `docker compose down -v` unless you intentionally want to delete PostgreSQL, Redis, and Elasticsearch data.

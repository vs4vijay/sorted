# Deployment — Sorted

Sorted deploys to **Render** from a single [`render.yaml`](./render.yaml) blueprint. One repo push creates three managed resources: a Next.js web service, a background worker for the job queue, and a PostgreSQL database. No Docker, no separate queue broker, no multi-provider wiring.

---

## 1. What gets deployed

| Resource | Type | Runs | Purpose |
|---|---|---|---|
| `sorted-web` | Web service | `next start` (Next.js production server) | The app: pages, API routes, health/readiness checks |
| `sorted-worker` | Background worker | `bun run start:worker` (`src/lib/worker.ts`) | Drains the job queue: claims `pending` jobs with `SKIP LOCKED`, executes registered tasks (`src/workers/tasks/`), retries on failure |
| `sorted-db` | Managed PostgreSQL | Render-hosted Postgres | Single source of truth for app data, the job queue, and audit events |

All three share **one Postgres**. The queue lives in the `jobs` table — there is no Redis or external queue, by design ("Postgres-for-everything").

```
GitHub repo (main)
   │  push → auto-deploy
   ▼
render.yaml blueprint
   ├── sorted-web      (HTTP, port $PORT)
   ├── sorted-worker   (long-running queue consumer)
   └── sorted-db       (managed PostgreSQL)
          ▲ DATABASE_URL injected into both services
```

## 2. How the deploy works

- **Bun runs natively on Render.** The blueprint uses `runtime: node` — Render's JS/TS native runtime preinstalls Bun alongside Node, so build/start commands are plain `bun …` commands. No Dockerfile exists or is needed.
- **Build phase** (per service, from `render.yaml`):
  - Web: `bun install --frozen-lockfile && bun run db:generate && bun run build`
  - Worker: `bun install --frozen-lockfile && bun run db:generate`
- **Schema migration happens before traffic.** The web service's `preDeployCommand` runs `bun run db:deploy` (`prisma migrate deploy`), which applies any not-yet-applied migrations under `prisma/migrations/`. It is idempotent and Prisma serializes it with an advisory lock, so concurrent deploys are safe.
- **Database wiring is automatic.** `DATABASE_URL` is injected from the `sorted-db` resource via `fromDatabase: connectionString` — you never copy a connection string by hand.
- **Port.** Render injects `$PORT`; the web service runs `next start -p ${PORT:-7070}` so it listens on Render's port and still defaults to 7070 locally.
- **Health check.** `healthCheckPath: /api/ready` — the readiness route runs `SELECT 1` against Postgres and returns 503 when the database is unreachable, so Render restarts a broken instance instead of serving one.
- **Environment.** `NODE_ENV=production`, `APP_ENV=production`, `LOG_LEVEL=info` are set by the blueprint. Validation lives in `src/lib/env.ts` — the app refuses to boot on an invalid environment.

### Database mode switch

`src/lib/db.ts` chooses the backend by the `DATABASE_URL` prefix:

- `file:…` → **PGlite** (local development only; a filesystem-backed embedded Postgres)
- `postgresql://…` → **real PostgreSQL** through raw parameterized SQL

Production always uses the `postgresql://…` form. All application queries go through `executeQuery()` with `$1`-style parameters; Prisma is used only for schema description and client generation, never for model methods.

## 3. Prerequisites

- A GitHub repository containing this code, with `bun.lock` committed (it is).
- A Render account (sign up at https://render.com).
- The repository's default branch must be `main` — the blueprint pins `branch: main` because Render's default is `master`.

## 4. Deploy, step by step

1. **Push** the repository to GitHub:
   ```bash
   git push -u origin main
   ```
2. **Create the blueprint:** in the [Render dashboard](https://dashboard.render.com), click **New → Blueprint**, select the repository, and click **Apply**.
3. Render provisions `sorted-db`, then builds and deploys `sorted-web` and `sorted-worker`. The web service runs the migration in its predeploy step before the first instance starts.
4. When the deploy finishes, open the service's **onrender.com URL** (e.g. `https://sorted-web.onrender.com`).
5. **Set `APP_URL`** (one-time, dashboard → `sorted-web` → Environment): add `APP_URL` = your onrender.com URL. Until then, absolute links/redirects fall back to `http://localhost:7070` (`src/lib/env.ts` default).

Subsequent pushes to `main` auto-deploy. GitHub Actions CI (`.github/workflows/ci.yml`) runs `lint` + production `build` on every push/PR; Render's own deploy will fail loudly if CI would have.

## 5. Verify the deployment

```bash
# Process is up (always 200 once the server runs)
curl https://<your-app>.onrender.com/api/health

# Database is reachable (503 when Postgres is down — this is the health-check probe)
curl https://<your-app>.onrender.com/api/ready

# End-to-end queue proof: create an item (enqueues a job), then watch it complete
curl -X POST https://<your-app>.onrender.com/api/items \
  -H 'content-type: application/json' \
  -d '{"name":"deploy check","description":"processed by sorted-worker?"}'
curl https://<your-app>.onrender.com/api/jobs
```

The `/api/jobs` response should show the job in `completed` status — proof the worker claimed, executed, and finished it against the shared database. Then open the UI in a browser and walk the demo flow.

## 6. Day-2 operations

### Schema changes (the only correct path to prod schema)

1. Edit `prisma/schema.prisma` (and mirror the change in `scripts/init-db.ts` for local PGlite — repository rule).
2. Create a migration locally: `bun run db:migrate --name <describe_the_change>`.
3. Review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`, commit it, push.
4. The web service's predeploy runs `prisma migrate deploy` on the next deploy.

**Never** run `bun run db:push` against production — it skips the migration history and breaks the audit trail.

### Queue behavior in production

- The worker polls the `jobs` table every second and claims work with `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)` — safe under concurrency.
- The `LISTEN/NOTIFY` fast path is currently wired only for the local PGlite mode; on production Postgres the worker logs a warning and relies on polling. Jobs are durable in Postgres either way, so nothing is lost.
- New background tasks must be registered in `src/workers/tasks/index.ts`; the worker registers them at startup.

### Free-tier limits (read before you rely on this environment)

- **Web service** spins down after ~15 minutes of inactivity; the first request after wake-up is slow (cold start). Upgrade to `starter` for always-on.
- **Worker** may spin down after inactivity too. This only delays queue processing — jobs stay `pending` in Postgres and are picked up when the worker wakes. Polling alone does not count as activity.
- **Postgres** is limited to 1 GB and, on the free plan, **expires 30 days after creation**. Before it expires, either upgrade to `basic-256mb` (keeps the instance) or accept that the environment is disposable.
- Free Postgres has no point-in-time recovery; paid plans enable automated backups. Confirm backup settings in the dashboard before treating the database as authoritative.

## 7. Environment variables

| Variable | Set by | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | Blueprint (`fromDatabase`) | yes | `postgresql://…` in prod; `file:./dev.db` locally |
| `NODE_ENV` | Blueprint | yes | `production` |
| `APP_ENV` | Blueprint | yes | `production`; CI uses `preview` |
| `LOG_LEVEL` | Blueprint | no | `info` default (`debug`/`warn`/`error`) |
| `APP_URL` | Dashboard, after first deploy | no | Absolute origin for links/redirects; defaults to `http://localhost:7070` |
| `SARVAM_API_KEY` | Dashboard, when a Sarvam slice ships | no | **Server-only.** Never `NEXT_PUBLIC_`-prefixed, never committed. Zod requires ≥ 20 chars. |
| `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM_ADDRESS` | Dashboard, when email ships | no | Optional per `src/lib/env.ts` |

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Deploy fails: `branch master could not be found` | Blueprint predates the `branch: main` pin; sync the blueprint again or verify `render.yaml` is current. |
| `/api/ready` returns 503, service restarts in a loop | Postgres unreachable: check `sorted-db` status and `DATABASE_URL` on the service. |
| Predeploy fails on `prisma migrate deploy` | Migration SQL error. Fix the offending migration (never edit an already-applied one in a fresh commit), push, redeploy. |
| App boots but pages error on database calls | Schema not applied — happened when the blueprint was created before migrations existed. Trigger a redeploy; predeploy applies `prisma/migrations/`. |
| Jobs stay `pending` forever | Worker down (free-tier spin-down), or task not registered in `src/workers/tasks/index.ts`. Check the worker's logs. |
| Queue processing delayed | Production uses 1s polling, not LISTEN/NOTIFY (see §6). Expected. |
| 502/port mismatch | `start` must listen on `$PORT`; the `start` script already handles it — check you didn't override the start command in the dashboard. |
| Slow first page load | Free web service cold start after spin-down. Expected on free tier. |

## 9. When the environment is disposable

For a throwaway preview (hackathon demo, PR review), the free tier is enough and the 30-day Postgres expiry is a feature, not a bug. To promote to a persistent environment: upgrade the database to `basic-256mb`, the web service to `starter`, set `APP_URL`, and confirm backups are enabled.

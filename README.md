# AbsoluteVitals

A self-hosted Core Web Vitals & uptime tracker. Paste any URL into the analyzer; the server loads the page in headless Chromium, measures **LCP, FCP, TTFB, INP, and CLS** with the official `web-vitals` library, persists the results, and renders them on a dashboard with Google's Web Vitals thresholds applied.

Built on [AbsoluteJS](https://github.com/absolutejs/absolute) (Elysia + React + HTMX + Islands), Bun, Drizzle, and Postgres.

---

## What it does

Two ways to get data into the dashboard:

1. **Synthetic probe (`/analyze`).** Paste a URL → the server launches a real headless Chromium via Playwright, navigates to the page, injects the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) library, captures all five Core Web Vitals plus uptime/TTFB/title/description, and writes events to the database. The result is a "lab" measurement — single load, single synthetic interaction. Probes take ~10–20 seconds.
2. **Real-User Monitoring (`POST /api/ingest`).** Each project gets an API key. Instrument any site you control with the `web-vitals` JS package and POST measurements to `/api/ingest`; real users on real devices contribute to the dashboard. The schema accepts `lcp | fcp | ttfb | inp | cls | uptime`.

Both write to the same `events` table, so a single project can mix synthetic and RUM data on one set of charts.

### What you see

- **Global health banner** — worst-case status across all projects (good / needs improvement / poor / awaiting data) plus a 24-hour event count.
- **Per-project cards** — one card per project, each with a 15-minute uptime gauge and last-ping timestamp.
- **Health-first metric cards** — for each Core Web Vital, a colored dot + GOOD / NEEDS IMPROVEMENT / POOR label, the p75 value, a three-segment threshold gauge with the current value's marker, p50/p95 muted, and a hover-popover with metric copy.
- **Interactive SVG line charts** — one per metric, with horizontal threshold bands and per-point hover tooltips showing the exact value + timestamp.
- **Status page (`/status`)** — small HTMX-rendered fragment that auto-refreshes uptime + last-ping for monitoring dashboards / TV-on-the-wall use.
- **Theme toggle** — vanilla CSS design tokens (`:root` dark, `[data-theme="light"]` override). No Tailwind. Light/dark choice persists in `localStorage`.

---

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Bun |
| HTTP server | Elysia (via AbsoluteJS) |
| Page rendering | React 19 SSR + AbsoluteJS Islands for interactive bits |
| Static-fragment endpoints | HTMX (status page) |
| Probe | Playwright (Chromium) + `web-vitals` |
| Database | Postgres 15 (Docker), Drizzle ORM with `bun-sql` |
| Validation | Elysia / TypeBox |
| API docs | `@elysiajs/swagger` at `/swagger` |

---

## Project layout

```
src/
├── backend/
│   ├── server.ts                # Elysia routes + page rendering
│   └── handlers/
│       ├── analyzeHandlers.ts   # probeUrl (Playwright) + trackUrl (probe → DB)
│       ├── dashboardHandlers.ts # aggregate query for the dashboard
│       ├── ingestHandlers.ts    # API key validation + event insert
│       └── statusHandlers.ts    # HTMX uptime fragment
└── frontend/
    ├── react/
    │   ├── pages/               # SSR pages (DashboardIndex, AnalyzePage)
    │   ├── components/          # Head, MetricCard
    │   ├── islands/             # AnalyzeForm, ThemeToggle, VitalsChart
    │   ├── client/              # Bootstrap.tsx — hydrates the islands
    │   └── islands/registry.ts  # island registry consumed by AbsoluteJS
    └── htmx/
        └── pages/StatusPage.html

db/
├── docker-compose.db.yml        # local Postgres
├── schema.ts                    # Drizzle schema (projects, events, metric_kind enum)
└── migrations/

scripts/
└── create-project.ts            # CLI to provision a project + API key

public/styles/app.css            # vanilla design tokens + components
absolute.config.ts               # AbsoluteJS config (islands, dirs)
```

---

## Getting started

### Prerequisites

- Bun 1.3+
- Docker (for Postgres)
- ~150 MB disk for Playwright's bundled Chromium (downloads on first install)

### Setup

```bash
bun install
bunx playwright install chromium      # one-time, if not already cached
cp .env.example .env                  # optionally override connection string
bun dev                               # starts Postgres on :5433 and dev server on :3000

# On your first run, you need to apply the database schema.
# While `bun dev` is running, open a second terminal and run:
bun db:push
```

The dev server runs on `:3000`, Postgres on `:5433`. Both are wired up via `DATABASE_URL` in `.env`.

### First run

1. Open http://localhost:3000/dashboard — you'll see the empty state.
2. Click **Analyze**, paste any URL (`https://example.com`), and submit. The loading overlay says ~10–20 seconds for a reason: a headless Chromium is doing the work.
3. You're redirected to `/dashboard?projectId=<id>` showing real LCP, FCP, TTFB, INP, and CLS for that page.

### Provision a project from the CLI

```bash
bun scripts/create-project.ts --name="My Site" --origin="https://my.example.com"
```

Outputs the project ID and API key. Use the API key to POST RUM data:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "content-type: application/json" \
  -H "x-api-key: <YOUR_KEY>" \
  -d '{"metric":"lcp","value":2400,"url":"https://my.example.com/some/page"}'
```

---

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/`, `/dashboard`           | React-rendered dashboard. Optional `?projectId=<uuid>` to filter to one project. |
| `GET`  | `/analyze`                   | URL analyzer page (form + loading overlay). |
| `GET`  | `/status`                    | HTMX status fragment host page. |
| `GET`  | `/api/status/fragment`       | Auto-refreshing HTMX fragment with uptime + last ping for `?projectId=<uuid>`. |
| `POST` | `/api/analyze`               | Run a synthetic probe and return results. Does **not** write to the DB. |
| `POST` | `/api/track-url`             | Probe + persist. Creates a project keyed on origin (or uses an existing one), writes one event per measured metric plus uptime. Returns `{projectId, projectName, apiKey, created, result}`. |
| `POST` | `/api/ingest`                | Real-user metrics endpoint. Auth: `x-api-key` header. Body: `{metric, value, url, statusCode?, ok?, userAgent?, timestamp?}`. |
| `GET`  | `/swagger`                   | API documentation. |

---

## Scripts

```bash
bun dev               # start the dev server (rebuilds on file change)
bun typecheck         # tsc --noEmit (run rm -rf build first if you've been running dev)
bun lint              # ESLint
bun format            # Prettier --write

bun db:reset          # drop the volume and start fresh
bun db:push           # apply Drizzle schema to the running DB
bun db:studio         # Drizzle Studio
bun db:postgresql     # interactive psql shell
```

---

## Schema

```ts
projects (
  id           uuid pk default random,
  name         varchar(120),
  origin       varchar(255),
  api_key      varchar(64) unique,
  created_at   timestamptz default now()
)

events (
  id           uuid pk default random,
  project_id   uuid fk → projects.id on delete cascade,
  metric       enum('lcp','fcp','ttfb','inp','cls','uptime'),
  value        double precision,
  url          text,
  status_code  integer null,
  ok           boolean null,
  user_agent   text null,
  recorded_at  timestamptz default now(),
  index (project_id, recorded_at),
  index (project_id, metric, recorded_at)
)
```

Dashboards aggregate `events` over a 24-hour window; uptime cards use the most recent 15 minutes.

---

## Synthetic probe details

`probeUrl` (in `src/backend/handlers/analyzeHandlers.ts`) does:

1. Validates the URL (http/https only).
2. Launches Chromium headless via Playwright (`ignoreHTTPSErrors`, 1280×800 viewport).
3. Adds an init script that runs **before** any page script: it bundles `web-vitals.iife.js` and registers `onLCP / onFCP / onTTFB / onCLS / onINP` callbacks. Each callback reports back to Node via `page.exposeFunction('__abReportVital')`.
4. Navigates with `waitUntil: 'load'`, 30s timeout.
5. Reads response status, content-type, content-encoding, body bytes.
6. Synthetically clicks `<body>` to register an interaction (so INP gets measured).
7. Waits ~2.5s, dispatches `pagehide` + `visibilitychange` to flush any deferred metric reports.
8. Reads `<title>` and `<meta name="description">`, returns the result.
9. Closes the browser in `finally`.

`trackUrl` runs `probeUrl`, then inserts one row per measured metric (skipping nulls) plus a guaranteed `uptime` row. Project lookup is keyed on `origin` so analyzing the same site twice goes to the same project.

### Caveats (lab vs. RUM)

- **INP from a synthetic click is approximate.** Real INP requires real user interactions across a session.
- **CLS only captures shifts during the few seconds we're on the page.** Late-arriving content (lazy ads, etc.) won't be reflected.
- **Some sites cloak headless browsers** (return 403, captcha pages, or stripped content). These show up as low scores or HTTP errors.
- **No SSRF protection.** `/api/analyze` and `/api/track-url` will fetch any URL the caller provides, including private network ranges. Acceptable for a single-user local tool — must be hardened (block `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, etc.) before any public exposure.
- **No rate limiting** on the probe endpoints. Same caveat.

---

## Theme system

Vanilla CSS at `public/styles/app.css`. Tokens live on `:root` (dark default) and are overridden by `[data-theme="light"]`. The choice is read from `localStorage['av-theme']` and falls back to `prefers-color-scheme`. A small synchronous inline script in `<head>` sets `document.documentElement.dataset.theme` before any rendering happens, preventing FOWT (flash-of-wrong-theme).

The toggle button in the header is a React Island (`src/frontend/react/islands/ThemeToggle.tsx`) that mirrors state to `dataset.theme` + `localStorage`.

---

## Notes on AbsoluteJS Islands

This project is the first in this codebase to use AbsoluteJS Islands, so a few framework wrinkles were discovered along the way:

- The island registry only AST-resolves direct named imports — `defineIslandRegistry({ react: { Name: Component } })`. The wrapper-call `defineIslandComponent(Component, { source })` shape falls through to a dynamic-load path that resolves `./` against the framework's own module URL and breaks at runtime.
- The framework auto-injects a `<script>window.__ABSOLUTE_MANIFEST__…</script>` immediately before the first `[data-island="true"]` element. To hydrate islands, you must provide a client-side bootstrap script (`islands.bootstrap` in `absolute.config.ts`) — the framework does not ship a default. See `src/frontend/react/client/Bootstrap.tsx` for the implementation: it reads the manifest, dynamically imports each `IslandReact{Component}` bundle, and `createRoot`s them.
- We use `createRoot` (not `hydrateRoot`) because the page-bundle's `<Island>` renders the wrapper with `dangerouslySetInnerHTML`, and React refuses to nest a hydrated root inside a `dangerouslySetInnerHTML` element. `createRoot` accepts a brief flash on first paint in exchange for working reliably.

---

## Out of scope (for later)

- SSRF allow-list / IP blocking on `/api/analyze` & `/api/track-url`.
- Probe rate-limiting.
- Persisted analyze history for ad-hoc URLs that the user didn't explicitly track.
- Per-page (route-level) breakdown — currently the dashboard is per-project (origin).
- Browser-emulation profiles (mobile, slow 3G) for the synthetic probe.
- Alerting / threshold-breach notifications.
- Theme toggle on `/status` (HTMX page; would need a tiny vanilla JS button).

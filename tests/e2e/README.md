# End-to-end tests (Playwright)

## Run locally

**Naming:** at the **repo root**, `npm run test:e2e` is **Playwright (web)**. `npm run test:e2e:watch` is **mobile Maestro** (watches `.maestro/**/*.yaml` and re-runs the suite); same as `npm run mobile:test:e2e:watch`. There is no Playwright file-watcher script in this repo — use `npm run test:e2e:ui` for the Playwright UI.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` runs **`scripts/e2e-preflight.mjs`** first (disk warning; optional reachability check — see below), then Playwright.

Playwright starts **`npm run dev`** automatically (waits on `http://127.0.0.1:3000` by default) when you are **not** in CI. If you already have a dev server on that origin, it is reused.

- Point tests at another origin: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100` and start the app yourself, then set **`PLAYWRIGHT_SKIP_WEB_SERVER=1`** so Playwright does not spawn a second process. With **`PLAYWRIGHT_SKIP_WEB_SERVER`**, the preflight script **must** get HTTP 200 from `PLAYWRIGHT_BASE_URL` or it exits before tests (avoids long `page.goto` timeouts when nothing is listening).
- Match CI exactly (production server): `npm run build && npm run start -- --port 3100` in one terminal, then `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e` in another.

### Reliable local run (same shape as CI)

If Playwright’s auto-started `next dev` is slow or appears hung, use **`next start`** and point Playwright at it:

```bash
npm run build
PORT=3100 npm run start -- --port 3100 &
npx wait-on http://127.0.0.1:3100/login -t 120000
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e
```

Stop the server when finished (foreground **Ctrl+C** or `kill` the background PID).

## Troubleshooting

| Symptom | What to check |
|--------|------------------|
| Every test fails with **`page.goto` timeout** to `localhost:3000` | Nothing healthy on port 3000: run `npm run dev` manually and open the URL in a browser. Free the port if a zombie Node process is bound. |
| **`ENOSPC`** / write errors from Next or Expo | Disk full — free space (`df -h .`); sub‑512 MiB on the volume triggers a **preflight warning**. |
| Playwright “reuses” server but pages never load | Another process may be bound to 3000 without serving Next; kill it or change `PLAYWRIGHT_BASE_URL`. |
| Auth / Supabase errors during E2E | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set for the same project as `E2E_EMAIL` / `E2E_PASSWORD`. |

## Environment variables

| Variable | When | Purpose |
|----------|------|---------|
| `E2E_EMAIL` / `E2E_PASSWORD` | Optional | Enables authenticated journeys: [`journeys/authenticated-views.spec.ts`](journeys/authenticated-views.spec.ts) (full view matrix) and [`journeys/today-authenticated.spec.ts`](journeys/today-authenticated.spec.ts) (minimal Today / tracker smoke). Omit both to skip those tests. Account must be fully onboarded (complete `profiles` row) or login redirects to `/onboarding` and the helper throws. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime | Required for the app to talk to Supabase during E2E (same as normal dev). |
| `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_NAME`, `MIDSCENE_MODEL_FAMILY` | Optional | Plus usually `MIDSCENE_MODEL_BASE_URL`. Enables AI specs under [`ai/`](ai/). Run with `npm run test:e2e:ai` (nightly / pre-release). |

## GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

Repository **secrets** (Settings → Secrets and variables → Actions):

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — job-level env so `next build` embeds them; needed for sign-in flows against your project.
- `E2E_EMAIL` / `E2E_PASSWORD` — dedicated test user; without them, authenticated journeys are skipped (public smoke still runs).

Fork PRs do not receive upstream secrets; expect authenticated tests to skip there.

## Human QA

See [`EXPLORATORY_QA.md`](EXPLORATORY_QA.md) for release charter and checklist.

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

| Symptom                                                           | What to check                                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Every test fails with **`page.goto` timeout** to `localhost:3000` | Nothing healthy on port 3000: run `npm run dev` manually and open the URL in a browser. Free the port if a zombie Node process is bound. |
| **`ENOSPC`** / write errors from Next or Expo                     | Disk full — free space (`df -h .`); sub‑512 MiB on the volume triggers a **preflight warning**.                                          |
| Playwright “reuses” server but pages never load                   | Another process may be bound to 3000 without serving Next; kill it or change `PLAYWRIGHT_BASE_URL`.                                      |
| Auth / Supabase errors during E2E                                 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set for the same project as `E2E_EMAIL` / `E2E_PASSWORD`.           |

## Visual regression

Playwright snapshot baselines for tab shells, sub-pages, and deep routes (settings band, targets, recipe detail, paywall, log sheet, food search). See [`docs/testing/VISUAL_REGRESSION.md`](../docs/testing/VISUAL_REGRESSION.md).

```bash
npm run test:e2e:visual
npm run test:e2e:visual:update   # after intentional UI changes
```

Authenticated visual goldens use a separate seeded account from general
journey tests. Set `E2E_VISUAL_EMAIL` / `E2E_VISUAL_PASSWORD` to a
fully-onboarded, deterministic profile whose target/name/history are stable.
The visual specs freeze browser time to `2026-06-16T17:00:00.000Z` by default;
override with `E2E_VISUAL_NOW` only when intentionally regenerating every
affected golden.

Committed visual-regression specs force the redesign flag bundle on before navigation via `forceRedesignVisualFlagsOn` (`design_system_*`, `redesign_*`, `web-meal-nutrition-detail`, and `web_gutter_convergence_v1`). Keep that helper in sync when adding a new flag-gated redesign surface so CI diffs the flag-ON path rather than the empty `$enabled_feature_flags` auth fixture.

## Environment variables

| Variable                                                                 | When            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_RECIPE_ID`                                                          | Optional        | Discover recipe for `visual-regression-deep.spec.ts` (default `seed-v2-mediterranean-butter-bean-shakshuka`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `E2E_EMAIL` / `E2E_PASSWORD`                                             | Optional        | Enables authenticated journeys: [`journeys/authenticated-views.spec.ts`](journeys/authenticated-views.spec.ts) (full view matrix) and [`journeys/today-authenticated.spec.ts`](journeys/today-authenticated.spec.ts) (minimal Today / tracker smoke). Omit both to skip those tests. Account must be fully onboarded (complete `profiles` row) or login redirects to `/onboarding` and the helper throws. **`playwright.config.ts` loads `.env.local`** so you do not need to export these manually. Prefer canonical routes (`/today`, `/discover`, …) over legacy `/?view=`. Use `--workers=1` if `next dev` is slow. Optional one-shot login: [`global-setup.ts`](global-setup.ts) (writes `tests/e2e/.auth/user.json`, gitignored). |
| `E2E_VISUAL_EMAIL` / `E2E_VISUAL_PASSWORD`                               | Optional        | Enables authenticated visual goldens (`visual-audit-authed`, authed subpages, deep routes, Gate 1.5). Use a seeded deterministic account, not a daily-driver account. Storage state is written to `tests/e2e/.auth/visual-user*.json` and is separate from `E2E_EMAIL`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `E2E_VISUAL_NOW`                                                         | Optional        | Fixed browser clock for authenticated visual goldens. Defaults to `2026-06-16T17:00:00.000Z`; changing it intentionally invalidates date/greeting-sensitive baselines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Build + runtime | Required for the app to talk to Supabase during E2E (same as normal dev).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_NAME`, `MIDSCENE_MODEL_FAMILY` | Optional        | Plus usually `MIDSCENE_MODEL_BASE_URL`. Enables AI specs under [`ai/`](ai/). Run with `npm run test:e2e:ai` (nightly / pre-release).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

The **root** job runs `npm run lint` (ESLint on `src/`, `app/`, `tests/`) after typecheck, then Vitest with coverage, `next build`, and Playwright smoke. On GitHub Actions, Playwright uses the **GitHub** reporter (annotations on failures), **HTML** (`open: "never"`), and **list**; failed runs upload a **`playwright-report`** artifact (see the _Upload Playwright HTML report_ step in the workflow). `test.only` / `describe.only` are rejected when `CI` is set (`forbidOnly`).

Repository **secrets** (Settings → Secrets and variables → Actions):

| Secret / variable               | Required for green CI?           | Purpose                                                                                                                                                   |
| ------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Yes** (for build + E2E)        | Embedded at build time; app + tests need a real project.                                                                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes**                          | Same.                                                                                                                                                     |
| `E2E_EMAIL`                     | **For authenticated Playwright** | Without both email + password, [`today-authenticated.spec.ts`](journeys/today-authenticated.spec.ts) and similar specs **skip**; public smoke still runs. |
| `E2E_PASSWORD`                  | **With `E2E_EMAIL`**             | Test user must be fully onboarded or login loops to `/onboarding`.                                                                                        |

Fork PRs do not receive upstream secrets; expect authenticated tests to skip there.

## Human QA

See [`EXPLORATORY_QA.md`](EXPLORATORY_QA.md) for release charter and checklist.

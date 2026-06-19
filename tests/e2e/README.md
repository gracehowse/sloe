# End-to-end tests (Playwright)

## Run locally

**Naming:** at the **repo root**, `npm run test:e2e` is **Playwright (web)**. `npm run test:e2e:watch` is **mobile Maestro** (watches `.maestro/**/*.yaml` and re-runs the suite); same as `npm run mobile:test:e2e:watch`. There is no Playwright file-watcher script in this repo — use `npm run test:e2e:ui` for the Playwright UI.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` runs **`scripts/e2e-preflight.mjs`** first (zombie-server detection, route warm-up, disk warning), then Playwright.

### Playwright projects

| Project | Auth setup | Credentials | Specs |
|---------|------------|-------------|-------|
| `chromium` | none | — | Public shell, marketing, unauthenticated journeys |
| `chromium-authed` | `auth.setup.ts` | `E2E_EMAIL` / `E2E_PASSWORD` | Journey + screenshot specs under `journeys/`, `screenshots/`, `ai/` |
| `chromium-visual` | `auth.visual-setup.ts` | `E2E_VISUAL_*` (CI falls back to `E2E_*`) | `visual-*-authed`, `visual-regression-deep`, Gate 1.5 authed |

Public visual specs **never** wait on auth setup — run them with `npm run test:e2e:visual:public`.

Playwright starts **`npm run dev`** automatically when you are **not** in CI. Preflight fails fast if port is listening but HTTP hangs (zombie process).

- Point tests at another origin: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100` + **`PLAYWRIGHT_SKIP_WEB_SERVER=1`**
- Force fresh dev server: **`PLAYWRIGHT_FORCE_FRESH_SERVER=1`**
- Skip route warm-up: **`PLAYWRIGHT_WARM_ROUTES=0`**

### Mirror CI locally

```bash
npm run test:e2e:ci-parity
```

Runs `next build`, `next start` on `:3100`, smoke E2E, and public visual regression — same shape as `ci.yml` + `visual-review.yml` public step.

Manual equivalent:

```bash
npm run build
npm run start -- --port 3100 &
npx wait-on http://127.0.0.1:3100/login -t 120000
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e
```

## Troubleshooting

| Symptom | What to check |
|--------|------------------|
| Every test fails with **`page.goto` timeout** | Run preflight alone: `node scripts/e2e-preflight.mjs`. If it reports a zombie, `lsof -iTCP:3000 -sTCP:LISTEN` then kill the PID. |
| Public visual tests hang before running | You may be hitting `auth.setup` — use `--project=chromium` or `npm run test:e2e:visual:public`. |
| **`ENOSPC`** / write errors | Disk full — free space; sub‑512 MiB triggers a preflight warning. |
| Auth / Supabase errors | `NEXT_PUBLIC_SUPABASE_*` must match the project for your test credentials. |

## Visual regression

See [`docs/testing/VISUAL_REGRESSION.md`](../docs/testing/VISUAL_REGRESSION.md).

```bash
npm run test:e2e:visual          # all visual specs (when creds exist)
npm run test:e2e:visual:public   # public only
npm run test:e2e:visual:authed   # authed goldens only
npm run test:e2e:visual:update
```

Authenticated visual goldens use a **separate** deterministic account (`E2E_VISUAL_*`) so daily-driver E2E profile edits do not rewrite baselines. Storage state: `tests/e2e/.auth/visual-user*.json`.

**Create the golden account** (once per machine / after password rotation):

```bash
npm run setup:e2e:visual-golden
```

Default inbox: `gracehowse+visualgolden@outlook.com` — free tier, onboarded profile, empty journal. Updates `.env.local`; re-run `gh secret set E2E_VISUAL_*` after rotation if CI should match.

## Environment variables

| Variable | When | Purpose |
|----------|------|---------|
| `PLAYWRIGHT_SKIP_WEB_SERVER` | Optional | App already running (CI, ci-parity) |
| `PLAYWRIGHT_FORCE_FRESH_SERVER` | Optional | Do not reuse existing dev server |
| `PLAYWRIGHT_WARM_ROUTES` | Optional | Set `0` to skip preflight warm-up |
| `E2E_RECIPE_ID` | Optional | Recipe for `visual-regression-deep.spec.ts` |
| `E2E_EMAIL` / `E2E_PASSWORD` | Optional | Journey tests (`chromium-authed`) |
| `E2E_VISUAL_EMAIL` / `E2E_VISUAL_PASSWORD` | Optional | Visual goldens (`chromium-visual`); recommended locally |
| `E2E_VISUAL_DISABLE_E2E_FALLBACK` | CI | Set `1` to forbid CI fallback to `E2E_*` for visual goldens |
| `E2E_VISUAL_NOW` | Optional | Fixed clock for visual goldens (default `2026-06-16T17:00:00.000Z`) |
| `MIDSCENE_MODEL_*` | Optional | AI specs under [`ai/`](ai/) |

**`playwright.config.ts` loads `.env.local`** so you do not need to export credentials manually.

## GitHub Actions

- **Smoke E2E:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `test:e2e` on `:3100`
- **Visual regression:** [`.github/workflows/visual-review.yml`](../../.github/workflows/visual-review.yml) — public + authed visual projects

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime |
| `E2E_EMAIL` / `E2E_PASSWORD` | Journey tests + CI visual fallback |
| `E2E_VISUAL_EMAIL` / `E2E_VISUAL_PASSWORD` | Dedicated visual golden account (recommended) |

## Human QA

See [`EXPLORATORY_QA.md`](EXPLORATORY_QA.md) for release charter and checklist.

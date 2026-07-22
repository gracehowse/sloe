# GitHub Actions secrets (CI)

Configure these in the repository: **Settings → Secrets and variables → Actions**.

## Required for full CI parity

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`). Baked into the Next.js build. If omitted, the app falls back to `utils/supabase/info.tsx` for local/CI smoke runs. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key. Same fallback behavior as the URL. |

## Optional — authenticated E2E

| Secret | Purpose |
|--------|---------|
| `E2E_EMAIL` | Test user email for Playwright smoke tests that sign in. |
| `E2E_PASSWORD` | Test user password. |

Without `E2E_*`, smoke tests that require a logged-in session may skip or hit login-only flows; middleware and builds still succeed with the Supabase fallback.

## Optional — Storybook / Chromatic

| Secret | Purpose |
|--------|---------|
| `CHROMATIC_PROJECT_TOKEN` | Playwright E2E visual review (`.github/workflows/chromatic.yml`) **and** fallback for Storybook Chromatic publish. From Chromatic → Project → Manage → token (`chpt_…`). |
| `CHROMATIC_STORYBOOK_PROJECT_TOKEN` | Optional. If Storybook and Playwright use **separate** Chromatic projects, set this to the Storybook project token. `.github/workflows/storybook.yml` prefers it over `CHROMATIC_PROJECT_TOKEN`. |

Local: add the same names to `.env.local` (never commit) for `npm run chromatic` / `npm run chromatic:storybook`.

**Always-current catalog (2026-07-22):** every visual component needs a sibling Storybook story (or an explicit skip). CI runs `npm run check:storybook-coverage` in `npm run ci` and in the Storybook workflow, then publishes Storybook builds to Chromatic so hosted snapshots stay in sync with PRs/`main`.

## Optional — other visual / beta tooling

| Secret | Purpose |
|--------|---------|
| `VR_API_TOKEN` | PostHog Visual Review (job commented out until enabled). |
| `CENTERCODE_*` | See `docs/operations/centercode-beta-feedback.md` for beta release workflow. |

## Production / Vercel (not GitHub)

Use your host’s env UI for `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, Stripe keys, etc. See `.env.example` at the repo root.

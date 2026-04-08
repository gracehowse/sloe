# End-to-end tests (Playwright)

## Run locally

```bash
npm ci
npx playwright install chromium
npm run build
npm run start
# other terminal:
npm run test:e2e
```

Optional: `PLAYWRIGHT_BASE_URL=http://localhost:3000` if your dev server uses another origin.

## Environment variables

| Variable | When | Purpose |
|----------|------|---------|
| `E2E_EMAIL` / `E2E_PASSWORD` | Optional | Enables [`journeys/authenticated-views.spec.ts`](journeys/authenticated-views.spec.ts). Omit both to skip those tests. Account must be fully onboarded (complete `profiles` row) or login redirects to `/onboarding` and the helper throws. |
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

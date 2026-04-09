# Environment variables

Reference for **local dev**, **CI**, and **production** (e.g. Vercel). Values are examples—use your own secrets.

## Required for core app (browser + server)

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Build + runtime | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime | Supabase anon (public) key for client + server routes that use anon client |

Without these, auth and data sync will not work.

## Server-only (API routes, webhooks)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook profile updates, privileged server ops (keep secret) |
| `STRIPE_SECRET_KEY` | Checkout session creation |
| `STRIPE_WEBHOOK_SECRET` | Verify Stripe webhook signatures |
| `STRIPE_PRICE_BASE_MONTHLY` | Stripe Price ID for Base tier |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro tier |

## Optional: rate limits

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting for APIs |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |

If unset, rate limits fall back to in-memory (weak on serverless cold starts).

## Optional: nutrition / import APIs

| Variable | Purpose |
|----------|---------|
| `FATSECRET_CLIENT_ID` / `FATSECRET_CLIENT_SECRET` | FatSecret for `/api/nutrition/verify-recipe` |
| USDA FDC env (see `serverEnv.ts`) | USDA FoodData Central |
| `OPENAI_API_KEY` | Recipe import from image (`/api/recipe-import/image`) |

## Optional: analytics & errors

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog product analytics (client) |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Error reporting |

## Playwright / E2E (CI or local)

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Base URL for tests (default `http://localhost:3000`) |
| `E2E_EMAIL` / `E2E_PASSWORD` | Onboarded test user; omit to skip authenticated journeys |
| `MIDSCENE_MODEL_*` | AI E2E (see `tests/e2e/README.md`) |

## Production smoke

After deploy, run:

```bash
PLAYWRIGHT_BASE_URL=https://your-domain.com npm run smoke:production
```

Uses lightweight HTTP checks (no browser). Set URL to your preview or production origin.

## CI (GitHub Actions)

Repository secrets should include at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for a real build + E2E sign-in path. Optional: `E2E_EMAIL`, `E2E_PASSWORD`. See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and [`tests/e2e/README.md`](../tests/e2e/README.md).

## Related

- [Observability (PostHog dashboards, Sentry verification, smoke)](observability.md)
- [Supabase RLS verification](supabase-rls-checklist.md)
- [Phase B Health / platform decision (web vs native)](health-platform-phase-b.md)

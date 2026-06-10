# Environment variables

Reference for **local dev**, **CI**, and **production** (e.g. Vercel). Values are examples—use your own secrets.

## Local development — one `.env.local`

| File | Use |
|------|-----|
| **Repo root** `.env.local` | **Canonical** — Next.js, Expo/Metro, scripts, Playwright, Maestro |
| `supabase/.env` | Local Supabase CLI only (Apple OAuth secret, etc.) |
| ~~`apps/mobile/.env.local`~~ | **Do not create** — `npm run env:doctor` fails if present |

Expo loads root env via `apps/mobile/scripts/load-repo-env.cjs` (wired in `app.config.ts` + `metro.config.js`). Copy `.env.example` → `.env.local` at the **repo root**.

**FatSecret:** set `FATSECRET_CONSUMER_KEY` + `FATSECRET_CLIENT_SECRET` (or legacy `FATSECRET_CONSUMER_SECRET`) — `serverEnv.ts` accepts either secret name.

```bash
npm run env:doctor   # verify single-file setup
```

## Required for core app (browser + server)

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Build + runtime | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime | Supabase anon (public) key for client + server routes that use anon client |

Without these, auth and data sync will not work.

## Public: privacy contact

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVACY_EMAIL` | Shown on `/privacy` for data-rights contact. If unset, defaults to `privacy@suppr-club.com`. Set on Vercel to the mailbox you actually monitor. |

## Server-only (API routes, webhooks)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Tier-gated APIs (`profiles.user_tier`), Stripe webhook profile updates, **`DELETE /api/account/delete`** (auth user removal), other privileged server ops (keep secret) |
| `STRIPE_SECRET_KEY` | Checkout session creation |
| `STRIPE_WEBHOOK_SECRET` | Verify Stripe webhook signatures |
| `STRIPE_PRICE_BASE_MONTHLY` | Stripe Price ID for Base tier — £3.99/mo |
| `STRIPE_PRICE_BASE_ANNUAL` | Stripe Price ID for Base tier — £29.99/yr |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro tier — £7.99/mo |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro tier — £59.99/yr |

## Optional: rate limits

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting for APIs |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |

If unset, rate limits fall back to in-memory (weak on serverless cold starts).

**Production:** Set both Upstash variables on Vercel (production **and** preview if you want consistent limits across preview deployments). Without them, each serverless instance uses its own in-memory counter, so abuse protection is weaker under load or across regions. Confirm in the Vercel project dashboard that the REST URL matches your Upstash database and that the token is not expired.

## Optional: nutrition / import APIs

| Variable | Purpose |
|----------|---------|
| `FATSECRET_CONSUMER_KEY` + `FATSECRET_CLIENT_SECRET` (or legacy `FATSECRET_CONSUMER_SECRET`) | FatSecret Platform API — search + verify ([FatSecret](https://platform.fatsecret.com)) |
| USDA FDC env (see `serverEnv.ts`) | USDA FoodData Central |
| `OPENAI_API_KEY` | Recipe import from image (`/api/recipe-import/image`) |

## Optional: analytics & errors

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog product analytics (client) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry for **browser** errors (public DSN) |
| `SENTRY_DSN` | Sentry for **server** / Node (secret DSN; can match the same project as the public DSN) |

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

## Supabase CLI: local stack (supabase start)

These are **not** read from the repo root `.env.local` by default. They apply when you run the **local** Supabase Docker stack and `config.toml` uses `env(...)`.

| Variable | Where | Purpose |
|----------|--------|---------|
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | **`supabase/.env`** (create from [`supabase/.env.example`](../supabase/.env.example)) | Apple OAuth **client secret** (JWT from your Apple `.p8` signing key). Referenced in [`supabase/config.toml`](../supabase/config.toml) under `[auth.external.apple]`. |

**Hosted Supabase:** configure the same Apple provider (including secret) in the **project dashboard** → Authentication → Providers → Apple. That is what production and `supabase db … --linked` use for Auth; the local `supabase/.env` entry is optional unless you run `supabase start` and want Apple sign-in (or a quiet CLI when config is evaluated).

If you only use **`supabase db push` / `migration list --linked`** against a remote project, missing this variable does **not** block migrations; you may still see a CLI warning until `supabase/.env` exists or the variable is exported.

## Related

- [Observability (PostHog dashboards, Sentry verification, smoke)](observability.md)
- [Supabase RLS verification](supabase-rls-checklist.md)
- [Phase B Health / platform decision (web vs native)](health-platform-phase-b.md)

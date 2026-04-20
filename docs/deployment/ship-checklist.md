# Ship checklist (web + mobile)

Use this before a major release or store submission.

## Environment

- [ ] Production Supabase: all migrations from `supabase/migrations/` applied via **`supabase db push --linked` only** — do **not** use Supabase MCP `apply_migration` or the Dashboard SQL editor's "Save as migration" for files committed to `supabase/migrations/`. Both paths call the Management API without a `version` parameter, which rewrites `schema_migrations.version` to `NOW()` and causes drift from the deliberately-ordered file timestamps. Use `npm run check:migrations` to confirm matched/drifted/local-only/remote-only state before shipping; see [`docs/planning/supabase-migration-drift-inventory.md`](../planning/supabase-migration-drift-inventory.md#why-drift-recurs) for the why.
- [ ] Vercel (or host): env vars match `.env.example` — no placeholders for required keys.
- [ ] `NEXT_PUBLIC_APP_URL` / domain correct for auth redirects and Stripe.
- [ ] **Apple Sign-In (Supabase):** Dashboard → Authentication → Providers → Apple — **Secret** (JWT from Apple `.p8` key) set and rotated before expiry (~6 months). See [`docs/environment.md`](../environment.md#supabase-cli-local-stack-supabase-start) and [`supabase/.env.example`](../../supabase/.env.example) for local `supabase start` (`SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` in `supabase/.env`).
- [ ] **Stripe price IDs (web):** all four set in Vercel — `STRIPE_PRICE_BASE_MONTHLY`, `STRIPE_PRICE_BASE_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`. Verify each maps to the correct Stripe Price in the dashboard (£3.99/mo, £29.99/yr, £7.99/mo, £59.99/yr).
- [ ] **RevenueCat iOS (mobile):** RC project exists; Stripe is *not* used for mobile IAP (Pattern A — see `docs/decisions/2026-04-billing-architecture-pattern-a.md`). App Store Connect has four Pro/Base subscription SKUs; RC offering is live with monthly + annual packages; `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` set in EAS. Optional unified dev key `EXPO_PUBLIC_REVENUECAT_API_KEY` (v2 `test_…`) can be used for non-prod builds; see `apps/mobile/lib/purchases.ts` for precedence.

## Web

- [ ] `npm run build` and `npm run test` pass locally; CI green on `main`.
- [ ] Smoke: sign-in, discover, save recipe, nutrition tracker, meal plan.
- [ ] PostHog / Sentry DSN set if you rely on analytics or errors in prod.

## Mobile (Expo / stores)

- [ ] `apps/mobile`: bump `version` / build numbers in `app.json` as needed.
- [ ] EAS project linked; production credentials for iOS/Android.
- [ ] **Native-only features** tested on a dev or preview build (not Expo Go): Health sync, barcode camera, speech recognition where used.
- [ ] App Store / Play Console: privacy strings match actual data use (HealthKit, analytics, etc.).

## Data & compliance

- [ ] Privacy policy and terms URLs live and linked in app and store listings.
- [ ] No test API keys or debug endpoints exposed in production builds.

## Post-release

- [ ] Monitor error tracking and support channel for the first 24–48 hours.
- [ ] Note any rollback path (Vercel promote previous deployment; staged app store release).

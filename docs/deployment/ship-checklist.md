# Ship checklist (web + mobile)

Use this before a major release or store submission.

## Environment

- [ ] Production Supabase: all migrations from `supabase/migrations/` applied (`supabase db push` or hosted SQL).
- [ ] Vercel (or host): env vars match `.env.example` — no placeholders for required keys.
- [ ] `NEXT_PUBLIC_APP_URL` / domain correct for auth redirects and Stripe.
- [ ] **Apple Sign-In (Supabase):** Dashboard → Authentication → Providers → Apple — **Secret** (JWT from Apple `.p8` key) set and rotated before expiry (~6 months). See [`docs/environment.md`](../environment.md#supabase-cli-local-stack-supabase-start) and [`supabase/.env.example`](../../supabase/.env.example) for local `supabase start` (`SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` in `supabase/.env`).

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

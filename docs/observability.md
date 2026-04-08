# Observability (errors and product analytics)

Platemate uses **PostHog** for product analytics (client) and can use **Sentry** (or similar) for server/client error aggregation. This doc ties configuration to dashboards you should maintain as traffic grows.

## PostHog (product)

- **Env:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (see [`docs/environment.md`](environment.md)).
- **Client helper:** `src/lib/analytics/track.ts` — no-ops when the public key is missing.
- **Event catalog:** `src/lib/analytics/events.ts` — keep names stable; add new keys here when instrumenting features.

### Suggested dashboards

1. **Funnel — core loop:** `recipe_saved` → `meal_plan_generated` → `shopping_list_generated`.
2. **Nutrition:** `food_logged` volume; breakdown by `fromPlanner` if you pass it in properties.
3. **Imports:** `recipe_import_url`, `recipe_import_image`, `barcode_lookup` success rates (filter by error paths in logs if you add them later).
4. **Monetization:** `checkout_started`, `checkout_completed_return` (from Settings/checkout flow).
5. **Profile:** `profile_targets_saved` (includes whether activity-adjusted calories preference is on).

## API and server errors

- **Vercel:** Function logs per deployment; filter by route (`/api/...`) when debugging.
- **Sentry (recommended):** Add `@sentry/nextjs`, set `SENTRY_DSN` / auth token per environment, and create alerts for:
  - Spikes in 5xx on `/api/recipe-import`, `/api/nutrition/*`, Supabase-backed routes.
  - Unhandled exceptions in `app/error.tsx` / `app/global-error.tsx` if wired to Sentry.

## Synthetic checks

- **Production smoke:** `npm run smoke:production` (requires `PLAYWRIGHT_BASE_URL`). Hits public routes; extend as needed.

## Supabase

- Use Supabase **Logs** and **Database** advisors for slow queries and failed RLS/policy errors.
- Cross-check RLS with [`docs/supabase-rls-checklist.md`](supabase-rls-checklist.md).

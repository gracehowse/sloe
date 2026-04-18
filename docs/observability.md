# Observability (errors and product analytics)

Suppr uses **PostHog** for product analytics (client) and **Sentry** for error aggregation. The Next.js app is **already wired** for Sentry via `@sentry/nextjs` (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`, `src/instrumentation.ts`). Remaining work is mostly **environment variables and dashboards**, not installing packages.

## PostHog (product)

- **Env:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (see [`docs/environment.md`](environment.md)).
- **Client helper:** `src/lib/analytics/track.ts` — no-ops when the public key is missing.
- **Event catalog:** `src/lib/analytics/events.ts` — keep names stable; add new keys here when instrumenting features.

### Suggested dashboards (PostHog)

Create these once the project receives production traffic:

1. **Funnel — core loop:** `recipe_saved` → `meal_plan_generated` → `shopping_list_generated`.
2. **Nutrition:** `food_logged` volume; breakdown by `fromPlanner` if you pass it in properties.
3. **Imports:** `recipe_imported { source: "url" | "image" }` (dual-emitted alongside the legacy `recipe_import_url` / `recipe_import_image` until 2026-05-18 — post-ship #1 rename cycle), `barcode_lookup` (filter on `ok: true` where applicable).
4. **Monetization:** `checkout_started`, `checkout_completed` (rename target for `checkout_completed_return`, dual-emitted until 2026-05-18; no emit site wired yet — Stripe return flow owed).
5. **Profile:** `profile_targets_saved` (includes whether activity-adjusted calories preference is on).
6. **Planner extras:** `smart_suggestion_saved` when users add catalog suggestions from the planner.

## Sentry (errors)

### Verify in Vercel (checklist)

1. In the Vercel project → **Settings → Environment Variables**, set for **Production** and **Preview** (as needed):
   - `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` (match how your Sentry project was created; server often uses `SENTRY_DSN`).
2. Redeploy so the DSN is present at build/runtime.
3. Trigger a test error (e.g. temporary `throw` in a dev-only API route) or use Sentry’s “send test event” from the wizard; confirm the event appears in the Sentry project.
4. Add **alert rules** in Sentry for: spike in issue volume, new issues on `https://` routes matching your production domain.

### What to monitor

- Spikes in **5xx** or unhandled exceptions on `/api/recipe-import`, `/api/nutrition/*`, and other server routes.
- **Client** crashes surfaced through `app/error.tsx` / `app/global-error.tsx` (Sentry captures when DSN is set).

## API and server errors (Vercel)

- **Function logs** per deployment; filter by route (`/api/...`) when debugging without Sentry.

## Synthetic checks

- **Production smoke:** `npm run smoke:production` (requires `PLAYWRIGHT_BASE_URL`). Hits public routes; extend as needed.

## Supabase

- Use Supabase **Logs** and **Database** advisors for slow queries and failed RLS/policy errors.
- Cross-check RLS with [`docs/supabase-rls-checklist.md`](supabase-rls-checklist.md).

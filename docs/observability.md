# Observability (errors and product analytics)

Suppr uses **PostHog** for product analytics (client) and **Sentry** for error aggregation. The Next.js app is **already wired** for Sentry via `@sentry/nextjs` (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`, `src/instrumentation.ts`). Remaining work is mostly **environment variables and dashboards**, not installing packages.

## Mobile (P1-13, 2026-04-25)

The mobile app is wired for both Sentry and PostHog at parity with web:

- **Sentry:** `@sentry/react-native@7.2.0`. Helper at `apps/mobile/lib/errorTracking.ts` exposes `initErrorTracking`, `captureException`, `setUser`, `clearUser`. Init runs at app boot (`apps/mobile/app/_layout.tsx:38`).
- **PostHog:** `posthog-react-native`. Helper at `apps/mobile/lib/analytics.ts` exposes `track`, `identify`, `reset`, `isFeatureEnabled`, `subscribeToFlags`. Track helper integrates with the shared `AnalyticsEventName` type from `src/lib/analytics/events.ts` so web ↔ mobile stay name-consistent.
- **User context** is now stamped automatically: `apps/mobile/context/auth.tsx::syncObservabilityUser` calls `sentrySetUser(uid)` + `posthogIdentify(uid)` whenever the Supabase session has a userId, and `sentryClearUser()` + `posthogReset()` on sign-out. Hooked into the initial `getSession`, the `onAuthStateChange` listener, and the E2E auto-sign-in path. Crashes carry a user id from the first frame; PostHog funnels stop being anonymous.
- **Critical events fired on mobile:** `food_logged` (10+ sites in tracker + barcode), `meal_plan_generated` (planner.tsx:1202), `paywall_viewed` + `paywall_dismissed` (paywall.tsx:285/375/475), `onboarding_completed` (onboarding.tsx — both `skip` path and `saveAndFinish` path, with `path: "skip" | "full"` discriminator for funnel splitting; mirrors web `web-flow.tsx`).
- **Onboarding seed-save observability (ENG-792):** `onboarding_completed` now carries `recipes_saved` (recipes actually persisted) **distinct from** `recipes_resolved` (recipes that exist in the catalogue) — a shortfall between them means the seed-save upsert failed. A dedicated `onboarding_seed_save_failed` (`{ flow, error, attempted }`) also fires on the failure path. Before this, a user stranded at 0 saved recipes was indistinguishable from a clean onboarding (the save result was discarded at both call sites). Shared logic in `src/lib/onboarding/seedSaveTelemetry.ts` so web + mobile can't drift.

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

### Sentry MCP in Cursor (optional)

[Sentry MCP](https://docs.sentry.io/ai/mcp/) lets the IDE pull issue details and traces via OAuth against your Sentry account. Add a hosted server in **Cursor Settings → MCP** (user config file `~/.cursor/mcp.json` on macOS):

```json
"sentry": {
  "url": "https://mcp.sentry.dev/mcp"
}
```

After saving, complete the OAuth prompt once. Scope to a single org or project so tools stay constrained: use `https://mcp.sentry.dev/mcp/<organization>` or `https://mcp.sentry.dev/mcp/<organization>/<project>` ([path constraints](https://docs.sentry.io/ai/mcp/)). Align `<organization>` / `<project>` with the slugs shown in `SENTRY_ORG` / `SENTRY_PROJECT` in deployment env when applicable.

### Verify in Vercel (checklist)

1. In the Vercel project → **Settings → Environment Variables**, set for **Production** and **Preview** (as needed):
   - `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` (match how your Sentry project was created; server often uses `SENTRY_DSN`).
2. Redeploy so the DSN is present at build/runtime.
3. Trigger a test error (e.g. temporary `throw` in a dev-only API route) or use Sentry’s “send test event” from the wizard; confirm the event appears in the Sentry project.
4. **Alert rules** — see [`docs/operations/alerting.md`](./operations/alerting.md) for the canonical alarm list (6 minimum alarms + 4 nice-to-haves, with vendor-by-vendor test procedures). The aspirational one-liner that used to live here was replaced 2026-05-14 after the audit found zero alarms actually wired.

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

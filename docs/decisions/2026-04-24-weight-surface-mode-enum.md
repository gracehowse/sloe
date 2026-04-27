# Decision log: profiles.weight_surface_mode three-value enum (T13, retroactive 2026-04-25)

**Date:** 2026-04-24 (decision); 2026-04-25 (doc backfilled per P1-17)
**Status:** Resolved (shipped as commit `6fec8ac`)
**Trigger:** T13 / Phase 2 condition #11 of [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md). Closes DI-P0-03 from the [diversity inclusion audit](./2026-04-19-diversity-inclusion-audit.md). Weight on the Progress + Digest surfaces was visible by default with no opt-out, hostile to users in eating-disorder recovery (a stated cohort in the diversity audit) and to anyone tracking macros without weight as a goal.

---

## Decision

**Three-value enum: `show` / `trends_only` / `hide`**, persisted as `profiles.weight_surface_mode text`.

Migration: `supabase/migrations/20260503100100_profiles_weight_surface_mode.sql`.

Default: `show` (preserves current behaviour for existing users; no silent regression).

## Rationale

Two binary alternatives were considered:

- **A. Boolean `weight_visible`** (default true) — simplest schema, hardest to extend.
- **B. Three-value enum** (default `show`) — covers a real third intent.

We chose **B** because there's a real user cohort (the diversity audit's eating-disorder-recovery cohort, plus athletes who care about composition trends but not absolute number) for whom "absolute weight = anxiety, but I do want to see directional trends" is the right answer. A boolean collapses that to "all-or-nothing" and forces those users to pick the wrong default.

The three values map to distinct UI behaviours:

- **`show`** — Progress page shows the weight chart with absolute numbers. Digest shows "Weight: 72.4 kg, -0.3 kg this week."
- **`trends_only`** — Progress page shows a normalized trend line (delta from baseline, no absolute axis labels). Digest shows "Weight: trending down ↓ this week" with no kg figure.
- **`hide`** — Both surfaces suppress the weight section entirely. Macro and calorie surfaces are unaffected.

Settings → Goals & Targets exposes the toggle as a three-option radio with copy that names the cohort intent without being clinical. The mobile + web copy was sweep-aligned during T13.

## Alternatives considered

- **Boolean (Option A).** Rejected per above. Misses the trends-only middle case.
- **Hide weight from Digest only, leave Progress unconditional.** Rejected. Inconsistent — a user opts in for one surface but not the other, with no clear mental model.
- **Compute trends server-side and mask client-side.** Rejected. Server-side derivation is right for trends-only, but masking on client risks a flash-of-real-numbers if the mask render is slow. Single source of truth at the `weight_surface_mode` column gating the data flow upstream is cleaner.

## Implementation

- Migration: [`supabase/migrations/20260503100100_profiles_weight_surface_mode.sql`](../../supabase/migrations/20260503100100_profiles_weight_surface_mode.sql).
- Helper: [`src/lib/nutrition/weightSurfaceMode.ts`](../../src/lib/nutrition/weightSurfaceMode.ts).
- Display: [`src/lib/nutrition/weightTrendTile.ts`](../../src/lib/nutrition/weightTrendTile.ts) for the trend-only render.
- UI: Settings → Goals & Targets on web (`src/app/components/Settings.tsx`) + mobile (`apps/mobile/app/(tabs)/settings.tsx`).
- Digest: `src/lib/push/weeklyRecapPayload.ts` (skips weight section per mode).
- Progress: `src/lib/nutrition/progressWeekReport.ts`.
- Tests: `tests/unit/weightSurfaceMode.test.ts`.

## Platforms affected

- **Web:** Settings UI, Progress page weight chart, weekly digest email/push.
- **Mobile:** Settings UI, Progress tab weight chart, weekly recap push.
- **Supabase:** new `profiles.weight_surface_mode` column with default `show`.

## Revisit when

- A user requests "hide weight on Progress only, show on Digest" — that's a fourth value or a per-surface override. Don't extend the enum lightly; the three values cover the documented cohorts.
- Weight is removed from the product entirely (unlikely; tracked as a macro-adjacent metric for adaptive TDEE). The column becomes vestigial.
- A new sensitive metric joins the surface (body fat %, waist measurement). Consider promoting `weight_surface_mode` to a `body_metrics_surface_mode` covering the wider set with the same enum shape.

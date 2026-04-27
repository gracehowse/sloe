# Spec: Weekly fiber + hydration adherence rollups

**Date:** 2026-04-27
**Owner:** Engineering
**Status:** Specced (B1 — post-launch v1.1 backlog)
**Effort:** S (3–4 days, single-engineer push)

---

## Problem

The weekly recap push (and its on-screen Progress page rollup) currently surfaces protein adherence as a percentage of target plus a `daysLogged` count. Users tracking fibre or hydration as a primary goal don't see a parallel signal — they get the same protein-centric story everyone else does. Two adherence metrics are missing:

- **Fibre %**: average daily fibre intake as a percentage of the user's daily fibre target.
- **Hydration ml/day**: average daily hydration plus a "days on target" count.

Both are already tracked in the underlying tables; only the weekly summarisation step is missing.

## Goals

1. Extend the `weeklyRecap` shape to include `fiberAdherencePct`, `avgFiberG`, `hydrationDaysOnTarget`, `avgHydrationMl`.
2. Surface these on the Progress page weekly sub-card alongside protein adherence (web + mobile parity).
3. Add a non-intrusive "Hydration: X / Y ml" + "Fibre: X / Y g" line to the weekly recap push body when those targets are non-zero (suppressed when the user hasn't set the target — never invent values).
4. Cron-route changes are zero-allocation: reuse the existing `nutrition_entries` IN(...) query plus the existing `extra_water_by_day` profile column.

## Non-goals

- New analytic event surfaces for fibre / hydration trends — Phase 2 work.
- Backfill of historical recaps — recaps are forward-looking only.
- Mobile push payload deepLink changes — same `/progress` route as today.

## Data sources

| Field | Source | Already exists? |
|---|---|---|
| Daily fibre (g) | `nutrition_entries.fiber_g` (sum by `(user_id, date_key)`) | Yes — F-79 ingest writes this |
| Daily hydration (ml) | `profiles.extra_water_by_day` (JSONB `{ "YYYY-MM-DD": ml }`) | Yes — F-13 hydration chips persist here |
| Fibre target (g) | `profiles.target_fiber_g` | NO — needs migration |
| Hydration target (ml) | `profiles.target_hydration_ml` | NO — needs migration |

**Migration required:** `supabase/migrations/<TS>_target_fiber_hydration.sql` adds two nullable INTEGER columns to `profiles`. Default null = "no target on file" — recap line is suppressed in that case.

## Implementation sketch

### 1. Migration

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_fiber_g integer,
  ADD COLUMN IF NOT EXISTS target_hydration_ml integer;

COMMENT ON COLUMN public.profiles.target_fiber_g IS
  'Daily fibre target in grams. Null = user has not set a target; weekly recap suppresses fibre line.';
COMMENT ON COLUMN public.profiles.target_hydration_ml IS
  'Daily hydration target in millilitres. Null = user has not set a target; weekly recap suppresses hydration line.';
```

Apply via `supabase db push --linked` (per project rule — never via MCP `apply_migration`).

### 2. Shared library

`src/lib/nutrition/weeklyRecap.ts` — extend `WeeklyRecap` type:

```ts
export interface WeeklyRecap {
  // ...existing
  /** Average daily fibre across logged days. 0 when no entries had fibre data. */
  avgFiberG: number;
  /** Fibre as % of target. 0 when target is null/0 (recap line suppressed). */
  fiberAdherencePct: number;
  /** Average daily hydration ml across the week. */
  avgHydrationMl: number;
  /** Days where logged hydration ≥ 90% of target. 0 when target is null/0. */
  hydrationDaysOnTarget: number;
}
```

`buildWeeklyRecap()` gains two new optional inputs:

```ts
type Input = {
  // ...existing
  hydrationByDay?: Record<string, number>; // ml per dateKey
  targets: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; hydrationMl?: number };
};
```

Math:
- `avgFiberG = sum(byDay[d].fiberG for d in weekKeys if logged) / max(1, daysLogged)`
- `fiberAdherencePct = targets.fiber ? round(avgFiberG / targets.fiber * 100) : 0`
- `avgHydrationMl = sum(hydrationByDay[d] for d in weekKeys) / 7` (rolling avg, not just logged days, since hydration days don't require meal entries)
- `hydrationDaysOnTarget = count(d for d in weekKeys if hydrationByDay[d] ≥ 0.9 * targets.hydrationMl)`

### 3. Cron route

`app/api/push/weekly-recap/route.ts`:

- Add `target_fiber_g`, `target_hydration_ml`, `extra_water_by_day` to `PROFILE_SELECT_COLUMNS`.
- Add `fiber_g` to the `nutrition_entries` select.
- Pass through to `buildWeeklyRecap` via the new optional fields.

### 4. Push body formatter

`src/lib/nutrition/weeklyRecapPushBody.ts` — add a tail line when `fiberAdherencePct > 0` and another when `hydrationDaysOnTarget > 0`:

```
Your week in Suppr
{cascade headline}
{recap sentence}
Protein: {p}% of target · Fibre: {f}% · Hydration: {h}/7 days
```

Suppress fibre/hydration tail when target is unset. Push body length stays under iOS APNs 178-char ceiling — verify with the existing length test.

### 5. Progress sub-card (web + mobile)

`src/app/components/ProgressDashboard.tsx` (web) + `apps/mobile/app/(tabs)/progress.tsx` (mobile):
- Add Fibre + Hydration cells alongside Protein cell on the weekly summary card.
- Use existing `formatMacro` helper for fibre rounding; hydration uses integer ml.
- "—" when target is unset (not "0%" — preserves the F-86 "absence ≠ zero" pattern).

## Tests

- `tests/unit/weeklyRecap.test.ts` — assert new fields populate; assert null targets → 0 / suppression.
- `tests/unit/weeklyRecapPushRoute.test.ts` — extend the existing route test with a fixture user who has fibre + hydration targets set; assert push body line includes fibre / hydration tail; assert null-target users get the unchanged 3-variant body.
- `tests/unit/weeklyRecapPushBody.test.ts` — pin formatter behaviour for: (a) both targets set, (b) only fibre set, (c) only hydration set, (d) neither (fall through to today's body).
- Mobile Progress snapshot test — assert cells render.

## Acceptance criteria

- `npm run ci` green (web + mobile typecheck, vitest, next build).
- Live integration: a profile with `target_fiber_g = 30` + `target_hydration_ml = 2000` + 4 days of entries gets a recap with the fibre + hydration tail; a profile with both unset gets today's unchanged body.
- Progress sub-card on both platforms renders Fibre / Hydration cells with the same styling as the existing Protein cell.

## Risks

- Push body length: APNs hard-caps notification text. Adding the fibre/hydration tail can push past 178 chars on long suggestion variants. Mitigation: emit a shorter suffix when total length would exceed 170 chars.
- Hydration target migration default: shipping null-default is correct (don't invent), but means existing users see "—" until they set a target. UX-acceptable; we have a Settings → Targets surface for this.
- `extra_water_by_day` JSONB shape is user-mutable client-side — defensive parse already in place via `parseWeightKgByDay`-style helper; mirror that for hydration.

## Cross-platform parity

- Migration applies to both platforms (server-side).
- Library extension is in `src/lib/nutrition/` — both web + mobile import from there.
- UI changes ship in lockstep on web + mobile sub-cards.

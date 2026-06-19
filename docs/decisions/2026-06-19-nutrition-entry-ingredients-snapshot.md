# `nutrition_entry_ingredients` snapshot — split AI/photo/voice meals by item

**Date:** 2026-06-19
**Status:** Resolved (pending Grace's `supabase db push --linked` + data-integrity / qa-lead review)
**Area:** Nutrition data / macro-detail / schema
**Ticket:** ENG-751

## Problem

The macro-detail "By ingredient" view derives per-ingredient macros for logged
**recipes** from `recipe_ingredients × portion_multiplier`, reconciled to the
entry's stored total (ENG-748 #10, shared `deriveIngredientBreakdown`). AI / photo
/ voice meals have **no `recipe_id`**: each AI item is committed as its own
`nutrition_entries` row, and its per-item breakdown — the AI-resolved name, the
un-rounded macros, and the per-item `confidence` + `source` — lived only in the
unpersisted AI response. So those entries rendered as a single self-named fallback
line: correct, but lossy. The provenance that makes AI logging trustworthy was
thrown away on commit.

## Decision

Add an **immutable child snapshot table** `nutrition_entry_ingredients` that
persists the AI per-item breakdown at commit time, and teach the shared read
helper to **prefer snapshot rows** over the single-line fallback — gated by a
default-OFF display flag so the data can backfill while dark.

### Table shape

```
nutrition_entry_ingredients
  id          uuid pk default gen_random_uuid()
  entry_id    uuid not null  → nutrition_entries(id) ON DELETE CASCADE
  name        text not null
  calories    numeric  (>= 0)   -- un-rounded, full AI fidelity
  protein     numeric  (>= 0)
  carbs       numeric  (>= 0)
  fat         numeric  (>= 0)
  fiber_g     numeric  (>= 0)
  confidence  numeric  (0..1)   -- < 0.5 (or null) = low-confidence
  source      text             -- 'AI voice' / 'AI photo'
  created_at  timestamptz not null default now()
  index on (entry_id)
```

**Precision:** macros are `numeric`, not the rounded `smallint`/`real` the parent
`nutrition_entries` uses — the whole point is to preserve fidelity the entry
column drops. This matches the `user_saved_meal_items` child-table precedent
(also `numeric` for the same reason).

### RLS — user-owned, default-deny, parent-derived

Ownership is derived via the parent entry's `user_id`, mirroring the EXACT pattern
`user_saved_meal_items` uses against `user_saved_meals` (`exists (select 1 from
public.nutrition_entries e where e.id = … and e.user_id = (select auth.uid()))`).
**SELECT + INSERT only** for the owner. **No UPDATE/DELETE policy** — snapshots are
immutable, and the parent FK `ON DELETE CASCADE` removes them when the entry is
deleted.

### Trust posture

- Every row carries `confidence`. `< 0.5` (or null) is low-confidence; the read /
  render path **flags** it ("Estimated — low confidence") rather than dropping it.
- The write builder **never fabricates**: items the AI returned without a usable
  calorie value are skipped, not zero-filled. Confidence is carried verbatim
  (clamped to `[0,1]`). This is the CLAUDE.md "no invented nutrition values" rule.

### Write path — always-on + defensive (the load-bearing guardrail)

`persistEntryIngredientSnapshot` (shared `src/lib/nutrition/nutritionEntryIngredients.ts`)
runs **AFTER** and **SEPARATELY** from the main `nutrition_entries` write, in a
fire-and-forget `void` with full internal try/catch. It **NEVER throws** and
**can never break the meal log**: a missing table (pre-push), an RLS denial, a
network reject, or a brief FK race with the still-in-flight entry insert all
swallow + log once. This mirrors the journal-persistence resilience posture
(`enqueueJournalUpserts` / "Saved on this device") — the meal-logging path is
data-loss-sensitive history and is not regressed for a non-critical snapshot.

Wired into `commitAiLoggedItems` on both platforms (web `NutritionTracker.tsx`;
mobile `(tabs)/index.tsx`). The write is **always-on** — harmless data capture so
the table backfills while the display gate is off.

### Read path + feature flag (display only)

The shared `deriveIngredientBreakdown` gains an optional `{ snapshots,
preferSnapshot }`. When an entry has snapshot rows AND `preferSnapshot` is set,
those rows take precedence over both the recipe path and the fallback — the entry
splits into one line per item, reconciled to the entry's stored total exactly like
the recipe path. Recipes keep the recipe-derived path; entries with neither keep
the single self-named fallback.

`preferSnapshot` is the **`nutrition_entry_ingredients_v1`** display flag,
**default-OFF** (NOT in `REDESIGN_DEFAULT_ON`; registered in `KNOWN_DEFAULT_OFF_FLAGS`
on both `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`). Flag-OFF
= today's single-line fallback; flag-ON = split. The write path stays always-on
regardless, so data accumulates before the display is ramped.

### Architecture note (why the table supports N rows per entry)

Today each AI item is its own `nutrition_entries` row, so an AI meal of N items is
already N entries — each gets a single high-fidelity snapshot row. The schema and
read path are written to support **N snapshot rows per entry** so a future flow
that aggregates items into ONE entry splits correctly without a second migration.

## Migration + types

- Staged: `supabase/migrations/20260619120000_eng751_nutrition_entry_ingredients.sql`.
  **NOT applied** — per CLAUDE.md, do not `apply_migration` / `db push` from an
  agent. Grace runs `supabase db push --linked`.
- `database.types.ts` is **NOT regenerated** here (it reads the live schema, which
  won't have the table until the push). The explicit `NutritionEntryIngredientRow`
  interface + typed `as` casts at the supabase boundary cover the gap (the
  `profiles.meal_plan_slots` precedent).
- **Post-apply follow-up (ENG-751):** after the push, run `npm run db:types` and
  drop the casts. Tracked here + in code comments — not a silent TODO.

## Alternatives considered

- **Reuse `recipe_ingredients` with a synthetic recipe per AI meal.** Rejected:
  pollutes the recipe catalog with non-recipes, needs cleanup on entry delete, and
  the recipe-ingredient shape has no confidence/source provenance.
- **Stash the breakdown in a `nutrition_entries.metadata` JSONB column.** Rejected:
  not queryable/indexable per-item, no per-row RLS granularity, and harder to
  reconcile + flag confidence cleanly. A child table is the honest relational model.

## Web/mobile parity

Both platforms: shared write helper in `commitAiLoggedItems`; shared read helper
with `preferSnapshot`; flag registered + gated identically; low-confidence flagged
in the ingredient list (web `MacroDetailPanel`, mobile `MacroIngredientList`). No
intentional divergence.

## Tests

`tests/unit/macroIngredientBreakdown.test.ts` (snapshot precedence, flag gate,
reconciliation, low-confidence flag, recipes-unchanged, neither-fallback, 0-macro),
`tests/unit/nutritionEntryIngredients.test.ts` (builder never fabricates, persist
defensiveness), `tests/unit/nutritionEntryIngredientsMigration.test.ts` (table /
FK-cascade / RLS / no-update-delete shape), and the mobile parity pins in
`apps/mobile/tests/unit/macroIngredientBreakdownParity.test.ts`.

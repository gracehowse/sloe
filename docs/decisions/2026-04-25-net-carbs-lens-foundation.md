# Decision log: net-carbs lens — foundation + display rollout SHIPPED (P2-26 + P3-30, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — foundation shipped (P2-26) AND full display rollout shipped (P3-30, in this session per Grace's directive)
**Trigger:** P2-26 + P3-30 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit asked for "first-class net-carbs (carbs - fibre - sugar alcohols) display in tracker + recipe detail when user opts in via Goals."

---

## P3-30 display rollout (added 2026-04-25)

Originally split: foundation in P2-26, display rollout deferred to P3-30. Grace directed me to ship the rollout in-session.

### What landed

**Web:**
- `src/context/AppDataContext.tsx` — added `netCarbsLensEnabled: boolean` + `setNetCarbsLensEnabled` to context. Reads `profiles.net_carbs_lens_enabled` from the `select(...)` chain. Threaded through context value + dependency array.
- `src/app/components/Settings.tsx` — new toggle row "Show net carbs" below the activity-adjusted-calories toggle. Flips `profiles.net_carbs_lens_enabled` via `savePref`. Test ID: `settings-net-carbs-lens-toggle`.
- `src/app/components/suppr/today-dashboard-macro-tiles.tsx` — new optional `netCarbsLensEnabled?: boolean` prop. Carbs tile uses `carbsLabel(fiberCurrent, lensOn)` for the label and `netCarbsForRow(carbsCurrent, fiberCurrent, lensOn)` + `netCarbsForRow(carbsTarget, fiberTarget, lensOn)` for the value/target.
- `src/app/components/NutritionTracker.tsx` — pulls `netCarbsLensEnabled` from `useAppData()` and passes it to the macro tiles.
- `src/app/components/RecipeDetail.tsx` — pulls `netCarbsLensEnabled` from `useAppData()`. The `carbs` entry in the per-serving macro display + the chip strip both use `carbsLabel` + `netCarbsForRow`. Target value also runs through the helper so "Net carbs: X / Y" matches when the lens is on.

**Mobile:**
- `apps/mobile/app/(tabs)/settings.tsx` — new toggle row mirroring the web wording, backed by direct `supabase.from("profiles").update({ net_carbs_lens_enabled: v })`. Test ID: `settings-net-carbs-lens-toggle`.
- `apps/mobile/app/(tabs)/index.tsx` — added local `netCarbsLensEnabled` state + dedicated `useEffect` that fetches it on mount/userId change. Threaded into the macro tiles prop.
- `apps/mobile/components/today/TodayDashboardMacroTiles.tsx` — accepts the same optional prop; carbs tile uses the same shared helpers.
- `apps/mobile/app/recipe/[id].tsx` — local fetch + state for the lens, threaded into the carbs entry of `macroMap`. Helpers refuse "Net carbs" label when fibre is unknown.

### Tests + types

- 59/59 green across `netCarbs`, `coerceRecipeMacrosForPlanning`, `mealPlanAlgo`, `generateMealPlan`, `mealPlanWebMobileParity`, `mealPlanCoercedRowChip`.
- Web `tsc --noEmit` clean.
- Mobile `tsc --noEmit` clean.

### Behavioural note

The lens silently falls back to "Carbs" when fibre is unknown — by design, per the helper's contract. A user who toggles the lens on but is logging recipes without fibre data still sees "Carbs" rather than a misleading "Net carbs: 50g" headline that would equal total carbs anyway. This is the Pillar 2 "never imply precision you don't have" rule applied at the lens layer.

---

## P2-26 foundation (shipped earlier in this session)

---

## Decision

Shipped the **foundation**:

1. **Migration** `supabase/migrations/20260503103000_profiles_net_carbs_lens.sql` — new `profiles.net_carbs_lens_enabled boolean not null default false`. Forward-only safe; existing users see no change.
2. **Shared helper** `src/lib/nutrition/netCarbs.ts` — `netCarbsForRow(carbs, fibre, lensEnabled)` does the math; `carbsLabel(fibre, lensEnabled)` and `carbsShortLabel(...)` switch the displayed string. Both helpers refuse to claim "Net carbs" when fibre is null/undefined/non-finite — Pillar 2 honesty: a "Net carbs: 50g" headline with no fibre data behind it would be misleading precision. The lens silently falls back to "Carbs" in that case rather than fabricating.
3. **Tests** `tests/unit/netCarbs.test.ts` — 8 cases: lens off (3), lens on with fibre (3), lens on without fibre / negative / NaN (4), label switching parity (5).

**Deferred** the display rollout to **P3-30** (new task). Rationale: shipping a Settings toggle without the Tracker / Recipe Detail / Planner / Progress / Weekly Recap rollout creates a UX trap — the user opts in but sees "Carbs" everywhere and assumes the lens is broken. Either the toggle and the surfaces ship together or neither ships. The cleaner sequencing is one focused v1.1 PR that touches all five surfaces in lockstep with the toggle.

The migration applied today is forward-only safe and unused; nothing breaks if the v1.1 PR slips.

## Rationale

The keto-tracking cohort is a real user segment for whom net carbs IS the metric they're optimizing against — total carbs is the wrong number. Shipping the lens correctly is a P2 ("post-launch v1.1") item not because it's unimportant but because it touches enough surfaces that a half-rollout is worse than no rollout.

Why the foundation matters even without the visible feature:
- The migration is committed AND applied; the column is on production today. When the v1.1 PR ships, no migration race.
- The shared helper is reviewed AND tested; the v1.1 PR adds five `netCarbsForRow(...)` / `carbsLabel(...)` call sites and ships.
- The "refuse when fibre is unknown" rule is pinned by tests; the v1.1 PR can't accidentally print "Net carbs: 50g" with no fibre source.

The foundation is ~90 minutes of work. The v1.1 rollout is ~half a day. Doing the foundation now lets the rollout PR be ten lines of UI per surface plus a couple of tests, rather than a full design + math + tests package.

## Alternatives considered

- **Ship the full rollout now.** Considered seriously. Five surfaces × careful edits each = real regression risk. The Tracker is a 1400-line file; touching the carbs tile risks breaking the macro ring. Recipe Detail's nutrition table is dense. Better to land it as a single focused PR after launch when the change is reviewable in isolation.
- **Ship the Settings toggle only, rollout later.** Rejected per the UX-trap argument above. A toggle that does nothing visible is worse than no toggle.
- **Sugar alcohols too (carbs − fibre − sugar_alcohols).** Deferred. No `nutrition_entries.sugar_alcohols_g` column today; adding it is its own decision (do we infer from food source labels? Manual entry only?). v0 ships `carbs − fibre`; sugar-alcohol subtraction is a P4 follow-up if the keto cohort asks for it.

## Implementation

- `supabase/migrations/20260503103000_profiles_net_carbs_lens.sql` — new column.
- `src/lib/nutrition/netCarbs.ts` — three helpers (`netCarbsForRow`, `carbsLabel`, `carbsShortLabel`).
- `tests/unit/netCarbs.test.ts` — 8 tests covering lens-off, lens-on-with-fibre, lens-on-without-fibre / refusal, label switching.
- New task **P3-30** — display rollout.

Web + mobile `tsc --noEmit` clean.

## Platforms affected

- **Supabase:** new boolean column on `profiles`, default false. Apply via `supabase db push --linked` (NOT MCP).
- **Web / Mobile:** zero behavioural change today. Helpers exist but no surface consumes them yet.

## Verification

- `tests/unit/netCarbs.test.ts` — 8/8 green.
- Migration is idempotent (`add column if not exists`); safe to re-run.
- Helper is pure, no side effects, tested at the boundary cases (null, undefined, NaN, negative net).

## Related artefacts

- [Opus 4.7 codebase review §6.3](../audits/2026-04-25-opus47-codebase-review.md) (P2-26 entry)
- [`src/lib/nutrition/netCarbs.ts`](../../src/lib/nutrition/netCarbs.ts)
- [`supabase/migrations/20260503103000_profiles_net_carbs_lens.sql`](../../supabase/migrations/20260503103000_profiles_net_carbs_lens.sql)
- Follow-up: **P3-30** — Net-carbs lens display rollout (Settings + Tracker + Recipe Detail).

## Revisit when

- P3-30 ships → flip this doc's status to "Foundation shipped + display rolled out".
- A user requests sugar-alcohol subtraction → add `nutrition_entries.sugar_alcohols_g` column + extend the helper signature.
- Net carbs becomes the default for a non-keto cohort (e.g. medical / clinician users) → consider promoting to a profile-level dietary mode rather than a single boolean.

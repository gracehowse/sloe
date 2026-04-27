# Decision log: enforce wouldCoerceMacros at every nutrition_entries write path (P0-3, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P0 #3 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit said `wouldCoerceMacros` had no consumer at any journal-write site. **This was wrong** — the planner write paths (`onLogPlanMeal` web, `logPlannedMealWithPortion` mobile) already call `fetchPlannedMealMicros` and refuse on `macrosAreCoerced`. The verifier missed it because it grepped `wouldCoerceMacros|isCoerced` and the field is named `macrosAreCoerced` at the consumer site. P0-3 closes the **one** real gap that did exist: the mobile recipe-detail "Add to Today" CTA, which writes from an in-memory ingredient sum and had no guard.

---

## Decision

Every `nutrition_entries.insert` site is now either:

1. **Guarded inline** — calls `wouldCoerceMacros()` or `fetchPlannedMealMicros()` and refuses to insert when fabricated macros would be persisted.
2. **Guarded upstream** — wrapped by a caller that calls the guard (e.g. web `addLoggedMeal` runs through `useNutritionJournalState.ts`; the upstream guard layer is `NutritionTracker.tsx::onLogPlanMeal`).
3. **Allow-listed by provenance** — the data source makes coercion impossible (HealthKit, barcode → OFF/USDA pipeline that already passes through Atwater plausibility, copy-from-existing-rows bulk inserts).

The full inventory is documented in `docs/product/nutrition-approximation-policy.md` §A1 and pinned by `tests/unit/nutritionEntriesGuardInventory.test.ts`. **Adding a new insert site fails the inventory test until the author either guards inline, documents an upstream guard, or adds a provenance entry.**

## Rationale

The 2026-04-24 sweep (T4) put `coerceMacrosWhenCaloriesButNoGrams` behind an explicit policy: **planner-display only, never persisted to journal**. The planner paths shipped the guard at that time. The recipe-detail mobile CTA was a separate code path the original guard sweep missed; it computed macros from a local ingredient sum and could legitimately produce a coercion-eligible shape if a recipe was imported from a kcal-only source (e.g. an Instagram caption import).

Closing this loop requires three pieces:

- **The guard itself** at the recipe-detail flow. Done — calls `wouldCoerceMacros(scaledForLog)` and routes the user to `/recipe/verify?id=<id>` when it triggers.
- **A test that pins the inventory of guarded paths.** Done — `nutritionEntriesGuardInventory.test.ts` reads each known insert site, verifies the actual `from("nutrition_entries").insert` call is present, and asserts either the guard pattern or an allow-listed provenance.
- **Documentation that future contributors will read.** Done — `nutrition-approximation-policy.md` §A1 now lists each refused surface, each allow-listed surface, and the rationale for each.

## Alternatives considered

- **Persist coerced macros with a `is_coerced` flag column on `nutrition_entries` and surface "estimated" in the journal UI.** Rejected. CLAUDE.md non-negotiable: "If nutrition is uncertain, do not guess." A 28/42/30 split is fabrication at write time; surfacing it as "estimated" still puts arbitrary numbers in the user's health log and degrades the trust of every downstream surface (weekly recap, deficit projection, adaptive TDEE). The verify-first route preserves the data-integrity contract.
- **Run the guard inside the supabase client wrapper instead of at each call site.** Rejected for now. The guard needs context-specific UX (which Verify CTA to surface, what slot to pass through, etc.) that a generic wrapper can't provide. The inventory test gives us the same regression-protection guarantee with much less indirection.
- **Defer the planner-row "estimated · verify" chip to v1.1.** Accepted. The journal-write refusal closes the correctness gap. The chip is a visual-honesty enhancement (Pillar 2 "never imply precision you don't have") and tracked as **P1-19** in the launch backlog.

## Implementation

- `apps/mobile/app/recipe/[id].tsx` — added `wouldCoerceMacros` import; `addRecipeToTodayJournal` checks `scaledForLog` against the helper before insert; on trigger, surfaces an Alert routing to `/recipe/verify?id=<id>`.
- `tests/unit/nutritionEntriesGuardInventory.test.ts` — new meta-test. Inventories the 5 known `nutrition_entries.insert` files, asserts each is guarded inline, guarded upstream, or allow-listed. **5/5 green.**
- `docs/product/nutrition-approximation-policy.md` §A1 — expanded "Refused surfaces" to include recipe-detail (mobile); added an "Allow-listed surfaces" subsection enumerating HealthKit, barcode, copy/duplicate paths; reframed the planner-display chip as a tracked P1 follow-up rather than an open gap.

## Platforms affected

- **Mobile:** `apps/mobile/app/recipe/[id].tsx::addRecipeToTodayJournal` is now guarded. Same UX pattern as the existing `logPlannedMealWithPortion` guard in `apps/mobile/app/(tabs)/index.tsx`.
- **Web:** no change needed. `RecipeDetail.tsx` has no direct journal-log CTA; web users reach the journal via `NutritionTracker.tsx::onLogPlanMeal` which is already guarded.
- **Supabase:** none.

## Verification

- `tests/unit/nutritionEntriesGuardInventory.test.ts` 5/5 green.
- Sibling tests `tests/unit/coerceRecipeMacrosForPlanning.test.ts` (10) + `tests/unit/plannedMealMicros.test.ts` (11) + `tests/unit/totalGramsForVerifyScale.test.ts` (13) all green — 39/39 across the nutrition-honesty surface.
- Mobile `tsc --noEmit` clean for touched file.
- Web `tsc --noEmit` clean (no web changes).

## Related artefacts

- [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list)
- [Nutrition approximation policy §A1](../product/nutrition-approximation-policy.md#a1--macro-coercion-for-kcal-only-recipes-coercemacroswhencaloriesbutnograms)
- [P1-19 follow-up — planner-row "estimated · verify" chip](#) (tracked as a Notion task; not yet a separate decision doc)

## Revisit when

- A new `nutrition_entries.insert` site is added. The inventory test fails until the author updates `tests/unit/nutritionEntriesGuardInventory.test.ts` with the guard or provenance.
- The macro-coercion threshold (`MACRO_COERCION_THRESHOLD = 0.45`) changes — confirm the `wouldCoerceMacros` cheap-check still fires for the same shapes the planner coerces.
- A web recipe-detail "Add to Today" CTA ships — it will need the same inline guard pattern as mobile.

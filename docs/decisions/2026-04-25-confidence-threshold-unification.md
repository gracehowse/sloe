# Decision log: ingredient-confidence threshold unification (P1-8, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #8 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit flagged a silent zone where the recipe-level mean nudge (0.45) didn't agree with the per-line "needs review" badge (0.50), with a duplicate of the per-line constant in mobile that the team kept in sync by hand.

---

## Decision

`verifyConfidencePolicy.ts` is now the single source of truth for ingredient-confidence policy. It exports three thresholds:

| Constant | Value | Role |
|---|---|---|
| `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` | **0.50** | Per-line "needs review" badge in the verify UI. |
| `INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD` | **0.50** | Recipe-level mean nudge — soft "review suggested" CTA at top of verify. **Bumped from 0.45 in P1-8** to match the per-line bar. |
| `INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD` | **0.20** | If any single line is below this, always nudge — one bad line can dominate kcal even when the mean looks fine. Unchanged. |

`verifyIngredients.ts` re-exports `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` from the canonical home so existing call sites don't have to change their imports. The mobile duplicate in `apps/mobile/lib/verifyRecipe.ts` is now also a re-export — the "keep in sync" comment is gone, replaced by `import` + `export` from the same `verifyConfidencePolicy` module.

Acceptance gates (`MIN_MATCH_CONFIDENCE = 0.42`, `MIN_OFF_CONFIDENCE = 0.52`) remain in `verifyIngredients.ts`. They serve a different role — they decide whether to accept a candidate match at all, before any UI threshold applies. Conflating them with the review thresholds would change the meaning, not just the value.

## Rationale

The pre-fix split created a real silent zone: a recipe with mean confidence 0.46 saw the per-line "needs review" badge on every borderline line (because per-line bar was 0.50) but **no** recipe-level "review suggested" CTA at the top of the screen (because the mean cleared the 0.45 bar). The user got a wall of badges with no top-level action prompt — confusing UX and a partial CLAUDE.md non-negotiable violation ("if nutrition is uncertain, do not guess").

The fix doesn't lower acceptance — borderline matches still pass through `MIN_MATCH_CONFIDENCE = 0.42`. It tightens the **review** prompt so per-line and recipe-level surfaces never disagree about whether the recipe is borderline.

Effect on existing recipes: any recipe with mean per-line confidence between 0.45 and 0.50 will now also see the recipe-level review CTA. Existing recipes above 0.50 mean are unaffected. Below 0.45 was already nudged.

## Alternatives considered

- **Lift the unified threshold to 0.55 (audit suggestion).** Rejected for now. Raising the per-line bar would surprise existing users with new "needs review" badges on recipes that previously appeared clean. The audit's 0.55 was a forward-looking recommendation; meeting in the middle (0.50) closes the silent zone without disturbing the per-line UI behaviour the team has already shipped.
- **Lower the per-line bar to 0.45.** Rejected. The existing per-line UI was tuned at 0.50; lowering it would dilute the badge.
- **Keep both numbers separate, document the silent zone.** Rejected. Pillar 2 ("never imply precision you don't have") is materially weakened when the two surfaces disagree on whether the same recipe is borderline.

## Implementation

- `src/lib/nutrition/verifyConfidencePolicy.ts` — promoted to canonical home. Now exports three constants + `ingredientVerifyNeedsReview`. Mean threshold derives from per-line constant (`INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = RECIPE_INGREDIENT_REVIEW_CONFIDENCE`) so a future change can't desync them by accident.
- `src/lib/nutrition/verifyIngredients.ts` — old `export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5` deleted; replaced with `export { RECIPE_INGREDIENT_REVIEW_CONFIDENCE } from "./verifyConfidencePolicy"`.
- `apps/mobile/lib/verifyRecipe.ts` — duplicate `export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5` deleted; replaced with `export { RECIPE_INGREDIENT_REVIEW_CONFIDENCE } from "../../../src/lib/nutrition/verifyConfidencePolicy"`. The "keep in sync" comment removed.
- `tests/unit/verifyConfidencePolicy.test.ts` — added P1-8 assertions: per-line equals mean, mobile re-export equals canonical, min still well below the unified bar, recipe averaging 0.46–0.49 now triggers review (silent-zone closure). **7/7 green.**

## Platforms affected

- **Web + Mobile:** recipe-verify screen will now show the recipe-level "review suggested" CTA for any recipe with mean per-line confidence in (0, 0.50). Per-line badges unchanged.
- **Supabase:** none — pure client policy.

## Verification

- `tests/unit/verifyConfidencePolicy.test.ts` — 7/7 green (3 pre-existing + 4 new P1-8).
- `tests/unit/confidenceGating.test.ts` — 21/21 green (no regressions to acceptance-gate behaviour).
- Web `tsc --noEmit` clean for touched files.
- Mobile `tsc --noEmit` clean for touched files.

## Related artefacts

- [Opus 4.7 codebase review §3.1](../audits/2026-04-25-opus47-codebase-review.md#31-confidence-threshold-inconsistency-042050-silent-acceptance)
- [2026-04-24 full-sweep audit C6](../audits/2026-04-24-full-sweep.md) — original threshold-mismatch finding
- [src/lib/nutrition/verifyConfidencePolicy.ts](../../src/lib/nutrition/verifyConfidencePolicy.ts) — canonical home

## Revisit when

- Field telemetry (Sentry, PostHog) shows the mean nudge firing too often (false-positive review prompts). Consider lifting both numbers to 0.55 in lockstep.
- A new ingredient-source ranker is added (e.g. a Suppr custom-foods pipeline). Confirm its acceptance gate stays above `MIN_MATCH_CONFIDENCE = 0.42` and below the review threshold.
- The recipe-import path stops using `verifyConfidencePolicy.ts` (e.g. moves to a different policy file). The test pin will fail — update both.

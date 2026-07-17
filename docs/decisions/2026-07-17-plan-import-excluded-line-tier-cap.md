# Plan Import — cap the displayed tier on excluded lines; surface the count (ENG-1422)

**Date:** 2026-07-17
**Ticket:** ENG-1422
**Status:** Shipped. Tier cap = unflagged server logic; count surfacing behind `plan_import_excluded_lines_v1` (default-ON, PostHog kill switch)
**Platforms:** web (`PlanImportReview`) + mobile (`app/plan-import.tsx`) — shared cap helper + shared stat

## Problem

Plan Import computes a per-recipe confidence tier from
`VerifyResult.avgIngredientConfidence`. Since ENG-1305 that average describes
the **accepted rows only** — the rows that cleared `MIN_ACCEPT_CONFIDENCE`
(0.55) and were summed into the Sloe-calc totals. Below-floor rows
(`belowAcceptFloor: true`, counted in `belowAcceptFloorCount`) are excluded
from both the totals and the average.

That made the tier an **inverted trust signal**: dropping more junk/unmatched
lines can *raise* the surviving average, so a **more incomplete** recipe reads
at a **higher** displayed confidence than a fully-matched one. A recipe with a
0.95 line and four excluded lines could show the same "high" as a clean recipe —
or higher than a fully-matched recipe averaging 0.72.

Plan Import was the surface where this bit hardest: unlike the recipe-verify
screen (which already folds `belowAcceptFloorCount` into a review nudge via
`ingredientVerifyNeedsReview` / `verifyJsonNeedsReview`), Plan Import had **no**
excluded-line surfacing at all — the tier was the only signal, and it lied.

## Decision

### 1. Cap the displayed tier on the excluded-line count

New shared helper `recipeConfidenceTierWithExclusions(avg, belowAcceptFloorCount,
acceptedLineCount)` in `src/lib/nutrition/verifyConfidencePolicy.ts`, called by
both Plan-Import verify paths (`app/api/plan-import/parse/route.ts` and the
shared `src/lib/planning/planImport/verifyImportRecipe.ts`, which cookbook
import also uses):

- **no excluded lines** → the raw accepted-average tier (may be "high").
- **some, but under half the recipe** → never "high" — capped at **"medium"**
  (a "low" average still reads "low").
- **at least half the recipe's lines gone** → **"low"** — the headline is
  missing at least as much food as it counts, so the surviving matches can't
  earn better than the floor.

**Invariant** (at a fixed accepted-average and accepted-line count): the tier
is monotonically **non-increasing** in `belowAcceptFloorCount` — more excluded
lines can only hold or lower it, never raise it. With a three-value ladder the
step can't be strictly-distinct per count, so the guarantee is "never higher",
not "always strictly lower". That is enough to kill the inversion.

`acceptedLineCount` is shared with the stats computation via
`acceptedLineCount(result)` in `verifyIngredients.ts` — one definition of
"accepted rows" for both the average and the cap, so they can't drift.

### 2. Surface the excluded-line count to the user

`PlanImportVerifiedRecipe.excludedLineCount` carries the per-recipe count;
`planImportStats(slots, recipes)` sums it **once per recipe** (a recipe used by
several slots counts once) into `stats.excludedLineCount`. The review screen
renders a calm amber advisory when it's > 0:

> **N low-confidence line(s) left out of these totals — review before importing.**

Same copy voice as the recipe-upload review nudge ("review low-confidence
lines"). Amber `text-warning-solid` / `Accent.warningSolid` (the product-wide
warning family — never destructive red). It informs; it does not block import.

## Why the split flag posture

- The **tier cap** is pure server logic and has **no current visual surface**
  (the tier isn't rendered in the review, and isn't persisted at commit — it
  drives only the transient slot confidence). Per the feature-flag rule it is a
  bug fix with no visual surface → **unflagged**. It is the correct behaviour;
  reverting it would re-introduce the inverted signal.
- The **count surfacing** is a net-new visible element → gated by
  `plan_import_excluded_lines_v1`. Because it is a trust/safety correction at
  N=1, it ships **default-ON** (registered in `REDESIGN_DEFAULT_ON` on both
  platforms) with the PostHog row as the kill switch — the same posture as
  `trust_source_name_v1` and `import_review_flagged_ingredients_v1`. Flag-OFF =
  today's render exactly (no count line).

The server always returns `excludedLineCount` regardless of the flag; the flag
only gates whether the client renders it.

## Explicitly out of scope

- The accept floor `MIN_ACCEPT_CONFIDENCE = 0.55` and the exclusion mechanism
  (ENG-691 / ENG-1305) are unchanged — this only reads `belowAcceptFloorCount`.
- No parser/extractor/nutrition recompute.
- The recipe-verify and voice/photo-log tiers keep the raw
  `recipeConfidenceTier` (they surface exclusions through the review nudge
  instead) — applying the cap there is a possible follow-up, not this ticket.

## Tests

- `tests/unit/recipeConfidenceTier.test.ts` — `recipeConfidenceTierWithExclusions`
  boundary + monotonicity + half-excluded → low + non-finite-count pins.
- `tests/unit/verifyImportRecipe.test.ts` — cap + `excludedLineCount` surfacing
  through the shared verify path.
- `tests/unit/planImportCompile.test.ts` — `stats.excludedLineCount` summed
  once per recipe.
- `tests/unit/planImportSurface.test.tsx` — web advisory renders (plural +
  singular), hides at count 0, hides with the flag off.
- `apps/mobile/tests/unit/planImportExcludedLinesParity.test.ts` — cap helper
  reachable + identical via the mobile alias; mobile screen surfaces the count
  behind the flag with matching copy.
- `tests/unit/planImportExcludedLinesFlagParity.test.ts` +
  `tests/unit/redesignDefaultOnParity.test.ts` — flag shared default-ON on both
  platforms.

## Follow-up

Default-ON visual change → wants a sim/web glance before wider ramp. Consider
applying the same cap to the recipe-verify / log-refine tiers so the trust
signal is consistent across every import surface (separate ticket).

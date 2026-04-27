# Decision log: allergen surfacing v0 — populate strategy (T12, retroactive 2026-04-25)

**Date:** 2026-04-24 (decision); 2026-04-25 (doc backfilled per P1-17)
**Status:** Resolved (shipped as commit `5fdccd3`)
**Trigger:** T12 / Phase 2 condition #10 of [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md). Closes DI-P0-01 from the [diversity inclusion audit](./2026-04-19-diversity-inclusion-audit.md). The 14 regulated allergens (UK FSA / EU FIC) needed first-class surfacing on recipe detail pages so users with declared allergies could trust the app, and to satisfy the consumer-protection floor for any UK / EU public launch.

---

## Decision

**Auto-populate `recipes.allergens text[]` from confident ingredient matches** during the recipe verify flow, with a "Contains:" callout on the recipe detail page. User-edit override is a Phase 3 follow-up; v0 ships read-only.

Three options were considered for the populate strategy:

- **A. Confident-match auto-population** — derive allergens from the verified ingredient list using the canonical allergen list at `src/constants/regulatedAllergens.ts`. Only confident (≥ `RECIPE_INGREDIENT_REVIEW_CONFIDENCE`, post-P1-8 = 0.50) lines contribute. Lines below threshold are excluded from the allergen set AND surface a "review suggested" prompt.
- **B. User-input only** — recipe author manually selects allergens at upload time.
- **C. Both, in lockstep** — system suggests, user confirms.

We chose **A** for v0.

## Rationale

User-input only (B) sounds safer but in practice fails the use case: a user importing a recipe from Instagram doesn't want to think about allergens; they want the app to know. The error mode of B is "user forgets to mark gluten on a pasta recipe → another user with coeliac eats it" — strictly worse than the error mode of A ("low-confidence ingredient match means an allergen wasn't auto-derived → user gets a review nudge").

C is the right answer at v1 maturity but doubles the testing surface for v0. v0 ships A; v1 layers in user-edit override on top. The auto-populate logic at `src/lib/nutrition/inferAllergens.ts` is intentionally separate from the UI layer, so adding edit-override later doesn't require re-architecture.

The confidence threshold gate (≥ 0.50 per P1-8 unification) is the load-bearing safety: an unconfident ingredient match (e.g. "some pasta") returns no allergen contribution rather than a wrong contribution. Combined with the "needs review" nudge on coerced rows (P0-3), the user has a clear path to verify the recipe before relying on the allergen callout.

## Alternatives considered

- **B (user-input only).** Rejected. Creates a class of false-negative ("user forgot to mark") that's worse than the auto-populate false-negatives.
- **C (suggest + confirm).** Deferred to v1. Worth doing once the allergen-edit UI ships.
- **Cross-reference user `dietary_restrictions` and ban serving the recipe.** Rejected for v0. Banning is heavier than warning; the regulated-allergen stance is "inform" not "block." Can layer a stronger gate when a user opts into "strict mode" (P3 territory).

## Implementation

- Migration: [`supabase/migrations/20260503100200_recipes_allergens.sql`](../../supabase/migrations/20260503100200_recipes_allergens.sql).
- Inference: [`src/lib/nutrition/inferAllergens.ts`](../../src/lib/nutrition/inferAllergens.ts).
- Constants: [`src/constants/regulatedAllergens.ts`](../../src/constants/regulatedAllergens.ts) (14 regulated allergens with multi-language tokens).
- UI: "Contains:" callout in `src/app/components/RecipeDetail.tsx` and `apps/mobile/app/recipe/[id].tsx` (read-only v0).
- Onboarding: dietary-restrictions step now shows the 14 regulated allergens as opt-in checkboxes; matches what the recipe surface promises to detect.
- Tests: `tests/unit/inferAllergens.test.ts`.

## Platforms affected

- **Web:** `RecipeDetail` callout, onboarding restrictions step.
- **Mobile:** same callout in `apps/mobile/app/recipe/[id].tsx`, same onboarding step in `apps/mobile/app/onboarding.tsx`.
- **Supabase:** new `recipes.allergens text[]` column; populated by the verify flow on import + on each successful re-verify.

## Revisit when

- A user reports an allergen miss (i.e. the ingredient was confidently matched but the allergen wasn't derived) — extend the token set in `regulatedAllergens.ts`.
- v1 user-edit override ships — extend the read-only callout to a "Contains: dairy, eggs (you added: nuts)" shape.
- Strict-mode "block recipe served if user has restriction" ships — gate the recipe in the discover feed, not just on the detail page.
- Regulator updates the regulated-allergen list (e.g. sesame was added in 2014; another addition could come). Update `regulatedAllergens.ts`.

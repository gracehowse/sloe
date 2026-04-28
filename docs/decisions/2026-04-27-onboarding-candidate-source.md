# Onboarding candidate source — hand-picked seed (2026-04-27)

**Status:** Resolved (2026-04-27)
**Area:** Product
**Owner:** product-lead → executor + nutrition-engine
**Unblocks:** B2.3 — D-2026-04-27-14 ("Onboarding produces first plan") finish.

---

## The decision

**Option B — hand-picked onboarding seed table (~15 recipes, JSON-committed, not a DB table).**

Concretely: `apps/mobile/lib/onboardingSeeds.ts` + web mirror at `src/lib/onboarding/onboardingSeeds.ts`, both importing the same JSON constant typed as `OnboardingSeed[]`. Seeds resolve to existing `recipes` rows by `slug` at render time so the library save creates a normal `saved_recipes` relation — no special-case API.

Considered and rejected:
- **Option A (Discover catalog query)** — Discover has near-zero published volume (N=1 tester). Ranking on a thin catalog produces a thin, repetitive picker. The first cooking commitment can't carry that.
- **Option C (Hybrid)** — two paths to maintain, fallback logic that fires on the most fragile users (strict dietary filters), complexity for ambiguous gain. Hedging is the failure mode the strategic challenge doc explicitly calls out.

## Why this beats the alternatives

This is the user's first cooking commitment. Per D-2026-04-27-04, the north-star moment is "what to eat next from your library that hits your remaining macros" — and that requires a library that *actually fits the user* on day one. Three reasons:

1. **Discover (A) cannot carry first-impression weight today.** Featured/curated columns in the wrong table is just option B with extra plumbing. Ranking on a thin catalog (most-saved, recent) is noise.
2. **Hybrid (C) is the worst of both.** Two paths, fallback logic, complexity for ambiguous gain. The strategic challenge doc calls hedging the failure mode.
3. **JSON beats a new table.** ~15 recipes, edited rarely, version-controlled with onboarding copy, no migration, no RLS surface, no admin UI. If the seed list grows past ~50 or needs non-engineering edits, *then* it earns a table.

## Tradeoffs accepted

- **Scale story (lost vs A):** doesn't auto-improve as Discover grows. Acceptable — Discover isn't growing yet, and onboarding shouldn't index on volume.
- **Variety per session (lost vs C):** every onboarding user sees the same ~15. Acceptable at N=1; revisit at N>50.
- **Maintenance overhead:** ~quarterly review. Cheap. Owned by nutrition-engine.

## The candidate set (15 recipes, concrete)

Balanced across cuisine, prep time, macro shape, dietary flags:

1. Sheet-pan harissa chicken + chickpeas (45g protein, 30 min, gluten-free)
2. Miso salmon with greens (38g protein, 20 min, pescatarian, GF)
3. Beef ragu with pappardelle (35g protein, 40 min, omnivore comfort)
4. Halloumi + roast veg traybake (28g protein, 35 min, vegetarian)
5. Chicken katsu rice bowl (42g protein, 30 min, omnivore weeknight)
6. Black bean + sweet potato chilli (22g protein, 35 min, vegan, high-fibre)
7. Greek yoghurt overnight oats with berries (25g protein, 5 min prep, breakfast)
8. Smoked salmon + scrambled egg bagel (32g protein, 10 min, breakfast)
9. Tofu + peanut soba bowl (24g protein, 25 min, vegan)
10. Steak + chimichurri with new potatoes (45g protein, 25 min, omnivore higher-fat)
11. Spicy turkey lettuce cups (35g protein, 20 min, low-carb)
12. Chickpea + spinach curry with basmati (18g protein, 30 min, vegan, budget)
13. Cottage cheese + tomato pasta (30g protein, 20 min, high-protein vegetarian)
14. Korean chicken rice bowl (40g protein, 30 min, omnivore weeknight)
15. Lentil bolognese (24g protein, 35 min, vegan, batch-cookable)

Coverage: 5 omnivore, 4 vegetarian/vegan, 2 pescatarian, 4 GF. Prep times 5–45 min. Protein 18–45g. One breakfast, one batch-cook, one comfort, one low-carb. No allergen-heavy outliers (no peanuts in core, tree-nut-free, no shellfish).

## Implementation

**Owner:** executor (UI + JSON), nutrition-engine (recipe verification + any missing-row migration).

**Acceptance criteria:**
1. `onboardingSeeds.ts` exists in mobile and web, identical content, typed as `OnboardingSeed[]`.
2. All 15 slugs resolve to `recipes` rows where `published=true` and macros are verified.
3. Picker filters by user's diet/allergen flags; falls back to unfiltered if <6 results (better than empty).
4. Selecting 5 writes to `saved_recipes` via the existing library save path (no special-case API).
5. Today's "what to eat next" reads them via the standard library query — verified end-to-end on first launch.
6. Web `/onboarding` and mobile `app/onboarding.tsx` use the same seed list (parity rule).
7. Tests: vitest covers filter-fallback logic on both platforms; one e2e covers "complete onboarding → Today shows suggestion from saved seed."

**Schema:**
- **No new DB schema.** No `onboarding_recipe_seeds` table. No `featured_at` column.
- If nutrition-engine audit reveals any of the 15 slugs missing as `recipes` rows, stage a one-time seed migration at `supabase/migrations/<TS>_onboarding_seed_recipes.sql` — Grace runs `supabase db push --linked`. **No MCP `apply_migration`** per CLAUDE.md.

## Reconsider on

Open this question again when **any** of:
- (a) Discover catalog crosses 200+ verified published recipes.
- (b) Onboarding completion rate drops below 70% with the seed-picker as the suspected drop point.
- (c) Tester base grows past 50 and we have meaningful diet-filter coverage gaps in the seed.
- (d) A paid acquisition campaign requires per-cohort seed lists.

## Cross-references

- Source: production design spec Surface F at `docs/specs/2026-04-27-production-design-spec.md`.
- Strategic decision parent: `docs/decisions/2026-04-27-strategic-direction.md` D-2026-04-27-14.
- Phase 3 partial landing: `docs/journeys/onboarding-final-step-2026-04-27.md`.

# Keep Today as the centre; "premium food intelligence" is the marketing frame, not an IA change

**Date:** 2026-06-13
**Area:** Product strategy / information architecture / positioning
**Status:** Resolved
**Decision owner:** Grace (product), informed by a product-lead / growth-strategist / competitor-intelligence panel + an external investor/HoP-style design review.

## Trigger

An external reviewer (investor / Head-of-Product tone) scored Sloe's screens (Recipe 9, Planning 8.5, Visual 8.5 vs **Tracking 7**) and argued the app has **"two personalities"** — a premium lifestyle product (Recipes / Planner / Shopping) and a calorie tracker (Today dashboard / rings / log sheet). Their prescription: reposition as a **"premium food intelligence platform"** and **demote / de-centre the calorie dashboard** ("why is the most boring feature getting the most prominent screen? Calorie dashboards are a solved problem; your planner/recipe ecosystem is not").

## Decision

**Accept the craft diagnosis. Reject the strategic conclusion.** These are not the same thing.

- The reviewer is **right** that Today (ring, macro tiles, meal rows, log sheet) reads a tier below the Recipe detail and Planner — the 9-vs-7 gap is honest, and the "two personalities" first-open seam is real. "Premium food intelligence" is also the **stronger acquisition frame** for TikTok/IG top-of-funnel (Reel-import is the lead wedge).
- The reviewer is **wrong** that the fix is to demote Today. That misreads the retention engine. Recipes/Planner are the **weekly ritual + viral spread**; the daily logging loop on **Today is the retention heartbeat (the return)**. Demoting it reproduces the **Julienne** failure mode at scale — beautiful recipe-saver, 4.8★ from ~24 ratings, no retention curve: strong install, dead D7/D30. The ratified 2026-04-27 macro-tracker-spine / canonical-Today direction stands; a visual-craft review is not evidence strong enough to reverse a strategic IA decision.

**The synthesis: it's a cohesion-and-craft problem, not a positioning/IA problem.** Make Today *earn* its premium tier so the seam closes through craft — not tab surgery. **Acquire on the spread, retain on the loop.** The `NorthStarBlock` ("what to eat next") is the architectural bridge that already pulls recipes into the daily loop, personalised to remaining macros.

## What changes

- **Positioning:** marketing/acquisition story = "premium food intelligence" (beautiful recipes, Reel-import, planning that fits the foods you love into your goals). Product/IA reality = tracker-first, canonical-Today. Connective copy = the ratified "fit the foods you love into your plan" (restriction → permission). Guardrail: any "intelligence" framing keeps "estimated"/visible-confidence — never Cal AI confident-but-unverified.
- **Today's role** upgrades from "competent macro dashboard" → "premium food-intelligence surface where the daily loop lives": where am I (ring + macros), what fits next (NorthStar photo hero — the differentiator's home), what did I eat (legacy per-slot rows, per Grace's 2026-06-13 ENG-1091 call).

## Prioritised moves (the actual program)

1. **Close the craft gap on Today's tracker half** — the highest-leverage move and what the reviewer scored 7. Brief `ui-product-designer`: "the ring, macro tiles, meal rows, log sheet must feel as craft-complete as the Shakshuka recipe detail." Subtractive cohesion + craft, **not** new cards (Today's `index.tsx` is 5,400+ lines, just calmed). → ENG issue.
2. **Make the NorthStar photo hero the loudest reason Today exists** — it **already defaults on** (`today_meals_figma_654` ∈ `REDESIGN_DEFAULT_ON`); this is verify-rendered-on-a-populated-account + tighten visual weight + test promoting it higher in the stack (route position to `journey-architect`). NOT a flag flip.
3. **Reframe acquisition + onboarding copy** to "premium food intelligence" / "fit the foods you love into your plan" (marketing only, no IA change). MFP-refugee onboarding frames Sloe as "tracks your macros AND suggests recipes from your library." Route to `brand-manager` + `growth-strategist`.
4. **Instrument the bridge funnel** (PostHog): NorthStar shown → recipe detail opened → meal logged. The empirical test of the whole thesis; de-risks the N=1 retention bet. Route findings to `journey-architect`.
5. **Validate the empty/sparse-day NorthStar path** (gated on library size / `hasEverLoggedAnyMeal`) so a new account doesn't get an empty block as Today's hero.

## What NOT to do

- Do **not** change tab order or the default landing tab (canonical-Today is ratified).
- Do **not** add chrome to Today to "make the bridge louder" — subtractive cohesion only.
- Do **not** suppress the actual calorie/macro numbers behind friendly copy — the permission reframe is *additive* headline copy; MFP refugees need the numbers.
- Do **not** let "food intelligence platform" marketing quietly migrate the IA toward recipes-first (the Julienne/Whisk slide).
- Do **not** drop "estimated"/confidence language under an "intelligence" frame.

## Confidence & the one real uncertainty

**8.5/10.** The daily-loop-as-retention-moat is sound theory + strong category evidence (Julienne, recipe-saver churn), but it is **unmeasured for Sloe at N=1**. The bridge funnel (move 4) is how we test it; revisit on post-launch retention data. If D7/D30 says recipes drive return more than the daily loop, this decision gets re-opened with evidence — not before.

## Related
- `project_julienne_competitive_pattern` (the retention counter-evidence)
- `project_suppr_positioning` ("love food AND have goals")
- `project_strategic_direction_2026-04-27` (macro-tracker spine, canonical Today)
- `project_viral_growth_strategy` (Reel-import = the spread)

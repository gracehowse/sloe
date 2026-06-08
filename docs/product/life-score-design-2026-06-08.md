# Life-Score design brief (ENG-992) — "health, not just calories"

- **Date:** 2026-06-08 · **Area:** Product / Progress · **Status:** v1 design proposal (read-only)
- **Owner:** product-lead (this brief) + `nutrition-engine` (inputs) + `diversity-inclusion` (framing) sign-off pending
- **Source:** `docs/research/2026-06-08-lifesum-teardown.md`; grounded against `apps/mobile/app/(tabs)/progress.tsx` + the nutrition spine.

## The product call
**Ship it — but as a named weekly GRADE with a one-line reason, leading the Progress tab (replacing the THIS WEEK eyebrow as the hero). Do NOT add it as an 8th card** — it must absorb + re-order the existing Progress cards (adherence + digest become components of its breakdown sheet) or it just adds clutter. The reason to do it: none of the seven current cards answer Lifesum's one-glance question — *"was this a good week of eating?"* — and Suppr has richer data (35-nutrient FDA panel vs Lifesum's ~16) + a better trust posture to answer it honestly.

## 1. The composite — rewards good eating, mathematically CANNOT reward eating less
Non-negotiable firewall (routed past `diversity-inclusion`): **no dimension rewards restriction.** Calorie balance is scored as *proximity to the user's own target, symmetric* (under- and over-eating cost equally). No weight term. A 900-kcal-of-biscuits day scores worse than hitting a balanced 2,200.

| # | Dimension | Rewards | Weight |
|---|---|---|---|
| A | **Nourishment** (protein + fibre adequacy) | quality macros, can't be gamed by eating less | **30** |
| B | **Micronutrient coverage** (breadth of the 35-nutrient panel ≥ a %DV floor) | variety / whole foods (FDA-grounded — our edge) | **20** |
| C | **Balance** (calorie proximity, symmetric) | landing near your *own* target | **20** |
| D | **Consistency** (days logged) | the habit | **20** |
| E | **Restraint** (sodium, sat fat, [added sugar]) | staying under FDA limit DVs | **10** |

Excluded from v1: **weight** (noisy, loaded, already owns its own card — folding it in is the diet-culture conflation we refuse) and a **whole-food/processing classifier** (we have none — grep-confirmed; Dimension B is the v1 proxy).

## 2. Formula + scale — transparent, explainable
0–100 engine truth surfaced as a **letter band** (the band is what the user reads; the number hides in the breakdown sheet to dodge "I dropped 84→81, am I failing?" anxiety):

| Band | Range | Label (calm) |
|---|---|---|
| A | 85–100 | "Strong week" |
| B | 70–84 | "Solid week" |
| C | 55–69 | "Steady week" |
| D | 40–54 | "Light week" |
| — | <40 / insufficient data | "Building" (ungraded) |

```
LifeScore = round(100 * (
    0.30*A_nourishment + 0.20*B_microCoverage + 0.20*C_balance
  + 0.20*D_consistency + 0.10*E_restraint)), clamped to [40,100] when graded
```
Each term is a bounded 0–1 ratio of real data to a real target (no term exceeds 1 — hitting 150% protein caps at "met"). **Floor at 40** when graded (mirrors `recipeFitPercent.ts` — showing up is never an "F"); below the data floor it's **"Building", not a D**. The **"why it moved" is mechanical** — the engine names the single biggest week-over-week mover ("Up 6 — fibre 5 days vs 2 last week"), decomposable by construction. That explainability is the moat over Lifesum's black-box score.

## 3. Surface — Progress, as the lead
Card #1 on Progress (replaces the THIS WEEK headline). Three lines: **grade + band** (hero) · quiet week-over-week chevron ("▲ up 6") · **one-sentence biggest-mover** · "See what shaped this ›" → a sheet with all 5 dimensions as labelled bars + an 8-week sparkline. The raw number lives only in that sheet. Existing adherence + digest cards demote into the sheet; energy/weight/calorie-chart/trajectory stay below as the detail the score summarises.

## 4. Always-on — the Lifesum seam we must NOT reproduce
Lifesum's score **goes dark on meal plans / AI logging** — an admission it can't cope with its own features. Ours never goes dark:
- **Per-dimension data sufficiency** (not all-or-nothing): a photo-logged day scores A/C/D/E but B abstains *for that day* if it lacks micros — computed over the days that *can* support it (like the existing "over days-with-food" rollups), never zeroed.
- **Confidence-labelled** (not hidden): a low-confidence AI-heavy week renders the grade + says so plainly ("some days logged by photo, so variety is estimated from fewer nutrients") — per the approximation policy (label or refuse, never silent).
- **Planned meals are full-data → advantaged on B.** The direct inversion of Lifesum: where their score dies on meal plans, **ours rewards them** (a marketing line).
- **The data floor gates GRADING, not VISIBILITY:** below 3 logged days → the "Building" count-up, never a blank, never a fabricated grade.

## 5. Data — ~90% buildable on existing data
A←`weeklyRecap` protein/fibre adherence · B←per-meal `micros` JSONB vs the 35-entry `DAILY_VALUES` (`dailyValues.ts`/`fullNutrientPanel.ts`) · C←`nutrition_entries.calories` vs `daily_targets` · D←`daysLogged` · E←`micros.sodiumMg`/`saturatedFatG` vs limit DVs.
**Gaps for `nutrition-engine`:** (1) we track *total* not *added* sugar → drop the sugar term in v1, run E on sodium+sat-fat only; (2) calibrate B's denominator (how many nutrients ≥25% DV = full marks) against real logged days; (3) a `weekly_life_scores` table (week_key, score, per-dimension breakdown, confidence flags) for the trend — schema work via `supabase db push --linked`, never MCP.

## Open questions for Grace (need a call before this builds)
1. **What should "health" MEAN for Suppr? (THE question.)** This brief plants a flag: health = **nourishment + variety + balance + consistency**, explicitly *excluding* weight + restriction. Strong, ownable, anti-diet-culture, fits "love food AND have goals" — but it's a choice a competitor will quote back. Confirm before anyone writes the formula.
2. **Letter band vs raw number on the card face?** Brief chose band-as-hero, number-in-sheet (calmer). Lifesum shows the raw 0–100.
3. **Activity dimension in or out for v1?** Brief says out (keep it about *eating*); Lifesum includes activity+hydration.
4. **Whole-food/processing signal — fast-follow priority?** A real ultra-processed classifier would sharpen the "good eating" story (a genuine wedge) but it's a real nutrition-engine build.
5. **Free or Pro?** Brief's instinct: **grade free** (the weekly emotional hook), **full breakdown + 8-week trend = Pro**. Route to `monetisation-architect` to model.

Flag-gated, web+mobile parity, before/after captures both surfaces (CLAUDE.md). ENG-992 + any `weekly_life_scores` schema work tracked in Linear.

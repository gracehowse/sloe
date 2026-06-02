# "Make anything fit" engine — feature spec

**Date:** 2026-06-02
**Status:** Proposed (brainstorm → spec; not yet scheduled)
**Owner routing:** product-lead + nutrition-engine (logic) · copy-reviewer + brand-manager (voice) · executor (web + mobile parity)
**Anchors:** [Suppr positioning](../julienne-deep-dive-2026-06-02.md) ("love food AND have goals") · [strategic direction 2026-04-27](../../) "what to eat next" north-star · Linear **ENG-854** (Mode A / Today) + **ENG-855** (Mode B / Plan tab)

---

## One-liner

> **"Can a cake fit your macros? You bet it can."**

The anti-diet promise rendered as a real mechanic: never "you can't have that," always "here's how to have it." Any homely recipe a user loves can be made to fit their targets — by **flexing the rest of the day** around it, or by **telling them the exact portion** that fits.

This is **not just a tagline.** It's a concrete feature that extends the existing "what to eat next" north-star moment, and it's the product proof behind the warm-coaching positioning. It's the thing the recipe-saver category (Julienne et al.) cannot copy without becoming a macro app.

---

## Why this matters (positioning, not vibes)

- **Diet/macro apps kill the joy of food** ("what you can't eat"). **Recipe apps ignore your goals.** Suppr is the bridge: reframes the tracker from *restriction* → *permission*.
- This engine is the single most on-message feature we can ship for that positioning. It is simultaneously:
  - a **retention hook** (reason to open the app before every meal — "make tonight work"), and
  - a **marketing asset** ("Can a cake fit your macros?" demos the engine in one screen).
- It directly answers the Julienne lesson ([deep-dive](../julienne-deep-dive-2026-06-02.md)): the wedge is the *goal layer*, and this is the goal layer at its most delightful.

---

## What already exists (build on, don't reinvent)

| Primitive | Location | What it does |
|---|---|---|
| `projectRemaining(targets, consumed, candidate)` | `src/lib/nutrition/remainingMacros.ts` (shared as `@suppr/shared/nutrition/remainingMacros`) | Projects what's left after a candidate is logged. |
| "If you log this" preview | web `src/app/components/food-search/*`, mobile `FoodSearchModal` / `LogSheet` | Reactive per-portion projection; flips to **"+N over"** when a portion exceeds budget. Portion-reactive, tested (`foodSearchModalFitThisIn.test.tsx`). |
| `scaleMacros` | `src/lib/nutrition/mealPlanAlgo.ts`, `customFoods.ts` | Scales a food's macros by quantity. |
| Count-to-weight normalisation | nutrition-engine | Required for "exact portion" outputs to be trustworthy. |

So we already compute "does this fit?" and "+N over." The engine is the **two missing inverse/rebalance modes** on top.

---

## The two modes (net-new) — two surfaces, two jobs

Mode A and Mode B are **not sequential phases of one feature** — they are the same engine surfaced two ways for two different mental models. Both are relevant; neither gates the other.

| | Mode A — Portion-to-fit | Mode B — Distribute-around-anchor |
|---|---|---|
| **Surface** | **Today page** (reactive, in-the-moment) | **Plan tab** (proactive, active planning) |
| **Question it answers** | "Given what's left *today*, what / how much can I fit *right now*?" | "If I commit to this meal, what's my budget for the rest of the day?" |
| **Trigger** | User eyes a food / sets a portion in the log flow | User drops an anchor meal into the plan grid |
| **Initiative** | Today tab (dual: Surface polish + Launch) | Plan tab (Surface polish) |

### Mode A — Portion-to-fit (reverse solve) · **Today page**
Today: user sets a portion → we tell them over/under. **Flip it.** When a desired food is over budget, *solve for the portion that fits.*

- Input: candidate food per-unit macros, remaining macros for the day, the user's binding constraint (default: calories; configurable to a macro).
- Output: the largest portion that stays within remaining budget, expressed in the food's natural unit (count-to-weight normalised — "a 220 g serving" or "2 of 3 slices").
- Copy: *"A 220 g portion of spag bol fits your remaining 540 kcal."* / *"Two slices fit — the third puts you 90 kcal over."*
- Math: invert `projectRemaining` over quantity; clamp to ≥0; respect the **nutrition confidence rules** — if the portion can't be normalised with confidence, fall back to "log it and we'll show you where you land" rather than guessing a gram figure.

### Mode B — Distribute-around-anchor · **Plan tab**
User places a meal they *want* into the plan (the "anchor"), and we **distribute the remaining day budget across the other open slots** — turning them into per-slot targets that then drive what-to-eat-next suggestions for each.

- Worked example (Grace's): drop an **800 kcal dinner** into the plan → the engine spreads the remaining **~400 kcal across breakfast + lunch** (e.g. ~150 / ~250 by slot weighting), and each slot's budget now scopes its suggestions.
- Input: the anchor meal (fixed), the day's targets, what's already logged, the set of remaining open slots.
- Output: a **per-slot budget** for every open slot (not a single "lighter breakfast" nudge), plus optional suggestions that fit each slot's new budget.
- Copy: *"Spag bol's in for dinner — here's how breakfast and lunch shake out."*
- This is a constrained-distribution problem: subtract the anchor from the day budget, distribute the remainder across open slots with sensible **per-slot floors** (don't hand a slot a 120 kcal budget); if the anchor leaves too little, say so honestly rather than proposing implausible slots. Reuse `mealPlanAlgo` distribution logic where possible.
- Macros, not just calories: distribute the remaining protein/carb/fat budget too, so a high-fat anchor pushes the other slots leaner, not just smaller.

---

## Nutrition correctness rules (non-negotiable, per CLAUDE.md)

- **Never guess a portion figure.** If count-to-weight normalisation is low-confidence, do not emit "220 g" — degrade to a qualitative answer.
- **Calories are the default binding constraint**, but if a macro target is the tight one (e.g. protein floor, carb cap), surface that as the reason ("limited by carbs, not calories").
- **Floors on Mode B suggestions** — never propose an implausibly small meal to make the math work. A suggestion that requires skipping a meal must say so explicitly, not hide it in a tiny number.
- Reject and clarify only when uncertainty **materially** changes the answer.

---

## Failure modes (top 3) + how the spec mitigates

1. **"Eat less elsewhere" reads as diet-culture restriction** — the exact trap the positioning exists to avoid. *Mitigation:* frame every Mode B output as enabling the wanted food ("to make room for X"), never as a deficit instruction; route all copy through copy-reviewer + diversity-inclusion (body-neutral framing).
2. **Confident-but-wrong portion numbers** — a "220 g fits" that's based on a bad ingredient match erodes trust faster than no feature (the Julienne data-trust lesson, applied to numbers). *Mitigation:* hard confidence gate; qualitative fallback; show the source/assumption.
3. **Solver suggests absurd meals** (120 kcal dinner) to satisfy constraints. *Mitigation:* per-slot floors + explicit "this needs skipping lunch" honesty.

## Alternatives considered

- **Copy-only (no engine).** Ship the tagline, no mechanic. *Rejected:* a promise the product can't keep is the Julienne mistake in reverse — and "what to eat next" already proves users want the mechanic.
- **Build only one mode.** *Rejected* — they serve different mental models on different surfaces (Today = reactive fit; Plan = proactive budgeting). Shipping one leaves half the positioning unproven. They share the math but each earns its keep independently.
- **Full meal-plan regeneration around the anchor** (Mode B variant). Heavier; effectively re-runs the planner. *Rejected for v1* — overkill vs. distributing budget across open slots; revisit if slot-budgeting proves too weak.

**Confidence: 7/10.** High on positioning fit and that Mode A is buildable on existing primitives. Lower on Mode B's distribution quality (per-slot budgeting UX is easy to get subtly wrong) and on whether the count-to-weight confidence gate will fire often enough on real homely recipes to feel magical rather than evasive. Both modes can proceed in parallel since they live on different surfaces — but **Mode A is the lower-risk first ship** (reuses `projectRemaining` almost wholesale) and a good way to validate portion-accuracy before leaning on it inside Mode B's distribution.

---

## Web / mobile parity

Both modes ship on **both** surfaces (iOS leads per the primary-surface rule, web follows in the same change). The "If you log this" preview already has parity; the inverse/rebalance modes must too. Shared math lives in `@suppr/shared/nutrition`.

## Phasing

The two modes are independent (different surfaces) and can run in parallel. Sequencing is risk-driven, not dependency-driven:

1. **Mode A (Today page)** behind `make-anything-fit` flag → validate portion accuracy on real recipes. Lowest-risk, reuses `projectRemaining`.
2. **Mode B (Plan tab)** behind the same flag (or a sibling `plan-distribute` flag) → can start in parallel; benefits from Mode A's validated portion math.
3. Copy finalised by brand-manager + copy-reviewer before flag ramp; before/after captures (web + iOS) per the visual-validation rule.

## Marketing tie-in (route to brand-manager)

Candidate lines (NOT final — for brand-manager + copy-reviewer):
- "Can a cake fit your macros? You bet it can."
- "Eat the spag bol. We'll make the day work."
- "Cook what you love. Hit your goals anyway."

The shareable demo: a homely recipe + the engine showing it fitting = the same "messy Reel → clean macro-aware card" before/after that is our viral hook.

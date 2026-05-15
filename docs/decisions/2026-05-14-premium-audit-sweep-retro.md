# Premium-bar audit sweep retrospective — 2026-05-14

- **Date:** 2026-05-14
- **Area:** Process / Design quality
- **Status:** Resolved (rules below carry forward to the next sweep)
- **Decision by:** Grace
- **Affected docs:**
  - `docs/planning/premium-bar-systematic-followups-2026-05-12.md`
  - Memory: `feedback_premium_audit_subtractive_first.md`
- **Related:**
  - `docs/decisions/2026-05-14-daystrip-revert-stacked-tile.md`
  - `feedback_visual_validation_mandatory.md`
  - `feedback_validate_in_sim_before_push.md`
  - `feedback_premium_audit_requires_pixels.md`
  - `reference_premium_auditor_agent.md`

## What happened

The 2026-05-14 premium-bar audit sweep shipped 226 items across
mobile + web, claimed [x] for all of them after typecheck-clean,
and posted a rollup comment to Linear ENG-203. Grace then tested
in sim and reverted 4 items in a single sitting:

| # | Item | Surface | Cause of revert |
|---|---|---|---|
| 1 | F5/F9 — Stack day initial + numeral into single tile | DayStrip (mobile + web) | 32×44 pill read as oval; past logged days lost their date number entirely |
| 2 | F40 — Warm-tint over-budget on macro arcs | CalorieRing (mobile + web) | Inner arcs collapsed to single amber hue, killed the multi-colour ring language |
| 3 | H.8 — 7-day burn chart card | burn-detail (mobile) | Bar-only viz felt crude vs the page already perfected the day before |
| 4 | DC1 — 1,822 / 1,600 + delta chip under hero kcal | CalorieRing (mobile) | Duplicated hero kcal inside the ring; long-press already surfaces over/remaining |

Adjusted tally: **223 shipped, 36 deferred**.

## Pattern

All four reverts share three characteristics:

1. **Tight per-pixel work.** Geometry shifts, colour mappings,
   chart card chrome, secondary indicator chips. The kind of
   change where the diff reads "reasonable" but the result in-hand
   doesn't.
2. **Code-only inference, no sim validation.** All four items
   were [x]'d after typecheck-clean. None had before/after
   screenshots attached to the audit doc or the rollup PR.
3. **Additive flourishes, not subtractive polish.** Each item
   *added* a visual element (stacked tile, warm tint, chart card,
   chip row) rather than *removing* chrome or tightening
   hierarchy. The "premium feel" was assumed to come from more,
   not less.

## What we learned

Premium-bar work has the opposite center of gravity to where the
audit landed. The bar is rarely raised by adding a chart card or
a secondary chip — it's raised by:

- Removing visual elements that duplicate or weaken the primary
- Making the primary load-bearing (hero kcal, hero recipe image)
- Tightening defaults (colour mappings, motion, type) rather than
  layering extra UI on top
- Restraint at the cold-open surface (landing, onboarding Welcome,
  paywall, Today first-render)

Top-tier apps (Apple Health, Linear, Things, Strava, Withings) are
*sparse* in their first-impression surfaces. Suppr's pre-audit
versions of DayStrip / CalorieRing / burn-detail were closer to
that sparse posture than the post-audit versions.

## Rules for the next sweep

1. **Subtractive-first.** Before proposing an additive item,
   require "what existing element does this duplicate or weaken?"
   If the answer is anything, default to removing the addition.

2. **Visual-validate per item before [x].** Premium-bar `[x]`
   means "code shipped AND eyeballed in sim against the prior
   state". Typecheck-clean is necessary but not sufficient. Code-
   only inference is `ui-critic`-grade work, not premium-bar.
   Per [[feedback_premium_audit_requires_pixels]] —
   already a rule, just not enforced in the 2026-05-14 sweep.

3. **First-impression priority order.** Weight items by where
   they sit in the user's first 60 seconds:
   - **P0 cold-open surfaces** — landing, onboarding Welcome,
     paywall, Today first-render
   - **P1 daily-use surfaces** — Today logged-state, Plan, Cook,
     food search, Recipe import
   - **P2 detail / settings pages** — function-first; visual
     polish only where it's been letting the side down

4. **Two-revert tripwire.** If 2+ items from an in-flight sweep
   get reverted, pause the sweep and re-examine the heuristic.
   Don't keep shipping items from the same playbook.

## What's next

- This retro doc is the source of truth for "why we paused".
- The audit doc retains the four reverts under
  "Reverts (post-sweep)" with their individual rationale.
- The next premium-bar pass should:
  - Open with cold-open surfaces (landing, onboarding Welcome,
    paywall, Today first-render)
  - Start from captured sim screenshots, not code reads
  - Lead with subtractive proposals
  - Mark items [x] only after sim re-capture confirms the change
    improves the surface

Grace's bar: "Users converting from other apps — first impression
should be wow this feels premium / modern, then AND the
functionality is even better."

Capturing that means the next sweep ships fewer items, more
deliberately, with sim screenshots attached to each one.

# Today's Meals — legacy per-slot layout restored as the default (ENG-1091)

**Date:** 2026-06-13
**Area:** Today tab / meals (web + mobile)
**Status:** Resolved (mobile = confirmed). Web empty-state parity = follow-up (see below).
**Flag:** new `today_meals_figma_layout` (NOT in `REDESIGN_DEFAULT_ON` → defaults **off** → legacy per-slot list). The Figma summary-card layout stays behind it (off) for reversibility.

## Context

Grace (2026-06-13): "for meals we need to go back to how it used to look before the
redesign — we obviously use the new palette and fonts etc but the old design of
how it looked and functioned." Confirmed against the rendered flag-off capture:
"yes this is what i wanted."

The old design was never deleted — it was the flag-off branch of
`today_meals_figma_654`. **But that flag was overloaded:** it also gates the North
Star ("What to eat next" → `NorthStarFigmaHero`) and the Weekly Insight card.
Flipping the whole flag off would have reverted those too — which Grace did **not**
ask for.

## Decision

**Split the flag.** The meals-layout switch now reads its own
`today_meals_figma_layout`; `today_meals_figma_654` keeps gating North Star +
Weekly Insight (unchanged). `today_meals_figma_layout` is deliberately left OUT of
`REDESIGN_DEFAULT_ON`, so it resolves off → the **legacy per-slot meal list**
(Breakfast / Lunch / Dinner / Snacks rows with slot icons, "Log usual" pills,
swipe-delete, save-as-usual). It's already on the Sloe palette/fonts — exactly the
"old layout + new palette" ask.

- Mobile `apps/mobile/components/today/TodayMealsSection.tsx`
- Web `src/app/components/suppr/today-meals-section.tsx`

## Verified

- Mobile: legacy per-slot rows render on empty Today (matches Grace's confirmed
  capture). ✓
- Web: the Figma summary cards are gone (flag off); the meals section renders the
  legacy path. Meals + North-Star + Weekly-Insight test suites green on both
  platforms (web 52 / mobile 51). Both typechecks clean.

## Follow-up — web empty-state parity (not yet aligned)

On an **empty** day the web legacy path renders a "No meals logged → Log a meal"
empty state, whereas mobile renders the four per-slot rows. This is a pre-existing
web↔mobile legacy divergence the flag flip exposes. Flagged to Grace; align the
web empty meals to the per-slot rows (or confirm the simpler web empty is
intentional) in a follow-up. The Figma summary-card layout (now dead behind the
off flag) should also be removed in a cleanup once the revert is settled.
# Web Today meals: render all four slots always (mobile parity) (ENG-1095)

**Date:** 2026-06-13
**Area:** Today tab / meals (web)
**Status:** Resolved
**Flag:** `today_meals_all_slots_v1` (in web `REDESIGN_DEFAULT_ON`; off → legacy populated-only list + single "Log a meal" empty card). Web-only — mobile already renders all four.

## Context

Follow-up to ENG-1091 (legacy per-slot Today's Meals restored as default). The
flag flip exposed a long-standing web↔mobile divergence:

- **Mobile** iterates a **fixed** slot list (`slots={["Breakfast","Lunch","Dinner","Snacks"]}` → `slots.map(...)`), so all four per-slot rows render on **every** day, including an empty one (Grace's confirmed design).
- **Web** built `mealsGrouped` **only from logged meals**, so:
  - an **empty** day collapsed to a single "No meals logged → Log a meal" card, and
  - logging Breakfast made Lunch/Dinner/Snacks **vanish** (only populated slots rendered).

## Decision

Web renders the **four standard slots always** (Breakfast/Lunch/Dinner/Snacks),
plus any extra populated slot (e.g. a legacy "Other"/"Planned") appended in its
existing order so no logged meal is dropped — mirroring mobile's `slots.map`.

- The single "Log a meal" empty card is **dropped** when the flag is on; the four
  per-slot rows ARE the empty state.
- **Empty slots show a "+" affordance** (add), not a chevron — a downward chevron
  on an empty row reads as "expand" when there's nothing to expand. Matches
  mobile's trailing "+". Populated slots keep the expand/collapse chevron.
- **Every slot row reads at full opacity**, empty or populated (mobile's crisp
  MFP/Lifesum "all slots always visible" pattern). The old `opacity-55` empty-slot
  dim was dead code (empty slots were never rendered pre-ENG-1095) and isn't on
  mobile, so it's removed rather than newly activated.

Implemented in `today-meals-section.tsx` (the presentational component) by
deriving `slotsToRender` from the prop `mealsGrouped` + the canonical `MEAL_SLOTS`
constant — `mealsGrouped` itself (shared with the day total, log-again, and the
off-by-default figma layout) is left untouched, so the change is localized to the
legacy render branch.

### Flag choice

Structural/layout change → flag-gated per the CLAUDE.md contract. Default-on so
the parity fix is live; the legacy populated-only list + "Log a meal" card stay
in the off path as the kill switch. **Web-only** flag — mobile already renders all
four slots, so there is no mobile mirror to gate.

## Files

- `src/app/components/suppr/today-meals-section.tsx` — `slotsToRender` derivation, "+"-on-empty, full-opacity rows, gated empty card
- `src/lib/analytics/track.ts` — `today_meals_all_slots_v1` in `REDESIGN_DEFAULT_ON`
- Tests: `tests/unit/todayMealsSectionEmptyState.test.tsx` (rewritten for the four-rows default + the flag-off kill switch)

## Verified

- **Web** (`/today --auth`, empty day): four per-slot rows (Breakfast/Lunch/Dinner/Snacks) render with tinted icon chips (amber/sage/plum/teal) + serif names + "+" — structurally identical to mobile's empty meals. The single "Log a meal" card is gone (`emptyCard: false`; 4 × `today-slot-add-*`, 0 chevrons).
- **Mobile** (iOS sim, empty day): unchanged reference — same four per-slot rows.
- Web meals + NutritionTracker suites green (flag-on default + flag-off kill switch both covered); typecheck + lint clean.

## Follow-up

The bundled dead-code removal of the off-by-default `TodayMealsFigmaLayout` is
split into its own ticket (kept reversible for a short window after the ENG-1091
revert merged) — see the ENG-1095 Linear thread.

## Related

- ENG-1091 — [legacy per-slot meals default](2026-06-13-meals-legacy-layout-default.md).

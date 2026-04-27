# Spec: Today screen Phase 3 redesign (B4)

**Date:** 2026-04-27
**Owner:** Engineering + Design
**Status:** Specced (post-launch v1.1+)
**Effort:** M (1–2 weeks, single-engineer push; longer if design iterates)
**Dep:** Post-launch retention data — at least 4 weeks of TestFlight + App Store install signal so the spec's prioritisation is grounded in observed behaviour, not internal opinion.

---

## Background

Onboarding redesign Phase A (auth + persistence) and Phase B (import + polish) shipped 2026-04-27. Phase 3 is the deferred third leg: a v2 visual + interaction treatment of the Today screen. The original scope is in `docs/decisions/2026-04-19-onboarding-redesign-scope.md` (Phase 3 section) — this spec converts that scope into an implementation-ready PRD.

Today's Today screen (the post-launch baseline) carries:
- Hero ring with calorie / macro tiles
- Streak insight + fasting pill row
- Eat-again banner (when applicable)
- Steps + activity bonus cards
- Week-view strip
- Quick-log strip + FAB
- Meals section (planned + logged)
- Add-meal dialog modal

The redesign isn't a rewrite — it's an opinionated tightening of the same surfaces.

## Problem

Two recurring TestFlight signals motivate the redesign:
1. **Top-of-screen real estate is over-spent on the hero ring at the cost of "what to log right now" actions.** Users on `lg:` widths see a calmer layout (right-rail cards keep the ring from dominating); on phones the ring + macro tiles eat almost the full first viewport.
2. **The eat-again prompt sits below all of week-view + macros when it's most useful at the very top** (it's the "fastest path to a logged meal" affordance — burying it costs taps).
3. **The FAB ↔ quick-log strip ↔ "+" buttons inside the meals section all do overlapping things.** D25 cleared the visual duplication but didn't unify the IA. Phase 3 is the natural place to commit.

## Goals

1. **Condense the top-of-screen** so the first viewport surfaces both the hero ring AND the "act now" affordances (eat-again, today's planned meal).
2. **Reposition the eat-again prompt** to top-of-feed, between the date header and the hero ring, when it has a recommendation.
3. **Integrate the quick-add affordance** into a single primary entry point — either by keeping the FAB and dropping the quick-log strip, or by replacing the FAB with a sticky bottom dock that subsumes the strip's four buttons. Decision driven by retention data.
4. **Hold web ↔ mobile parity** as we go. Today screen has full parity today; Phase 3 must preserve that.

## Non-goals

- New analytics events. The Phase 1 tap funnel tells us enough about CTR on the existing affordances; no new events until we see the Phase 3 numbers move.
- Changing the ring computation / macro display logic. This is a layout + IA change, not a math change.
- Rewriting the meals section. That's its own surface (TodayMealsSection) and stable; if it needs reflow it's a separate ticket.
- iPad-specific layouts. Today's `lg:` desktop frame already gives us a defensible tablet layout; no parallel work for iPad now.

## Surfaces (in flight order)

### A. Top-strip rework

| Today | Phase 3 |
|---|---|
| Date header → Hero ring + macro tiles → streak/fasting → eat-again → steps → week-view → quick-log → meals | Date header → eat-again (when present) → condensed hero (ring + macros side-by-side instead of stacked) → streak/fasting/steps row (3 micro-tiles) → week-view → meals |

The condensed hero turns the current 60vh first viewport into ~40vh, freeing space for the eat-again prompt + streak row to land before the user scrolls. On `lg:` the right rail stays as-is.

### B. Eat-again repositioning

`TodayEatAgainBanner` already takes a `meal` prop and renders a banner. Today it lives below the streak/fasting card; Phase 3 moves it directly under the date header, conditional on `usualMealHint(...)` returning a non-null suggestion. The banner's empty state (no recommendation today) collapses to zero height — never a placeholder.

### C. Quick-add IA decision

Two options, exclusive:

**Option 1 — keep FAB, drop quick-log strip.**
- Pro: matches mobile-app norm (Apple Health, MyFitnessPal); FAB is on every Today screen consistently.
- Con: "Voice / Photo / Snap / Scan" needs a bottom sheet from FAB tap (one extra tap to reach those entry points).
- Files touched: remove `TodayQuickLogStrip` from `NutritionTracker.tsx` + `apps/mobile/app/(tabs)/index.tsx`; extend `TodayAddMealDialog` to surface the four entry-points as an action sheet inside it.

**Option 2 — replace FAB with sticky bottom dock that surfaces 4 entry points.**
- Pro: zero-tap-to-reach voice/photo/snap/scan; no extra modal.
- Con: dock + tab-bar is two stacks of buttons at the bottom — visual + touch-target conflict; Settings > Reduce Motion users get a stationary dock that can't auto-hide on scroll without breaking accessibility.

**Recommendation:** Option 1. Cleaner IA, matches platform conventions, doesn't double-stack on tab bar. Defer the action-sheet flourish until we see drop-off in the FAB → entry-point funnel.

### D. Cross-platform parity

Web `NutritionTracker.tsx` + mobile `apps/mobile/app/(tabs)/index.tsx` mirror each other surface-for-surface. Phase 3 must preserve that. Where the surfaces are gated by viewport on web (`lg:` right rail), mobile only renders the single-column variant.

## Acceptance criteria

1. Date header → eat-again (when present) → condensed hero → 3-micro-tile row → week-view → meals on first viewport on a 6.1" iPhone (375pt width). Specifically: eat-again present → first scroll happens at the meals section header, not before.
2. The hero ring height on phones is ≤ 200pt (down from ~280pt). Macros render to the right of the ring (not below) on phones ≥ 375pt.
3. `TodayQuickLogStrip` is removed from both web + mobile composition roots; FAB still routes to `TodayAddMealDialog`.
4. `npm run ci` green.
5. Visual regression: every existing TestFlight TestID on Today still resolves (no orphaned tests).
6. PostHog dashboard "Today entry-point funnel": no >5% degradation on FAB → log-completion conversion vs the pre-Phase-3 baseline. Measure for 7 days post-deploy.

## Phasing

Internal phases (engineer can ship one at a time):
- **Phase 3a** — eat-again repositioning. 1 day. Lowest risk; biggest tap-economy win.
- **Phase 3b** — condensed hero (ring + macros side-by-side). 2-3 days. Medium risk; needs mobile-web visual snapshot pass.
- **Phase 3c** — drop quick-log strip; FAB consolidation. 1-2 days. Higher behavioural risk — gate behind a PostHog flag (`today_phase_3_quickadd_v2`) for first 1-2 weeks so we can roll back without a deploy.

## Risks

- **Behavioural regression on the 4 entry points.** Voice / photo / scan / barcode usage is ~10–15% of logging today (per PostHog). If burying them behind the FAB drops that to ~5% we'd lose advanced-user retention. Mitigation: PostHog flag (per Phase 3c) + 7-day measurement window before fan-out.
- **Hero ring side-by-side layout breaks on small phones.** SE-class devices (320pt width) need the legacy stacked layout. Use a `useWindowDimensions()` gate.
- **Tests touching the strip break.** D25 pinned the strip's existence; those tests need to be either updated or deleted as part of Phase 3c. Don't leave them stale.

## Cross-platform parity

Mobile + web ship Phase 3a together (1-day effort each). Phase 3b ships together. Phase 3c ships behind the same PostHog flag on both platforms simultaneously — this is the riskiest step and rolling back one platform without the other is worse than rolling back both.

## What this spec deliberately does NOT include

- Any new logging affordance or new entry point.
- Changes to how the hero ring computes its values.
- Notification badges on the FAB / dock.
- Plan-mode integration with Today (surfaces today's planned meals more prominently). That's tied to plan-loop work and lives in a separate PRD.

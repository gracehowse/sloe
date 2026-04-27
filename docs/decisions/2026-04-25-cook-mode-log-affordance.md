# Decision log: cook mode → log-this-meal affordance (P2-24, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P2-24 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Web `CookMode.tsx` already had a "Log this meal" CTA wired to `addLoggedMeal`; mobile `cook.tsx` done state was just a 🎉 + "Done" button with no affordance to log.

---

## Decision

**Mobile cook-mode "done" state now shows two CTAs:**

1. **"Log this meal"** (primary) — calls `router.replace(`/recipe/${recipeId}?autoLog=1`)`, fires `cook_mode_log_tapped` analytics. The recipe-detail page reads `autoLog=1` and triggers `addRecipeToTodayJournal()` once on mount (`useRef` guard prevents re-fires on re-renders or back-navigation).
2. **"Skip — back to recipe"** (secondary) — original `router.back()` behaviour.

The journal write reuses the existing `addRecipeToTodayJournal` helper that already owns the **P0-3 coercion guard**: if `wouldCoerceMacros(scaledForLog)` returns true, the user is routed to verify the recipe instead of logging fabricated macros. No fork in the write path; no duplicated guard.

## Rationale

The full re-implementation alternative (a fresh write path inside `cook.tsx`) would have meant duplicating the coercion guard, the optimistic update, the snapshot logic, and the alert copy. That's three sites with the same logic and three places a future maintainer might forget to keep in sync. The `autoLog=1` route param is a one-line side-channel that lets the cook screen trigger the recipe page's existing flow without crossing the screen boundary.

The `useRef`-based fire-once guard prevents the journal write from triggering twice if:
- The user navigates back to the recipe page (autoLog=1 still in the URL).
- React re-runs the effect during a re-render (e.g. when a download finishes and the recipe state updates).
- The user opens cook mode again on the same recipe (the ref clears on a different `recipe.id`, so a real re-run still works).

The "Skip" CTA preserves the prior UX for users who don't want to log (e.g. cooking for a household member, sampling a recipe, or just exploring).

## Alternatives considered

- **Duplicate the journal-write logic inside `cook.tsx`.** Rejected per above. Three call sites of the same coerce guard is the wrong factoring.
- **Lift `addRecipeToTodayJournal` into a shared `apps/mobile/lib/journal.ts` helper.** Considered. The helper currently closes over `recipe`, `scaledForLog`, `logPortion`, `userId` from the recipe-detail page — extracting it would mean threading those four through, which is doable but invasive. The autoLog redirect achieves the same UX in one line on each side.
- **Make the cook screen own the recipe-fetch + write directly.** Rejected. Cook mode receives only `recipeId`, `title`, `steps` via URL params; fetching the recipe row + computing scaled macros inside cook.tsx is a meaningful refactor.

## Implementation

- `apps/mobile/app/cook.tsx` — done state shows "Log this meal" + "Skip — back to recipe". Tap fires `cook_mode_log_tapped` and `router.replace`.
- `apps/mobile/app/recipe/[id].tsx` — reads `autoLog=1` from `useLocalSearchParams`, fires `addRecipeToTodayJournal()` once via `useEffect` + `useRef`-guarded fire-once pattern.
- `src/lib/analytics/events.ts` — new `cook_mode_log_tapped` event for funnel splitting (cook → log vs cook → skip).
- Web `CookMode.tsx` — already had the equivalent ("Log this meal" button + `addLoggedMeal`); no change.

Mobile `tsc --noEmit` clean.

## Platforms affected

- **Mobile:** new CTA in cook-mode done state. Cook → log conversion now measurable.
- **Web:** unchanged — `CookMode.tsx` already shipped this loop.
- **Supabase:** unchanged.

## Verification

- Mobile `tsc --noEmit` clean.
- Manual TestFlight smoke: complete a recipe in cook mode → done screen shows two CTAs; tap "Log this meal" → returns to the recipe page → meal lands in today's journal (or the coercion alert fires for a kcal-only recipe).
- The fire-once ref prevents duplicate writes when the recipe page re-renders after the journal insert completes.

## Related artefacts

- [Opus 4.7 codebase review §6.2](../audits/2026-04-25-opus47-codebase-review.md)
- [P0-3 — wouldCoerceMacros at journal write paths](./2026-04-25-coerce-macros-journal-guards.md) — the reused guard
- Web equivalent: [`src/app/components/CookMode.tsx`](../../src/app/components/CookMode.tsx) (already shipped)

## Revisit when

- A new entry point to the journal write lands → consider lifting `addRecipeToTodayJournal` to a shared mobile helper instead of growing the autoLog-route-param pattern.
- The cook-mode "Log this meal" funnel shows >50% of cooks resulting in a log → consider promoting it to the primary CTA on `recipe/[id]` itself.
- The journal-write path becomes optimistic on the recipe page (currently only the planner-meal-log path is). At that point, the autoLog flow inherits the optimism for free.

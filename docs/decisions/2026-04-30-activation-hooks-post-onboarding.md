# Activation hooks — close the post-Reveal momentum leak

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Onboarding → Today / activation
**Owner:** Grace
**Authority:** Four convergent audits (competitor-vs-Suppr, customer-lens,
visual-qa, qa-lead) flagged the post-Reveal flow as the #1 reason
users won't switch from competitors. Five S-effort fixes close most of
the leak. This doc records the five.

## Problem

The Reveal moment in onboarding is genuinely good — the user sees
their numbers crystallise, the ring animates, the "you fit X kcal"
copy lands. After that, every audit flagged the same leak: momentum
evaporates.

Five concrete ways:

1. After the post-Reveal `notifications-prompt` screen, the user lands
   on `/(tabs)/discover` — a wall of strangers' recipes. The aha is
   instantly diluted by content that has nothing to do with the user's
   own plan.
2. The Recipes step was pulled from the linear flow in the 15→12
   shrink (`docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`).
   `state.pickedRecipeSlugs` is empty for every default completion, so
   `mobile-flow.tsx`'s `if (pickedSeeds.length > 0)` save guard never
   fires. Library starts empty. The north-star block on Today is
   permanently stuck in its `library-empty` invitation state, and
   "What to eat next" — the strategic-direction north-star moment —
   silently doesn't render.
3. The user logs their first meal. The ring moves. Nothing acknowledges
   it. The smallest possible reward is missing.
4. Push permission is at the OS default (`undetermined`) — the
   `MobilePermissionsStep` was pulled from the linear flow too, and we
   never re-asked. No D1/D7/D30 retention nudge can deliver until the
   user grants it.
5. The north-star suggestion card shows "Close fit" + macro counts but
   never says **which** macro it's fitting. Users don't trust the
   algorithm — the chip reads as black-box.

## Decision (five S-effort fixes, shipped together)

### 1. Onboarding routes to Today, not Discover

`apps/mobile/app/notifications-prompt.tsx` — both `onSkip` and
`onEnable` now call `router.replace("/(tabs)?firstRun=1")`. The
`firstRun=1` query param is the first-run signal Today consumes for
push-explainer + ring polish (no need to re-query
`onboarding_completed`). Same redirect on the mount-time
already-dismissed path so a returning user who answered the prompt
once doesn't get a Discover bounce on cold launch.

### 2. Seed library with curated defaults at onboarding completion

New helpers in `src/lib/onboarding/onboardingSeeds.ts`:

- `ONBOARDING_DEFAULT_SEED_SLUGS` — five canonical slugs covering
  breakfast / lunch / dinner across veg / pesc / omni so the
  time-of-day filter in the scorer always has candidates and the
  library hits `NORTH_STAR_LIBRARY_MIN` (5) immediately.
- `defaultOnboardingSeeds(input)` — applies the user's diet +
  allergens to the curated 5 first; falls through to the broader
  library only when the diet+allergen filter wipes the canonical
  defaults (e.g. vegan).

`apps/mobile/components/onboarding/mobile-flow.tsx#handleComplete`
now branches: when `pickedRecipeSlugs.length === 0`, resolve the
defaults via the existing `resolveSeedsToRecipeIds` +
`saveResolvedSeeds` pipeline, exactly like the picked-recipes path.
A new `used_default_seeds` analytics flag goes on
`onboarding_completed` so we can monitor the activation lift.

### 3. First-log acknowledgment moment

New component
`apps/mobile/components/today/FirstLogAcknowledgment.tsx` — a 2.5s
toast pinned to a one-time AsyncStorage flag
(`suppr.first-log-acknowledged.v1`).

Today (`apps/mobile/app/(tabs)/index.tsx`) detects the
`mealsToday.length` 0→1 transition against the storage flag (so a
returning user who already saw the toast on day-1 never re-triggers
on day-2) and fires:

- `Haptics.notificationAsync(NotificationFeedbackType.Success)` (iOS
  only).
- 2.5s toast: "First log done. Your ring is moving."

Component is absolutely positioned (top-anchored, inside the safe
area) so it overlays the ScrollView. Auto-fade and unmount both
clear the timer so a late dismiss can't fire after the toast was
already hidden.

### 4. Post-onboarding push-permission explainer

New component
`apps/mobile/components/today/PostOnboardingPushExplainer.tsx` — a
single-screen modal sheet shown the first time Today renders after
`onboarding_completed=true` AND the OS notification permission is
`undetermined`.

Calm copy: "Want a quiet ping when it's time to log dinner? You can
always change this in Settings." Two CTAs — "Notify me" and "Maybe".
"Notify me" runs the canonical iOS path
(`Notifications.requestPermissionsAsync` → `registerExpoPushTokenForUser`).
Either CTA writes the storage key
(`suppr.post-onboarding-push-prompt.v1`) so we never re-prompt.

Coordinates with the existing `OnboardingNudgeBanner` (commit
c60af6d): this fires FIRST on the post-onboarding launch. The
`permissions` nudge in that queue is the recovery path for a user
who dismissed THIS prompt — same OS calls, lower priority on
re-ask.

### 5. NorthStar WHY line

New helper in `src/lib/nutrition/northStarSuggestion.ts`:
`whyLineForSuggestion(suggestion, remaining)` — picks the strongest
one of three reasons:

1. "Hits both your protein + calorie target" — when ≤15% off
   remaining calories AND ≥80% of remaining protein gap.
2. "Fits your remaining N g protein" — when protein gap ≥ 10 g and
   ≥80% filled.
3. "Fits your remaining N kcal" — fallback. Always available.

Wired into both mobile (`NorthStarBlockHost.tsx`) and web
(`src/app/components/NutritionTracker.tsx`) hosts. The block renders
a 12px secondary subtitle below the recipe title. The line is
optional on the type interface so older callers stay
source-compatible.

## Cross-platform parity

| Fix | Mobile | Web |
| --- | --- | --- |
| 1. Routes to Today | Shipped | N/A — web onboarding already routes to `/home` |
| 2. Seed defaults | Shipped (`mobile-flow.tsx`) | Shipped (`web-flow.tsx`, 2026-05-30) — same `defaultOnboardingSeeds` fallback + `used_default_seeds` flag, wired when the Recipes picker step was cut |
| 3. First-log toast | Shipped | Follow-up — web has no equivalent surface today |
| 4. Push explainer | Shipped (iOS-only) | N/A — web push routes through Web Push API; out-of-scope |
| 5. WhyLine | Shipped | Shipped (mirror in `north-star-block.tsx` + host) |

## Validation

- `npm run typecheck` clean.
- `npm run mobile:typecheck` clean.
- `npm test` (web) — 3409 / 3409 pass.
- `npm run mobile:test` — 850 / 850 pass.
- New tests:
  - `tests/unit/northStarSuggestion.test.ts` — 6 new pins for
    `whyLineForSuggestion` (both-fit, protein-only, calorie-only,
    low-remaining-protein guard, defensive non-positive remaining,
    never-empty).
  - `tests/unit/onboardingSeedsPhase5.test.ts` — 6 new pins for
    `defaultOnboardingSeeds` (count, slug-existence, library-min
    threshold, slot diversity, vegan filter, vegetarian filter,
    allergen filter).
  - `apps/mobile/tests/unit/firstLogAcknowledgment.test.tsx` — 7
    pins for the toast (renders, copy, a11y, auto-fade timing,
    unmount cleanup).
  - `apps/mobile/tests/unit/postOnboardingPushExplainer.test.tsx` —
    5 pins for the modal (copy, CTA wiring, no scare copy).
  - `apps/mobile/tests/unit/onboardingDefaultSeedsWiring.test.ts` —
    6 source-level pins for the `mobile-flow.tsx` fallback path.
  - `apps/mobile/tests/unit/northStarBlockHostPhase5.test.tsx` — +1
    why-line pin.
  - `apps/mobile/tests/unit/expoPushToken.test.ts` — +2 routing pins
    (no `discover` route, `firstRun=1` query param).

## Follow-ups

- Sync-enforcer route: Web `web-flow.tsx` default-seed fallback —
  **shipped 2026-05-30** (alongside the Recipes picker cut). The
  picks-vs-defaults decision now lives once in the shared
  `selectOnboardingSeeds` selector, and seeding on BOTH platforms is
  gated behind a single fail-safe default-ON kill switch
  (`onboarding_default_seeds`, read via `isFeatureDisabled`) — see
  `docs/decisions/2026-05-30-cut-onboarding-recipe-picker.md`.
  `NutritionTracker.tsx` WhyLine already shipped (row 5). Remaining
  parity follow-up: the TodayHero web-side first-log toast equivalent
  (fix #3) — web has no equivalent surface today.
- `analytics-engineer`: confirm `used_default_seeds` event property
  is registered on the dashboard.
- `release-gate`: bundle into the next TestFlight build —
  activation hooks are user-visible end-to-end and need on-device
  verification before merging the parallel water-tracking +
  HealthKit-writes branches.

## Anti-patterns avoided

- **No fake-implementation.** Every fix routes through real
  user-visible behaviour (router redirects, real saves, real
  haptics, real OS prompts).
- **No silent error swallowing.** Every async path logs via
  `console.warn` and surfaces a recovery to the user (the queue
  banner re-asks, the toast persists across launches).
- **No new patterns next to old ones.** Toast pattern reuses
  `AiFirstLogTooltip`'s host-owned visibility lifecycle. Modal
  pattern reuses the existing `Modal` + scrim from
  `MoveMealSheet` / `CopyMealSheet`. Why-line lives in the same
  pure-function file as the rest of the scorer.

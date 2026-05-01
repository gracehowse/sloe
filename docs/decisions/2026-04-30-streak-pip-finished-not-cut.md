# Streak pip — finished, not cut (audit "cut OR finish")

**Date:** 2026-04-30
**Area:** Mobile / Today / Streak
**Status:** Resolved
**Owners:** product-lead (verdict), executor (implementation)

## Context

The 2026-04-30 product-lead audit verdict on the StreakPip:

> "Has no tap target, no milestone, no link to streak-freeze ledger.
> Cut OR finish — either delete it or make it the entry point to
> weekly recap + freeze ledger. The middle ground (decorative pip) is
> the worst option."

The pip itself is right per **D-2026-04-27-07** (calm-streak posture,
no flame / Duolingo / streak-anxiety). What was missing was a job.

## Decision

**Finish, not cut.** The pip becomes a tappable entry point to a
focused weekly recap surface. Posture stays calm — observational copy,
no gamification glyphs, no shame language for missed days.

## Implementation

| File | Change |
| --- | --- |
| `apps/mobile/components/today/StreakPip.tsx` | Optional `onPress` makes the pip a `<Pressable>` with `accessibilityRole="button"`. Hit-slop expands the 22pt pill to a comfortable 38pt tap area. New `size="lg"` variant for use as a recap-screen header. Static `<View>` is preserved when `onPress` is omitted so embedded uses don't accidentally inherit a button role. |
| `apps/mobile/app/weekly-recap.tsx` (new) | Stack route `/weekly-recap` rendering: week range header, larger pip, days-logged dot grid, average daily calories vs target (under / over framing — never "missed"), protein average + days hit, closest-to-target day (per `selectClosestToTargetDay`, same rule the Digest uses), streak length + freeze ledger (suppressed when zero earned). |
| `apps/mobile/app/(tabs)/index.tsx` | Pip wired to `router.push("/weekly-recap")`. |
| `apps/mobile/app/_layout.tsx` | Stack screen registration with `headerBackTitle: "Today"`. |
| `apps/mobile/lib/weeklyRecap.ts` | Re-export `selectClosestToTargetDay` so the new screen and the existing Digest share the exact same selection rule. |

## Calm-posture rules pinned

- **No flame, no confetti.** The lucide `Flame` glyph already lives
  inside `<StreakPip>`; we never add another beside it. No emoji in
  any new copy.
- **Observational language only.** "You logged 5 of 7 days." Never
  "You missed 2 days" or "You're crushing it!". Calorie deltas frame
  as "120 under your 2,100 kcal target." — never as a value judgement.
- **Empty / first-week.** Zero logged days lands on a calm explainer
  ("Your streak starts here. A streak begins when you log on two
  different days in the same week.") rather than a broken stat card.
- **Freeze ledger.** Surfaces only when the user has earned ≥1 freeze;
  zero suppresses the line entirely so we don't gamify a non-event.

## Web parity

**Intentional divergence — mobile-only for now.**

Web's StreakPip lives on the single-page `NutritionTracker`. There's
no `/weekly-recap` route on web today; the recap surface there is the
existing `<Digest/>` Sunday card on the Progress dashboard, which
already covers the same rollups. Adding a navigation route would be a
larger Web Phase scope than this audit task allows. Documented inline
in `apps/mobile/components/today/StreakPip.tsx` JSDoc and in the
`sync-enforcer` carve-out reference table.

When/if web grows a dedicated weekly-recap route, the same shared
`selectClosestToTargetDay` + `buildWeeklyRecap` helpers can drive it
without duplicating logic. No mobile-side schema changes required.

## Validation

- 10 new render + logic tests in `tests/unit/weeklyRecapScreen.test.tsx`.
- All 16 existing `canonicalTodayPhase2` tests still pass (the pip's
  static rendering is unchanged when `onPress` is absent).
- 864/864 mobile tests green.
- TypeScript clean for files in scope.
- Calm-posture sweep: no flame / confetti / shame copy in any new UI
  string. Comments mention forbidden patterns only as documentation
  guardrails.

# Today — collapse the strip→hero dead band (ENG-1609)

**Date:** 2026-07-20
**Decider:** Grace (2026-07-19, annotated screenshot — "too much space
here" between the week strip and the Coach chip + kcal dial on Today)
**Status:** Implemented, unflagged

## Decision

`apps/mobile/app/(tabs)/_today/TodayScreen.tsx` no longer wraps
`<TodayDateHeader stripOnly>` (the week strip) in an extra
`marginBottom: Spacing.md` (16px) `<View>`. The strip→hero gap is now the
same single 24px `Spacing.xl` `styles.scroll` gap every other Today section
break already uses (Meals / Activity / Hydration / Planned).

Shipped **unflagged** — same precedent as the F-158 Complete-Day-button
rhythm fix (`docs/ux/redesign/today.md` §F-158): a founder-requested
off-rhythm spacing bug fix with no structural change (no element added,
removed, or reordered; no divider, colour, or animation change), not the
kind of layout change the 2026-05-13 feature-flag rule targets.

## Root cause

The 16px wrapper was added by the 2026-06-11 rhythm sweep (ENG-1032) to
create one deliberate 24pt break between the week strip and the ring hero,
back when `styles.scroll`'s base gap was 8px (`Layout.todayScrollGap`) —
16 + 8 = 24, bigger than the 8pt cluster rhythm in the header above it (see
the now-superseded item 4 of
`docs/decisions/2026-06-08-today-654-conformance-wordmark-weekstrip-tdee.md`,
"strip→hero `mb-7`").

The 2026-07-06 ENG-1356 flag-collapse then made `styles.scroll`'s gap
unconditionally `Spacing.xl` (24) everywhere — `today_tracker_tier_v1` was
already always-on in production, so collapsing `tierV1 ? Spacing.xl :
Layout.todayScrollGap` to plain `Spacing.xl` was a correct, behaviour-neutral
no-op **for every section that relied on the bare scroll gap alone**. The
week-strip wrapper's *additional* 16px margin was never revisited against
the new 24px base, so the seam silently doubled: 16 + 24 = 40px, a dead band
rather than a deliberate break.

## Why removing it (not re-tuning it) is correct

Every other Today section break (Meals / Weekly insight / Planned / Activity
/ Hydration) already gets its break from the bare 24px scroll gap alone —
each section wrapper is pinned at `marginTop: 0` specifically so "the one 24
`Spacing.xl` `styles.scroll` gap carries the rhythm" (comment at the Planned
Meals section, `TodayScreen.tsx`). The week strip was the one exception
still carrying a manual margin, and the value it carried was calibrated
against a base gap that no longer exists. Snapping it to the same pattern as
every sibling section — delete the manual margin, let the scroll gap alone
own the seam — is both the fix and the consistency call: one spacing
decision (24px) for every section break on the page, not two.

Web parity check (ticket requirement): `src/app/components/NutritionTracker.tsx`
never wrapped `<TodayDateHeader>` in an extra margin — its `space-y-6`
Tailwind container already gives the greeting→strip and strip→hero seams a
uniform 24px (`space-y-6` = 1.5rem = 24px, exact parity with mobile's
`Spacing.xl`). Web was already correct; no web change was needed. This
mobile fix brings mobile back into the parity web already had.

## Boy-scout shrink

`TodayScreen.tsx` is a legacy file pinned in `scripts/screen-line-budget.json`
(400-line screen-budget rule, ENG-717/621) — any touch should shrink it, not
just patch in place. The adjacent "day-view greeting hero" block (eyebrow +
serif day name + date subline, ~35 lines, self-contained) was extracted to
`apps/mobile/components/today/TodayGreetingHero.tsx` in the same change —
previously untestable in isolation (only reachable via source-pins on the
5,900-line host), now a real mountable/testable unit
(`apps/mobile/tests/unit/todayGreetingHero.test.tsx`). File went from 5,911
→ 5,878 lines; re-pinned via `npm run check:screen-budget:write`.

## Verification

- **ios-simulator MCP tooling was not connected in this session** — no
  before/after simulator screenshots were captured. Verification instead
  relied on precise reasoning about the render tree (traced the exact
  contributing values: `Spacing.md` wrapper margin + `Spacing.xl` scroll gap
  + `SupprCard` `padding="md"` card inset) confirmed against git history
  (the ENG-1032 and ENG-1356 commits that produced the drift) plus new/
  updated automated tests — not a substitute for a pixel check; a follow-up
  sim capture is recommended before/soon after this ships.
- `apps/mobile/tests/unit/todayRhythmLayout.test.ts` — two new source-pin
  cases: the `marginBottom: Spacing.md` + `<TodayDateHeader` double-stack
  pattern is gone; `<TodayGreetingHero>` is wired.
- `apps/mobile/tests/unit/todayGreetingHero.test.tsx` — new, 3 cases: no
  render in week view; TODAY eyebrow + day name/short date on today's date;
  eyebrow hidden + long-date headline on a historic day.
- Full mobile suite green (469 files / 3,987 tests / 4 pre-existing skips);
  full web suite green (1,066 files / 10,913 tests / 5 pre-existing skips —
  run because `scripts/screen-line-budget.json`, a cross-platform shared
  pin file, changed); `check:screen-budget`, `check:spacing-scale`,
  `check:token-scale`, `check:type-scale-mobile`, `check:pressable-feedback`
  all clean.

## Files

`apps/mobile/app/(tabs)/_today/TodayScreen.tsx`,
`apps/mobile/components/today/TodayGreetingHero.tsx` (new),
`apps/mobile/tests/unit/todayGreetingHero.test.tsx` (new),
`apps/mobile/tests/unit/todayRhythmLayout.test.ts`,
`scripts/screen-line-budget.json`.

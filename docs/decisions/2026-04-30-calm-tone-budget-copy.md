# Calm-tone over-budget copy: replace "Over budget" with "Net deficit/surplus"

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Today / week-mode tracker copy
**Round:** User-sentiment audit, round 4

## Problem

UCL October 2025 study + r/loseit community data converge on the same
finding: red/green design + streak loss + rigid "budget" framing drive
logging avoidance and ED-cohort harm. The framing tells the user they
were *bad*; observational copy tells them what *happened*.

Audit of Suppr's tracker surfaces (round 4 user-sentiment audit) found
one residual punitive label on the week-mode summary: the diff stat
read "Over budget" / "Under budget" with the over-target tone in red
(`text-destructive`).

The Today daily ring, the streak banner, the deficit insight, and the
weekly-recap copy were all already calm — this was the last drift.

## Decision

1. Replace **"Over budget" / "Under budget"** with **"Net surplus" /
   "Net deficit"** — matching the canonical phrasing in
   `src/lib/copy/today.ts` (which already standardised on
   "deficit"/"surplus" across the daily ring + deficit-insight + weekly
   recap).
2. Soften the over-target colour token from **red** (`text-destructive`)
   to **amber** (`text-warning`). Per project memory + spec §1.4, amber
   is the agreed over-budget signal; red is reserved for truly destructive
   actions. The mobile equivalent already used `Accent.warning`; this
   brings web to parity.
3. Tighten the parity test (`tests/unit/todayCopyParity.test.ts`):
   - Match is now **case-insensitive** (catches "Over budget" with a
     capital O — the original case-sensitive grep let it slip past).
   - Added phrases to the forbidden list:
     - `you went over`
     - `don't break your streak`
     - `streak lost`
     - `broke your streak`
   - Comment-stripping pass — code comments referencing the retired
     terms (e.g. "we replaced 'over budget' with...") are no longer
     false positives.

## Files changed

- `src/lib/copy/today.ts` — extended `FORBIDDEN_TODAY_PHRASES` with the
  4 new entries; expanded the JSDoc rationale.
- `tests/unit/todayCopyParity.test.ts` — case-insensitive match +
  comment-stripping helper.
- `src/app/components/suppr/today-week-view.tsx` — copy + colour swap.
- `apps/mobile/components/today/TodayWeekView.tsx` — copy swap. Colour
  was already amber.

## Parity

The same swap landed on both platforms in the same commit. The colour
softening was a web-only change (mobile was already amber).

## What this does NOT change

- The calorie ring's destructive-red tone when the user is genuinely
  over their daily target. That visual signal stays — UX research
  recognises red as the universal "over" cue. The fix is in the COPY,
  not the colour. Copy describes; it doesn't judge.
- The streak / pip surfaces. Audit found no streak-anxiety language in
  active source files; the calm-streak posture is intact.
- The over-target amber bar in the weekly bar chart. Already amber.

## Risks / follow-ups

- A future contributor may reintroduce a punitive phrase. The parity
  test now catches case-insensitive matches and ignores comments — the
  signal is stronger than before, but we should add `"over your daily"`
  / `"missed your target"` to the forbidden list if either lands in a
  future PR.

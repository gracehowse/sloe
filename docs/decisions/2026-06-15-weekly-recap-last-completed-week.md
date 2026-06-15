# Weekly recap (mobile) summarises the last completed week

**Date:** 2026-06-15
**Area:** Mobile · Today/Progress · Weekly recap
**Status:** Resolved (pending sim-validation before merge)

## Decision

The mobile **Weekly recap** screen (`apps/mobile/app/weekly-recap.tsx`) now
summarises the **last completed week** (the week that just ended), matching the
web Digest and the weekly-recap push. Previously it built the **current,
in-progress week**.

## Why

A weekly recap is retrospective. On a Monday it was showing "This week ·
Jun 15 – Jun 21 · 1 of 7 days · 248 kcal" — a barely-started week, which is
useless and reads as broken. The web Digest (`ProgressDashboard` → shared
`buildWeeklyRecap`, which subtracts 7 days internally) and the weekly-recap push
(`app/api/push/weekly-recap/route.ts`) already recap the last completed week.
The mobile screen was the only surface rolling its own *current-week* anchor —
so this is a mobile **parity** fix, not new behaviour.

## Scope (deliberately surgical)

- Shifted the recap **stats** anchor 7 days back in exactly two places —
  `weekStats` (the `buildWeekStats` call) and the per-day `dailyTargetsByDay`
  snapshot window. Everything visible is derived from `weekStats`, so the date
  range, "X of 7 days," avg calories, protein, closest-to-target, and the TDEE
  card's "you ate X across Y days" line all correct automatically.
- **Left the TDEE check-in's snapshot logic untouched** — it reads last week's
  stored TDEE at `now − 7` and writes the current week's on exit. Shifting that
  too would *double-shift* the previous-vs-current TDEE comparison.
- **Relabelled** the eyebrow "This week" → "Last week", and the TDEE card header
  "Your TDEE this week" → **"Your adaptive TDEE"** — the card shows the current
  adaptive TDEE vs a week ago (a check-in), so a "this week" time-claim is wrong
  in a last-week recap. (A fuller "last-week-retrospective TDEE" reframe was
  considered and deferred — bigger and riskier; the snapshot for last week is
  only present if the user visited last week.)
- The streak badge stays "as of now" — it's a live, continuous stat.

## Guard

`apps/mobile/tests/unit/weeklyRecapLastWeek.test.ts` source-pins that
`buildWeekStats` is fed a `− 7` anchor (not a bare `new Date()`) and that the
per-day target window is shifted too. Mutation-checked: reverting the
`buildWeekStats` anchor to the current date fails the test.

## Parity

Web already correct (no web change). This brings mobile in line.

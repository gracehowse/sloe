# Today `654:2` conformance — "Sloe" wordmark, single-letter week strip, no Today TDEE line

- **Date:** 2026-06-08
- **Area:** Figma Sloe · Screens / 01 · Today (canonical `654:2`)
- **Status:** Resolved (product choice — match the canonical frame). **Item 4
  (strip→hero `mb-7` widening) superseded 2026-07-20 — see
  [ENG-1609](./2026-07-20-eng1609-today-strip-hero-dead-band.md).** The
  16px wrapper margin that widening introduced was calibrated against a
  `styles.scroll` base gap that later changed (ENG-1356, 2026-07-06), and
  the seam silently doubled into a dead band Grace flagged 2026-07-19.
  Items 1–3 are unaffected and remain current.

## Context

The Today screen was structurally close to the canonical Figma frame `654:2`
but read busier than the calm frame. Four specifics were diffed and closed,
web + mobile, with no loss of wired functionality.

## Decisions

1. **Wordmark casing + weight — "Sloe" (capital S), Newsreader semibold.**
   Supersedes the 2026-06-04 "lowercase `sloe`, medium" call. The canonical
   `654:2` frame renders the wordmark as `font-headline text-xl font-semibold
   text-plum` → "Sloe". Applied to the shared mark on both platforms (web
   `suppr-mark.tsx`; mobile `SloeHeaderWordmark.tsx` + `SupprMark.tsx`) so
   every surface — Today header, sidebar, login, onboarding, import card —
   reads identically. Today brand bar bumped to ~20px (`text-xl`).

2. **Week strip labels — single letters `S M T W T F S`.** Supersedes the
   2026-05-14 "three-letter `Mon/Tue/Wed` for readability" call, which
   pre-dated the canonical Sloe frame. The frame is calmer with single
   letters; the day NUMBER below each letter disambiguates the date (so
   Sat/Sun both reading "S" and Tue/Thu both reading "T" is correct). The rule
   lives in a shared, tested helper (`src/lib/today/weekdayLabels.ts` →
   `weekdayInitials`) consumed by both `DayStrip`s so it can't drift.

   The **conditional logged-pip under each day is kept** — it IS in the
   canonical frame (sage = logged, clay = current/selected, transparent =
   none) and stays wired to `loggedDays` via the existing shared
   `dayStripIndicator`. Only the label format changed.

3. **Adaptive-TDEE line removed from the Today hero.** The frame shows nothing
   between the Goal/Eaten/Bonus stats and the "Room for dinner" coach line.
   The "Adaptive TDEE learning · N of 7 days" presentational line was removed
   from web `today-hero-stats.tsx` (desktop hero) and mobile `TodayHero.tsx`.
   **The underlying logic is preserved** — `countWeighInDaysInWindow` and the
   `tdeeLearnDays` prop are retained for call-site stability; the learning
   state is surfaced on Progress, not Today. The "On track" pill is untouched.

4. **Airier vertical rhythm** to match the frame (greeting `mb-5`, strip→hero
   `mb-7`): greeting bottom 16→20, strip→hero gap widened on both platforms.

## Parity

Web and mobile both change identically — same wordmark, same single-letter
strip, same TDEE-line removal, same spacing intent. No intentional divergence
introduced. iOS leads (primary surface); web follows in parity.

## Verification

- iOS sim Today: wordmark "Sloe", single-letter strip + conditional pip, no
  TDEE line, airy spacing — `apps/mobile/screenshots/agent/today-figma-after-mobile.png`.
- Web (mobile-vp + desktop): wordmark "Sloe" 20px semibold, single-letter
  strip, no TDEE line — `screenshots/web-drive/today-figma-{top,desktop}.png`.
- Typecheck clean web + mobile; affected unit suites green (incl. new
  `weekdayLabels.test.ts` and the rewritten `todayStatusPills` guards).

## Files

Web: `src/lib/today/weekdayLabels.ts` (new), `src/app/components/DayStrip.tsx`,
`src/app/components/ui/suppr-mark.tsx`,
`src/app/components/suppr/today-brand-bar.tsx`,
`src/app/components/suppr/today-hero-stats.tsx`,
`src/app/components/suppr/today-date-header.tsx`.

Mobile: `apps/mobile/components/charts/DayStrip.tsx`,
`apps/mobile/components/SloeHeaderWordmark.tsx`,
`apps/mobile/components/SupprMark.tsx`,
`apps/mobile/components/today/TodayHero.tsx`,
`apps/mobile/app/(tabs)/index.tsx`.

# DayStrip — revert stacked-tile treatment, restore day-letter-above-circle

- **Date:** 2026-05-14
- **Area:** Mobile + web — Today screen / week strip
- **Status:** Resolved
- **Decision by:** Grace
- **Affected files:**
  - `apps/mobile/components/charts/DayStrip.tsx`
  - `src/app/components/DayStrip.tsx`
- **Reverts:** premium-bar audit item F5/F9 ("Stack day initial + numeral into single tile") in `docs/planning/premium-bar-systematic-followups-2026-05-12.md:273`

## Context

The 2026-05-14 premium-bar audit sweep (226 items shipped) included
F5/F9: collapse the two-piece "day-label-above-circle" week-strip
into a single 32×44 stacked pill — date numeral (15px, bold) on top,
single-letter day label (10px, secondary) below. Active day's brand
pill spanned the whole tile.

That change shipped on both mobile (`apps/mobile/components/charts/DayStrip.tsx`)
and web (`src/app/components/DayStrip.tsx`) for parity.

## What broke

Two regressions surfaced once Grace tested in sim:

1. **Past logged days lost their date entirely.** The tile rendered
   a centred green `Check` icon **in place of** the date number, and
   the day-letter underneath was hidden with `opacity: 0`. Result:
   a green pill with just a tick — you couldn't tell whether it was
   the 11th, 12th, or 13th.
2. **The 32×44 pill read as an oval, not a chip.** The aspect ratio
   plus the stacked content made the row feel heavier than the
   pre-audit design. Grace's feedback: "circles and ticks and dates
   have gone weird... they looked better like [the pre-audit
   version]."

## Decision

Revert F5/F9 on both surfaces. Restore the pre-audit shape:

- Three-letter day label ("Mon", "Tue", …) rendered **above** the
  circle (not inside it).
- Circle is a true 30×30 round pill (`borderRadius: 15`).
- Past logged days: green-tinted circle (`Accent.success + "22"`)
  with a centred 2.5-stroke `Check` glyph. **No date number** —
  this matches Grace's reference screenshot and is intentional.
- Selected day: brand-blue circle with the date in white.
- Today (unselected): subtle 2px primary-tint border.
- Snowflake freeze badge still renders top-right.

Web (`src/app/components/DayStrip.tsx`) mirrors mobile pixel-for-
pixel within Tailwind's `w-[30px] h-[30px] rounded-full` primitives.

## Why we're not keeping the stacked tile

- Past-day identification matters more than visual density. Users
  scroll back to log forgotten meals; if past days lose their date,
  the date strip is no longer a date strip.
- The audit logic (one tile per day, single read) was sound on
  paper but the executed pill geometry didn't land. Visual
  validation in sim — which is the rule per
  `feedback_visual_verify_before_commit.md` and
  `feedback_validate_in_sim_before_push.md` — would have caught
  this before push, but the audit sweep batched 226 items and the
  week strip wasn't in the screenshot set.

## How this should shape future audit work

- **Pixel-validate week-strip-style changes in sim before claiming
  the item done.** Code-only inference is not enough for tight
  geometry primitives (30×30 vs 32×44 reads very differently in
  hand).
- **The audit rollup needs a "reverted" lane** alongside
  done/deferred/partial. This is the first revert from the 2026-05-
  14 sweep — track it as a category so future sweeps don't
  re-propose the same change without surfacing the prior reversal.

## Open follow-ups

- None on this surface. The `[d]` marker on F5/F9 in the audit doc
  carries forward as "deferred — pre-audit shape is the chosen
  pattern."
- The 32×44 tile pattern is not banned globally — if a future
  surface (calendar pop-out, week recap) wants stacked tiles, it
  can adopt them on its own merits. This decision is scoped to the
  Today week strip.

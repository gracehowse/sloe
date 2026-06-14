# Card-fill cohesion — Progress insight + Settings Pro cards → flat white (ENG-1081)

**Date:** 2026-06-13
**Area:** Progress tab + Settings (web + mobile)
**Status:** Resolved (flat white shipped). Deliberate-accent alternative ("Option C") parked — see "Circle back".
**Flag:** `card_cohesion_white_v1` (in `REDESIGN_DEFAULT_ON` both platforms; default-on → white, off → the legacy tint).

## Context

A cohesion audit flagged "grey same-rank cards" on Progress + Settings. A
census + on-pixel review (the original captures `04-progress.png` /
`09-settings.png`) found there was **no actual same-rank drift** — the web-Profile
"grey cards" the census first flagged are correct **nested affordances** (a
BMR/TDEE info block, a stat inset inside the white Weight card, list rows), where
the canon allows grey. The only real items were **two deliberate tints** pitched
too weak (~12–16%), so they read as lone grey cards beside white siblings:

- Progress **"This Week" insight** card — `PROGRESS_INSIGHT_LILAC_BG`
  rgba(106,75,122,0.12) / web `var(--slot-dinner-soft)` (Figma 492:2 lilac wash).
- Settings **"Sloe Pro"** banner — `accent.primarySoft` / `color-mix(primary 16%)`.

## Decision

Grace's call (2026-06-13), after a rendered A/B/C comparison + a Withings-grounded
recommendation: **flat white "for now, maybe circle back."**

Both cards render as **flat white slabs** (the canonical resting-card treatment),
flag-gated on `card_cohesion_white_v1`:

- The insight/Pro role is carried by the **✦ sparkle + "THIS WEEK"/"Sloe Pro"
  eyebrow + serif headline** (Progress) and the **✦ + "Manage"** affordance
  (Settings) — not by a card tint.
- Flag-off keeps the exact legacy tint, so the accent idea can be revisited
  without a revert.

### Grounding (the Withings question)

Withings + the issue's Mobbin set (Gentler Streak / Runna / Hevy) keep card
*surfaces* white/neutral with colour in the **data**, but allow **one deliberate,
saturated accent card per screen**. The old ~12% wash failed that test (too weak
to read as intentional → just grey). White (cohesion) or a *strengthened* accent
were both valid; Grace chose white for now.

### Conversion-surface nuance (Settings Pro)

The Settings "Sloe Pro" banner is a **conversion** surface, so flat white may
soften its upgrade pull (it now reads as one more white card, distinguished only
by plum text + Manage). It's the likeliest candidate for an Option-C accent
revisit; the flag makes that a config flip, and conversion can be watched before
deciding.

## Circle back (parked — Option C)

If the white reads too flat (esp. the Pro banner's conversion pull), the revisit
is a **deliberate, saturated accent** (a clear lilac, not a 12% wash) applied as
the single accent per screen — flip `card_cohesion_white_v1` off and strengthen,
or build it as a follow-up. Not started; Grace's call.

## Files

- `apps/mobile/components/today/ProgressHeadline.tsx`, `ProgressStoryGate.tsx`
- `src/app/components/suppr/progress-headline.tsx`, `progress-story-gate.tsx`
- `apps/mobile/components/settings/SettingsBundleContent.tsx`, `src/app/components/Settings.tsx`
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` (flag)
- Tests: `tests/unit/cardCohesionWhite.test.ts` (+ `settingsLaneAubergineOutline.test.ts` updated)

## Verified

iOS sim + web (`--vp mobile`): Progress "This Week" card and Settings "Sloe Pro"
banner now render white, cohesive with their white siblings (vs the grey in the
original captures); ✦ + serif/Manage carry the role. Both typechecks clean; the
cohesion + progress + settings suites green on both platforms.

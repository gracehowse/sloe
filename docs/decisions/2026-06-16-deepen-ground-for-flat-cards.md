# Deepen the page ground so the flat-card grammar registers

**Date:** 2026-06-16
**Status:** Resolved — Grace ("no prototype, just do it") after a Natural Cycles / Withings Mobbin study
**Area:** Design system — page ground tokens, both platforms
**Completes:** `docs/decisions/2026-06-12-flat-card-surfaces.md` (ENG-1078). That decision retired the soft lift and bet card separation on *ground↔card contrast alone* — but left the ground at the near-white splash cream, so the contrast it relied on barely existed.

## Problem

Grace, comparing Sloe's Today against Natural Cycles (and Withings/Fitbit): *"what natural cycles is doing to maintain flat cards … while standing out a little more than sloe."*

All three reference apps use the **same flat-card grammar Sloe already ships** (white cards, no shadow, no border). The difference is the **ground**: NC/Withings sit white cards on a greige ground a clear ~7–9 L\* step below white, so the card pops by tone alone. Sloe's ground was the splash cream `#FBF8F3` (L\*≈98) — only ~2 L\* below the white card. The flat cards had almost nothing to lift off, so they read weaker than NC's identical grammar.

The tonal ladder was effectively inverted: the page ground (L\*≈98) sat *above* the nested-fill token `fillQuiet` `#F2EFE9` (L\*≈95), when the ground should be the **darkest** layer.

This is the missing half of 2026-06-12 — not a reversal. The shadow was already correctly retired; the contrast it was replaced with was never actually created.

## Decision

Deepen the **working page ground** (light mode) a **gentle** step on both platforms; leave card, fills, and all elevation tokens untouched.

| Token | Was | Now | L\* gap to white card |
|---|---|---|---|
| `background` / `--background` | `#FBF8F3` | `#F3F0E8` | ~2 → **~5** |
| `backgroundSecondary` / `--background-secondary` | `#F6F5F2` | `#EFEBE1` | ~3 → **~7** |

`backgroundSecondary` deepens too because it is the second card-bearing ground (recipe detail renders flat white cards on it) — leaving it would let recipe detail keep the weak separation Today is fixing, i.e. drift.

### Calibration (the first pass was too dark)

The first attempt dropped to `#EFE8DA` (L\*≈92, ~7.6 gap) — matching NC/Withings' *lightness* gap directly. Grace red-lined it as too dark. The mistake was moving two axes at once: lightness **and** chroma (the cream's R−B warmth jumped 8 → 21). A saturated warm tan carries far more visual weight than NC's near-neutral greige at the *same* lightness, so L\*92 read heavy rather than airy. The correction keeps the cream's **original low warmth** (R−B≈11) and takes only a gentle lightness step to L\*≈95 (~5 gap). Separation now comes from the modest tonal step **plus** the temperature contrast of a neutral-white card on a warm ground — which is how light apps (NC, Things, iOS Settings) get flat cards to lift on an L\*94–96 ground without looking dark. We borrowed the *grammar*, not NC's literal lightness number.

**Unchanged:** white `--card` (#FFFFFF), `fillQuiet` (#F2EFE9), `inputBg` (#F6F5F2), every elevation token (cards stay flat — that grammar was already right), dark mode (the dark card #232126 already lifts off the dark ground #19181C).

## Constraints honoured

- **Still warm cream, not grey.** `#F3F0E8` keeps the original cream's gentle warmth (R−B≈11), not Withings' cooler grey — the brand-equity line from 2026-06-12 holds. We borrowed NC/Withings' flat-card *grammar*, not their hue or their literal lightness.
- **Light, not dark.** L\*≈95 page / L\*≈93 secondary — both stay clearly in the "light cream" register; the ~5 L\* gap to the white card does the lifting.
- **Splash/icon ground stays `#FBF8F3`** (`app.json`, pinned by `brandIconSplash.test.ts`). The splash is a momentary launch frame, not a card-bearing surface, so it needs no contrast step. The minor seam between splash cream and the slightly-deeper working ground is deliberate.
- **A11y.** Secondary text on the deepest ground stays AA (and improves vs the first pass): `--foreground-secondary` #6A6072 on `#EFEBE1` ≈ 5.0:1, on `#F3F0E8` ≈ 5.2:1 (≥4.5). Tertiary text was already large/decorative-only on the ground (sub-AA before and after).

## Parity

Mobile `apps/mobile/constants/theme.ts` and web `src/styles/theme.css` move in lockstep (same two values). Guard tests updated: `apps/mobile/tests/unit/todayFlatCardFigma.test.ts`, `tests/unit/todayCardElevationSweep.test.ts`.

## Validation

Sim (iOS) + web capture, Today + recipe detail, light + dark, before/after — pending in the same change (Grace declined a prototype; in-sim validation still required per the visual-validation rule).

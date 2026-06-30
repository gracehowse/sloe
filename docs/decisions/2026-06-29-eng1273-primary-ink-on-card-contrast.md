# ENG-1273 — primary INK as small text on the dark card/page: dark-mode AA fix

**Date:** 2026-06-29
**Status:** Implemented
**Scope:** web (`src/` + `app/`) + mobile (`apps/mobile/`)
**Related:** ENG-828 (`docs/decisions/2026-06-29-eng828-primary-tint-text-contrast.md`)
— this is the **deferred follow-up** that doc's "Scope boundary" flagged.
ENG-1109 / ENG-1217 (the macro `-solid` discipline this mirrors),
`docs/decisions/2026-06-08-aubergine-accent-system.md` (the token system),
ENG-1219 (legal/marketing brand-palette migration — one spot-check adjusted, below).

## The defect ENG-828 carved out

ENG-828 fixed the **chip/badge/pill class**: `text-primary` co-located with a
`bg-primary/N` tint fill. Its scope-boundary explicitly carved out the larger,
sibling class:

> `text-primary` / `accent.primary` used as small text on the **dark card or
> page** (no tint) — e.g. ghost-link CTAs. `#7E5C92` on the dark card is 3.08:1
> (FAIL); the dark background is 3.50:1 (FAIL).

Tailwind's `text-primary` maps to `--primary` — the primary *FILL* hue. In dark
that fill is the OLED-lifted `#7E5C92`, which is correct as a 3:1-graphical FAB
/ border / ring fill, but reads only ~3.08:1 as small text on the dark card
`#211A2A` and ~3.50:1 on the dark page ground `#120D18` — below WCAG AA-normal
(4.5:1). The mobile twin is `accent.primary` (dark `#7E5C92`) inked as small
text. Ghost-link CTAs, credit lines, inline legal links, on-card data values,
section overlines — all hit this across the app.

## The fix (mirrors the macro / ENG-828 `-solid` discipline)

Ink the text/link with the AA-safe **`text-primary-solid`** (web) /
**`accent.primarySolid`** (mobile) — `--primary-solid` → `#3B2A4D` light /
`#C4ACD0` dark; mobile `primarySolid` `#3B2A4D` / `primarySolidDark` `#C4ACD0`.

- **Light is a pixel-identical no-op** — in `:root`, `--primary-solid` ===
  `--primary` (both `#3B2A4D`); mobile `primarySolid` === `primary`. The swap
  changes nothing in light.
- **Dark lifts the text** from `#7E5C92` (3.08:1 card / 3.50:1 page) to
  `#C4ACD0` (8.15:1 card / 9.6:1 page) — AA PASS in both contexts.

This is exactly the fill-vs-text split the aubergine system prescribes; the FAB
/ outline-border / ring keep the `--primary` fill (correct at the 3:1 graphical
bar), and small TEXT moves to `-solid`.

### What was swapped — and what was deliberately left alone

**Mobile** — swapped TEXT-ink sites only: `color: accent.primary` →
`color: accent.primarySolid` at **76 sites across 42 files** (import-shared,
barcode, recipe/verify, recipe/[id], meal-nutrition, shopping, create-recipe,
TodayScreen, DigestBlended, FoodSearchPanel, BarcodeScannerModal, the today/*
banners and sheets, the onboarding reveal, …). **Left alone:**
`backgroundColor` / `borderColor` / SVG `Stop` / `icon color={accent.primary}`
— the 3:1 graphical bar is correct for non-text fills/glyphs.

**Web** — swapped `text-primary` → `text-primary-solid` on TEXT/link sites:
**~113 tokens across 58 files** (legal pages terms/privacy/licences/dmca/help,
checkout success, billing fallback, the suppr/* dialogs and cards, household
links, progress data values, onboarding step labels, …). **Skipped:**
nav-active / selected states (desktop-sidebar nav, DayStrip active day,
RecipeDetail active tab, today-week-view current-day, plan-portion selected,
recipe-notes active), icon-only glyphs (`<Icons.*>`, `<Loader2>`, `<Sparkles>`,
SVG, icon-only buttons), form-control accents (checkbox / radio indicator), and
`bg-primary` tint backgrounds (the ENG-828 chip class, already correct).

### Pinned screen files

`TodayScreen.tsx`, `NutritionTracker.tsx`, and `recipe/[id].tsx` are touched
**only as in-place colour-string swaps** — **zero line growth**.
`npm run check:screen-budget` stays green (none grew; no new file crossed 400).

## Why a measured swap, not a token redefinition

`--primary` / `accent.primary` is the brand *fill* hue and is correct as a
3:1-graphical FAB / border / ring. Darkening it would wreck the FAB identity.
The fill-vs-text split (`--primary` vs `--primary-solid`) is the deliberate
Sloe pattern; this change respects it rather than collapsing it.

## Regression guard

Measured-contrast guards, following the `eng828PrimaryTintContrastCensus` /
`eng1109MacroContrastCensus` pattern:

- `tests/unit/eng1273PrimaryInkOnCardContrastCensus.test.ts` (web; reads both
  `theme.css` and the mobile `theme.ts`) — pins the bare-fill dark on-card/page
  failure (<4.5:1), the `-solid` AA pass on both the card and the page in both
  schemes, the light no-op, web↔mobile token parity, and canonical
  ghost-link / on-card call sites (terms/licences links, HouseholdBar,
  import-shared, recipe/[id]).
- `apps/mobile/tests/unit/eng1273PrimaryInkOnCardContrast.test.ts` (mobile) —
  pins the mobile token ratios on the dark card/page + call sites, and asserts
  no on-card TEXT `color:` ink survives as the bare `accent.primary`.

## One test adjusted (not silenced)

`tests/unit/legalMarketingBrandPalette.test.ts` (ENG-1219) spot-checked
`BillingUnavailableFallback.tsx` for `text-primary underline underline-offset-2`.
Those are on-card legal links that ENG-1273 routes to the AA-safe
`text-primary-solid` (the bare fill failed AA on the dark page). The assertion
was updated to `text-primary-solid underline underline-offset-2` — still a
primary-brand token (the guard's real intent: not `violet-`, not a literal hex),
now pinning the contrast-correct ink. ENG-1219 itself already made this exact
move for the whats-new "Latest" badge.

## Verification

`npm run test` (web, 9039 pass) · `npm run mobile:test` (mobile, 3323 pass) ·
`npm run typecheck` · `npm run mobile:typecheck` · `npm run check:screen-budget`
(green) — all clean.

# Empty + Show-macros ring parity, and equal-width macro toggle (ENG-1093)

**Date:** 2026-06-13
**Area:** Today tab / calorie ring + macro toggle (web + mobile)
**Status:** Resolved
**Flag:** `ring_empty_macro_parity_v1` (in `REDESIGN_DEFAULT_ON` both platforms; off → pre-ENG-1093, empty always shows the single cold-open loop). The toggle equal-width is an unflagged layout bugfix.

## Context

Grace (2026-06-13, design-review on the Today hero, with empty + populated
screenshots):

> "hide macros / show macros should be the same width and empty should also be
> the same width. empty with show rings should look exactly like the populated
> one just with it unpopulated."

Two distinct defects on the calorie hero:

1. **Empty + Show-macros didn't mirror a populated day.** ENG-1086 painted the
   empty ring as a single confident gradient loop and *hid* the inner macro
   tracks in every empty state (`expanded && !isEmpty`). So when a user on an
   empty day tapped **Show macros**, they got the same single fat loop — not the
   multi-ring structure a populated day shows. The "show rings" affordance did
   nothing visible.
2. **The toggle wobbled.** "Show macros" (74px) and "Hide macros" (69px) render
   at different widths in Inter (the strings are equal length but `Show`/`Hide`
   differ in glyph width); the centred control shifted ~5px between states.

## Decision

### 1. Scope the cold-open loop to *collapsed*-empty; show the unpopulated multi-ring when macros are shown

- **Empty + macros HIDDEN (collapsed)** → unchanged: the ENG-1086 brand-gradient
  cold-open loop (bold 0.085·S stroke + "of N kcal" budget line).
- **Empty + macros SHOWN (expanded)** → the populated multi-ring rendered
  **UNPOPULATED**: the grey calorie track + 3 grey macro tracks at the normal
  (thin, macro-matched) stroke, no fills, no cold-open hairline. Identical in
  structure to a populated day — just with empty arcs. Exactly Grace's contract.

Mechanics (mobile `CalorieRing`/`SkiaRingArcs`, web `DailyRing`, in lockstep):

- `showEmptyLoop = isEmpty && emptyGradientOn && !(emptyMacroParityOn && expanded)`
  drives the gradient sweep + bold stroke (was raw `isEmpty`), so the loop only
  paints while macros are hidden.
- Macro tracks render on `expanded && (!isEmpty || emptyShowsMacros)` (was
  `expanded && !isEmpty`). With empty fills clamped to 0, only the grey tracks
  show.
- The empty cold-open hairline is dropped when macros are shown
  (`isEmpty && !emptyShowsMacros`) so it doesn't double the calorie track.

This changes only the *empty + expanded* render. State-colour semantics (empty
loop / under plum fill / over plum-capped + centre verdict) are untouched.

### 2. Equal-width toggle (unflagged bugfix)

Pin the toggle label to a single centred footprint: `minWidth: 84` +
`textAlign: "center"` (mobile), `min-w-[84px] text-center` (web). Both labels
(≤74px) sit inside 84px and centre, so the control is byte-stable across states.
Not flag-gated — it's a layout defect fix with no behavioural surface.

### Flag choice — dedicated, not on `ring_empty_gradient_v1`

ENG-1086's flag is the cold-open *loop*. A regression in the empty-multi-ring
parity should be independently revertable, so this ships behind its own
`ring_empty_macro_parity_v1` (default-on), with the pre-ENG-1093 behaviour
(empty always shows the single loop) alive in the off path — per the CLAUDE.md
flag contract. Both flags compose cleanly: with parity off, empty behaves exactly
as it did after ENG-1086.

## Files

- `apps/mobile/components/charts/CalorieRing.tsx` — `showEmptyLoop`, `emptyMacroParity` prop wiring, SVG hairline gate
- `apps/mobile/components/charts/SkiaRingArcs.tsx` — `emptyShowsMacros`, macro-track + hairline conditions
- `apps/mobile/components/today/TodayHeroRing.tsx` — equal-width toggle
- `src/app/components/suppr/daily-ring.tsx` — `emptyShowsMacros`, `showEmptyGradient`, macro-ring + hairline conditions (web parity)
- `src/app/components/suppr/today-hero-ring.tsx` — equal-width toggle
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` — `ring_empty_macro_parity_v1` in `REDESIGN_DEFAULT_ON`
- `src/app/components/suppr/daily-ring.stories.tsx` — 4-state + side-by-side Chromatic regression stories
- Tests: `tests/unit/ringEmptyMacroParity.test.ts` (new); `tests/unit/ringEmptyGradient.test.ts` (updated to the collapsed-scoped loop)

## Verified

- **Web** (Storybook, real `DailyRing`, flags default-on): empty + Show-macros
  renders the 4-track unpopulated multi-ring, structurally identical to populated
  + Show-macros (side-by-side capture). Empty + Hide-macros keeps the cold-open
  loop. Toggle: "Show macros" 74px / "Hide macros" 69px both pin to the 84px box.
- **iOS sim** (Today cold-open, consumed = 0, Skia path): empty + Show-macros
  shows the unpopulated multi-ring; tapping **Hide macros** collapses to the
  single cold-open loop. The toggle frame is byte-identical across states
  (`x=159, width=84` for both labels — forensic AX-frame match).
- Web + mobile ring/hero suites green (35 + 28); both typechecks clean.

## Related

- ENG-1086 — [empty cold-open brand-gradient loop](2026-06-13-empty-ring-brand-gradient-loop.md) (this scopes that loop to collapsed-empty).
- ENG-1064 — multi-ring hero stroke = macro stroke (the geometry the unpopulated tracks inherit).

# Decision: one sheet radius (24) + amended nested-inset standard (12)

- **Date:** 2026-06-10
- **Status:** Resolved (Claude call per Grace's "decide based on your research" instruction; revisit-on-sight applies)
- **Area:** Design system (mobile-led, web mirrors)
- **Source:** 2026-06-10 consistency census, cards dimension (needsDecision clusters)

## 1. Bottom sheets: ONE top radius = 24 (`SHEET_RADIUS`)

Census found six live top-corner styles (8, 12, 18, 20, 24, 28) across
~49 hand-rolled sheet shells. Decision: **24**, exported as a named
`SHEET_RADIUS` constant beside `CARD_RADIUS` in `SupprCard.tsx`.

Why 24 and not the iOS-native ~10 or the mid-pack 20:
- **One material grammar.** Cards and sheets are the same warm surface
  in the Sloe system (`colors.card` fill, same hairline rules). Sharing
  the 24 corner makes "lifted warm surface" read as one material whether
  it rests (card) or rises (sheet).
- **Aesthetic class comps.** The warm-editorial apps we benchmark against
  (Mobbin pulls: BitePal's swap/log sheets, Alma's portion sheet) run
  large soft sheet corners in the 22–28 band; tight ~10pt corners read
  system-default/utilitarian — the opposite of the editorial posture.
- **Adoption cost.** 8 shells already sit at 24; the LogSheet (the most
  used sheet in the app) moves 8→24 — the single highest-visibility win.

## 2. Nested panels: AMEND the spec — inset = Radius.xl (12), not 24

The documented `SupprCard size="inset"` (radius 24 + hairline, flat) has
**zero adoption**; live nested panels run 6/8/12/16. The census framed
this as an adoption failure. It isn't — **the spec was optically wrong**:

- **Concentric-corner principle** (standard industrial/UI practice —
  inner radius ≈ outer radius − inset padding): inside a 24-radius card
  with 12–20pt padding, the optically correct inner radius is ~8–12.
  A 24-radius panel nested inside a 24-radius card at 16pt padding
  produces visibly clashing corner arcs.
- The largest existing cluster (LogSheet confirmCard, barcode tiles,
  QuickAddPanel at 8–12) was already converging on the optically right
  answer by instinct.

**Standard: nested/inset panels = `Radius.xl` (12) + hairline border +
flat (no shadow).** `SupprCard size="inset"` updates to radius 12 and
becomes the documented target; the 6/8/16 stragglers converge to 12.

## 3. Recipe-detail inverted cards (white-on-cream) — converge

Everywhere else: white/near-white page ground, warm cream `colors.card`
surfaces. Recipe detail inverts it (cream ground, white card fills on
nutrition/source cards) — undocumented, single-screen, and it breaks the
"one material" grammar that the rest of this decision establishes. The
hero image + serif title carry recipe detail's editorial identity; the
card fill inversion adds inconsistency, not signature. **Converge to the
canonical shell** (cream cards, CARD_RADIUS, soft lift, no always-on
border in light). Pixel-verify the ingredient-grid contrast against the
cream cards before shipping (tiles currently tuned for white).

## Provenance note: Today macro tiles → soft lift

Applied 2026-06-10 as one-card-decision residue, NOT a new call: the
2026-06-09 decision's decider line is Grace's own review ("the ring card
is raised. the macro cards are flat" = multiple styles fighting), and its
text mandates soft for every page-ground card. The tiles' in-code `flat`
comment cited the superseded 2026-06-04 flat-slab direction. If the
rendered result reads wrong on sight, the consistent alternative is
flat-EVERYTHING-on-Today (revisit the 2026-06-09 decision), never a
mixed state — one prop per card either way.

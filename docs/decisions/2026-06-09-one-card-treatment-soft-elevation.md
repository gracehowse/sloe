# One card treatment per surface — soft elevation for page-ground cards

**Date:** 2026-06-09
**Status:** Resolved
**Area:** Design system / elevation
**Decider:** Grace ("on every page there are multiple styles fighting… the ring card is raised. the macro cards are flat")
**Supersedes:** the 2026-06-04 "flat slabs" sweep direction (commit 664df1cb) as the *default* card look. The FLAT variant remains in the system for nested/inset use.

## Decision

Every card that sits **directly on the page ground** (the screen/scroll
background) uses the **soft lift**:

- Mobile: `<SupprCard lift="soft">` / `useCardElevation({ variant: "soft" })`
  (light → `Elevation.cardSoft` shadow; dark → tonal lift + hairline).
- Web: the `card-slab` class (`--elev-card-soft`).

Cards **nested inside another card** (inset tiles, rows inside a sheet,
sub-panels) stay **flat** — a card inside a card must not double-shadow.

## Why

The 2026-06-04 flat-slabs pass left a mixed state: the Today hero ring was
re-raised ("audit gap 6" — the most important card read as an undifferentiated
slab) while sibling macro tiles stayed flat. Grace's 2026-06-09 review: a
raised card next to flat cards on the same surface reads as "multiple styles
fighting" — the opposite of premium. One treatment, applied consistently,
is the premium move. This also re-resolves the original "cards still blend
into the background on-device" problem (2026-06-04) that motivated
`Elevation.cardSoft` at 16% — flat had quietly reintroduced it.

## Related, unchanged

- `useCardElevation()` hook **default stays `flat`** (the system contract
  pinned by `cardElevationVariants.test.tsx`) — call sites opt into soft.
- Empty states stay **calm-minimal** (Grace 2026-06-09); elevation is a
  card-chrome axis, not a content-richness axis.
- Guard tests from the flat-slabs era (`todayCardElevationSweep`,
  `todayFlatCardFigma`, `settingsElevationFlag`, …) are re-pinned to this
  rule rather than deleted.

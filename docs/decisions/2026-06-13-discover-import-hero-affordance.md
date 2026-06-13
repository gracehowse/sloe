# Discover import-from-Reel card → hero affordance (ENG-1087)

**Date:** 2026-06-13
**Area:** Recipes tab / Discover (web + mobile)
**Status:** Resolved (treatment); web mobile-web *position* tracked in ENG-1089
**Flag:** `discover_import_hero_v1` (in `REDESIGN_DEFAULT_ON` both platforms; legacy nav-row slab is the `else` kill switch)

## Context

The senior-designer read (2026-06-13) flagged that the **import-from-Reel card —
the viral-hook acquisition surface, our stated growth wedge — rendered as a flat
grey-lilac settings row** (`primarySoft`, 12% tint) with a soft icon + a passive
chevron. It had *less* visual weight than the recipe photo cards below it, so the
one feature meant to pull MFP refugees in read as the least important thing on
Discover.

## Decision

Keep the **tinted-slab grammar** (the flat-card law holds — the import card is a
deliberate tinted affordance, not a white recipe card) but **raise the weight** so
it out-ranks a settings row without becoming a solid slab:

- **Tint:** new `Accent.primarySoftStrong` / `--accent-primary-soft-strong`
  (~20%, vs 12% soft). Louder, still a tint.
- **Icon:** a **solid plum circle** (`primarySolid`) with a **white glyph** —
  replaces the soft-tinted IconBox.
- **Title:** `Type.headline` (Newsreader serif, 17/22) — editorial weight,
  aligned with recipe titles, replacing the sans control label.
- **Affordance:** a filled **"Paste link" pill** (`primarySolid`, white text)
  replaces the passive chevron — *do-it-here*, not *navigate-elsewhere*. The
  whole slab stays the single tap target (→ import/paste); the pill is the
  affordance, not a nested pressable.

### Why a new token (not bump `primarySoft`)

`primarySoft` (12%) is shared by every selected pill / segmented-active / nudge
tint across both apps. Bumping it would over-darken all of those. The stronger
fill is reserved for the ONE hero tinted-slab affordance, so it gets its own
token. Flat-card law still holds — the tint IS the separation, just louder.

### Scope: treatment only

This change is treatment (weight). The **rendered position on web mobile-web** is
a separate, pre-existing parity gap: Wave 4 (2026-05-02) inserted the cuisine
cluster carousels *above* the import card, so on web mobile-web it renders at
`top≈2586px` (below 5 carousels) while mobile shows it first. That reorder
touches the intricate web feed structure (desktop grid vs mobile-web carousels vs
3-section, empty/filtered branches) and is tracked + gated separately in
**ENG-1089**.

## Files

- `apps/mobile/app/(tabs)/discover.tsx` — flag-gated hero + legacy slab
- `src/app/components/DiscoverFeed.tsx` — flag-gated hero + legacy slab (web parity)
- `apps/mobile/constants/theme.ts` + `apps/mobile/context/theme.tsx` —
  `primarySoftStrong` (+ dark variant)
- `src/styles/theme.css` — `--accent-primary-soft-strong` (`:root` + `.dark`)
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` — flag in
  `REDESIGN_DEFAULT_ON`
- Tests: `tests/unit/discoverThreeSectionLayout.test.ts`

## Verified

iOS simulator (Discover): the import card now leads with a stronger tint, solid
plum icon, serif title, and "Paste link" pill — first card under the filters.
Web (`--vp mobile`, element capture): identical hero treatment, fill confirmed
`rgba(91,59,110,0.2)`. Token-parity + hex-sweep suites green; both typechecks
clean.

# Discover import card renders above the cluster carousels on web mobile-web (ENG-1089)

**Date:** 2026-06-13
**Area:** Recipes tab / Discover (web)
**Status:** Resolved
**Flag:** `discover_import_above_carousels_v1` (web `REDESIGN_DEFAULT_ON`, default-on; legacy below-carousels position is the kill switch). **Web-only** — mobile has no carousel branch.

## Context

Follow-up to ENG-1087 (import card → hero affordance). The hero *treatment*
shipped on both platforms, but on **web mobile-web the import card rendered at
`top ≈ 2586px` — below all 5 cuisine cluster carousels** (Mediterranean → Asian
→ Latin → Comfort → Healthy bowls), while **mobile native shows it first**, right
under the filter chips. That's a web↔mobile parity violation and it buried the
viral-hook acquisition surface.

Root cause: Wave 4 (2026-05-02) inserted the carousels block *above* the
pre-existing `md:hidden` import block. The import card's own comment still stated
the documented intent — *"Import is the first thing the user sees on Discover,
not buried"* — which the carousel insertion silently broke. Mobile dropped the
carousel branch entirely, so mobile was unaffected.

## Decision

Render the import card **above the carousels** on web mobile-web, restoring the
documented import-first intent and web↔mobile parity. The carousels stay (web's
accepted divergence) — they just sit below the import hero.

Implementation: the import card JSX is extracted into an `importCard` const
(declared before `return`) and rendered at exactly **one** of two positions,
chosen by the flag — no duplication, so the `data-testid="discover-import-cta-top"`
count is unchanged (still 2: hero + legacy variants):

- Flag-on (default): `{importAboveCarousels ? importCard : null}` immediately
  before the `showClusterCarousels` block → import is the first feed item.
- Flag-off (kill switch): `{importAboveCarousels ? null : importCard}` at the old
  below-carousels position → exact pre-change behaviour.

Desktop is unaffected: `importCard` keeps `className="md:hidden"`, so it never
renders at `md+` regardless of position (verified — `importVisibleOnDesktop:
false`, carousels + grid unchanged).

### Why flag-gated (and why web-only)

Per the CLAUDE.md flag rule, layout/order changes ship behind a flag with the old
path in the `else`. Here the flag also gives Grace a clean veto on the web IA
question (import-first vs carousels-first on web) without a redeploy. The flag is
**web-only** — mobile already shows import first and has no carousels, so there's
nothing to gate; it's deliberately not added to the mobile `REDESIGN_DEFAULT_ON`.

## Files

- `src/app/components/DiscoverFeed.tsx` — `importCard` const + flag-gated dual position
- `src/lib/analytics/track.ts` — `discover_import_above_carousels_v1` in `REDESIGN_DEFAULT_ON`
- Tests: `tests/unit/discoverThreeSectionLayout.test.ts`

## Verified

Web (`--vp mobile`, `/discover`): import card at `top=318` (was `2586`), carousels
at `459` → import above carousels. Default + search-active states both lead with
the import card (carousels correctly absent when filtered; "Eating out" sits above
import in search mode — same conditional as mobile). Desktop (`--vp desktop`):
import hidden, carousels + grid unchanged. Discover layout + cluster-carousel
suites green; web typecheck clean.

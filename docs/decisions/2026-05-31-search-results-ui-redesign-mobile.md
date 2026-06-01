# Food-search results UI redesign — mobile (ENG-814)

- **Date:** 2026-05-31
- **Area:** Today / logging — food search
- **Status:** Resolved
- **Owner:** executor (mobile lane)
- **Platforms:** mobile (web sibling lane = ENG-815)
- **Flag:** `redesign_search_results` (canonical umbrella key — see
  `docs/planning/2026-05-31-redesign-implementation-plan.md` flag registry)

## Problem

The mobile `FoodSearchPanel`
(`apps/mobile/components/food-search/FoodSearchPanel.tsx`) carried two clashing
filter grammars (the LogSheet's `Recent│Library│Saved meals` browse tabs on the
empty-query surface, and the panel's own `All／Recents／Custom／Branded／Generic`
pill row on the results surface), rendered results as a flat hairline list, and
signalled confidence with a ~14px green `CheckCircle2` tick — nearly invisible,
and sharing its green with the macro "P" letter so "verified" and "protein"
read as one colour. This is the mobile mirror of the prototype's "After" state
in `docs/prototypes/2026-05-31-design-direction/surface-search-results.html`.

## Decision

Behind `redesign_search_results`, the panel's results body becomes the
prototype's "After" treatment. The old pill row + flat hairline list +
`CheckCircle2` tick stay alive in the `else` branch (flag-OFF default) so the
change ramps safely via PostHog.

### What the flag-ON path renders

1. **One unified segmented control** — softly-elevated rounded-rect segments
   (active on `Accent.primary`) with the prototype's friendlier labels:
   `All · Recent · My foods · Branded · Generic`. Each segment is the SAME real
   `FoodCategory` filter as the flag-off pills (`My foods` = Custom, `Recent` =
   Recents). The `food-search-category-*` testIDs keep the internal value
   (`Recents`, `Custom`) so Maestro selectors stay stable.
2. **Softly-elevated grouped result cards** — rows live inside a per-section
   `Radius.lg` card carrying the soft-elevation treatment from
   `useCardElevation()` (light = `Elevation.cardSoft` shadow + no border;
   dark = tonal lift via `cardElevated` + hairline; flag-off-elevation = flat).
   Rows within a card are seamed with a faint hairline inset, not a
   hairline-as-divider.
3. **Best matches / More results split** — via the shared
   `splitFoodSearchResults` → `splitBestMatches` (same `BEST_MATCH_MIN_SCORE`
   threshold + scorer as web, from `foodSearchRanking.ts`), so both surfaces
   section identically. The split is flattened into a discriminated FlatList
   feed so pagination (`onEndReached`), the no-result empty state and the
   persistent footer stay on the SAME FlatList as the flat path.
4. **Legible confidence chip** — the canonical shared
   `<SearchResultConfidenceChip>` (soft-blue **Verified** `Check` / amber
   **Estimated** `Info`), also used by the barcode + voice-log result surfaces
   so the chip language can't drift between logging entry points. Sourced from
   the data layer's `confidenceTier` (stamped in `mergeResults` from BOTH
   provenance AND match score — ENG-807). Custom rows keep their existing
   "Custom" Badge.

The commit-CTA blue (`design_system_colours`) and the soft-elevation token
(`design_system_elevation`) landed in earlier phases; this issue consumes them.

## Honest-confidence guardrail

The chip renders `item.confidenceTier`. The tier is the real signal
(`searchRowConfidenceTier`: authoritative provenance AND match score ≥
`VERIFIED_TIER_MIN_SCORE`), so a "Verified" chip is always backed by the model
(CLAUDE.md trust posture: never a confidence label that isn't backed by a real
signal). A defensively-absent tier falls back to the CONSERVATIVE "Estimated"
label — never "Verified" — so a missing signal can never over-claim trust. In
production every merged row carries a tier, so this is an edge-case guard only.

## "Saved meals" deliberately not added to the panel

The prototype's 5-segment set includes `Saved meals`. The panel has **no
saved-meals data source** — saved meals live in the LogSheet browse grammar (a
sibling surface, not this panel). Shipping a `Saved meals` segment here would be
a no-op dead affordance (cf. the favourites tab removed in ENG-748 #8), so it is
intentionally omitted; every segment in the unified control is backed by a real
filter. This is a backing-logic divergence, not drift.

## Web ↔ mobile parity

- **Same flag** (`redesign_search_results`), same prototype, same shared
  tier + split math (`foodSearchRanking.ts`).
- **Same conservative-fallback rule** — absent tier → "Estimated", matching the
  web sibling (ENG-815).
- **Segment set differs by backing logic, not by intent:** web ships
  `All / Custom / Branded / Generic` (no `recentFoods` prop on web), mobile
  ships `All / Recent / My foods / Branded / Generic` (mobile has a recent-foods
  strip). Both omit `Saved meals` for the same "no backing source" reason. When
  each platform wires the missing data sources the segment sets converge.

## Tests

- `apps/mobile/tests/unit/foodSearchRedesignResults.test.tsx` — flag-ON unified
  labels + stable filter testIDs, Best/More section headers from the shared
  split, Verified vs Estimated chip from `confidenceTier`, conservative
  fallback to "Estimated" on an absent tier, and the flag-OFF flat path
  (old pill labels, no section headers, no confidence chip).
- Existing suites re-run green: `foodSearchNoResultLoopMobile`,
  `foodSearchCategoryTabs` (source-pin), `foodSearchModalFitThisIn`,
  `foodSearchPanelLocaleParity`, `foodSearchPrimaryServingParity`,
  `foodSearchFatSecretMerge`, `foodSearchPagination`, `logSheetPhase3`,
  `logSheetSlotSelector`.

## Cross-reference

- ENG-807 — best-match ranking + honest confidence tier (data layer):
  `docs/decisions/2026-05-31-search-best-match-ranking-and-honest-confidence.md`
- ENG-815 — web sibling lane (same flag, same prototype):
  `docs/decisions/2026-05-31-search-results-ui-redesign-web.md`

# Food-search results UI redesign — web (ENG-815)

- **Date:** 2026-05-31
- **Area:** Today / logging — food search
- **Status:** Resolved
- **Owner:** executor (web lane)
- **Platforms:** web (mobile sibling lane = ENG-814)
- **Flag:** `redesign_search_results` (canonical umbrella key — see
  `docs/planning/2026-05-31-redesign-implementation-plan.md` flag registry)

## Problem

The web `FoodSearchPanel`
(`src/app/components/food-search/FoodSearchPanel.tsx`) rendered search results
as a flat hairline list with a ~14px green `Icons.check` tick as the only
confidence signal — nearly invisible, and it shares its colour with the green
macro "P" letters so "verified" and "protein" read as the same thing. It also
had **no category filter at all**, leaving it behind the mobile panel. This is
the web mirror of the prototype's "After" state in
`docs/prototypes/2026-05-31-design-direction/surface-search-results.html`.

## Decision

Behind `redesign_search_results`, the results body becomes the prototype's
"After" treatment. The old flat list stays alive in the `else` branch (flag-OFF
default) so the change ramps safely via PostHog.

### What the flag-ON path renders

1. **One unified segmented control** — `All · Custom · Branded · Generic`,
   horizontally scrollable, active chip on `bg-primary`. Each chip is a real
   `_source` filter over the merged results (`Custom` = user-authored, `Branded`
   = FatSecret Premier, `Generic` = USDA/OFF/Edamam/Generic*). No dead chips.
2. **Elevated grouped result cards** — rows live inside a `rounded-2xl bg-card`
   surface carrying `--elev-card-soft`; rows within a card are seamed with a
   faint `inset` shadow, not a hairline-as-divider.
3. **Best matches / More results split** — via the shared
   `splitFoodSearchResults` → `splitBestMatches` (same threshold + scorer as
   mobile, from `foodSearchRanking.ts`), so both surfaces section identically.
4. **Legible confidence chip** — soft-blue **Verified** (`Icons.check`) /
   amber **Estimated** (`Icons.info`), sourced from the data layer's
   `confidenceTier` (stamped in `mergeAndDedup` from BOTH provenance AND match
   score — ENG-807). Custom rows keep their existing "Custom" badge, not a
   confidence chip. The row byline names the source (`per 100g · USDA`).

The commit-CTA blue (`design_system_colours`) and the soft elevation token
(`design_system_elevation` → `--elev-card-soft`) landed in earlier phases; this
issue consumes them.

## Honest-confidence guardrail

Chips render `item.confidenceTier` only — never `item.verified` alone. The tier
is the real signal (`searchRowConfidenceTier`: authoritative provenance AND
match score ≥ `VERIFIED_TIER_MIN_SCORE`). This satisfies the CLAUDE.md trust
posture: no confidence label that isn't backed by the model. We never invent a
tier; a defensively-absent tier falls back to "Estimated" (the conservative
label), never "Verified".

## Web ↔ mobile parity

- **Same flag** (`redesign_search_results`), same prototype, same shared
  tier + split math.
- **Category set is `All / Custom / Branded / Generic` on web** — the
  prototype's aspirational 5-tab set (`Recent`, `Saved meals`) is **not** wired
  on the web panel: the web `FoodSearchPanel` has no `recentFoods` prop and no
  saved-meals filter, so shipping those tabs would be dead affordances. Mobile's
  extra `Recents` tab only toggles a separate recent-foods strip the web panel
  doesn't render. This is a backing-logic divergence, not drift — when web wires
  a recents/saved-meals data source the tab set converges.

## Tests

- `tests/unit/foodSearchPanelRedesign.test.tsx` — flag-OFF legacy list vs
  flag-ON redesigned container, Best/More grouping, Verified vs Estimated chip
  from `confidenceTier`, segmented-control source filtering + empty-category
  hint.
- `tests/unit/foodSearchConfidenceTierParity.test.ts` (ENG-807) — pins that web
  + mobile derive the tier + split from the one shared module.

## Cross-reference

- ENG-807 — best-match ranking + honest confidence tier (data layer):
  `docs/decisions/2026-05-31-search-best-match-ranking-and-honest-confidence.md`
- ENG-814 — mobile sibling lane (same flag, same prototype).

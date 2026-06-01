# Best-match ranking + honest confidence tier for food search (ENG-807)

- **Date:** 2026-05-31
- **Area:** Nutrition engine / food search
- **Status:** Resolved
- **Owner:** nutrition-engine
- **Platforms:** web + mobile (shared logic)

## Problem

The food-search results list ranked multi-source hits with a weak token-overlap
relevance score (`searchRelevance`) plus a source trust weight. Two issues:

1. **Ranking was shallow.** It didn't stem (so "eggs" under-matched "egg"),
   didn't reward a candidate that *is* the food over one that merely *contains*
   it, and over-penalised the verbose-but-correct USDA generic rows that are the
   most trustworthy answers ("Lentils, mature seeds, cooked, boiled, without
   salt").
2. **Confidence was dishonest.** The only confidence signal was a ~14px green
   tick driven by `verified` (source flag) alone. A USDA Branded "EGGS" row
   (mislabelled packaged product, `verified: false` but high token overlap) and
   a weak-match Foundation row both looked the same as a clean canonical hit.
   The redesign (ENG-798) wants a legible Verified / Estimated chip — but a chip
   is only honest if it's backed by a real signal, per the CLAUDE.md trust
   posture ("never show a confidence label not backed by the real model").

## Decision

All ranking + confidence math lives in one shared module,
`src/lib/nutrition/foodSearchRanking.ts`, consumed identically by web
(`mergeAndDedup`) and mobile (`mergeResults`). The UI rendering (chips,
sections) is a later stage — this change exposes the data only.

### 1. Stronger relevance scorer (`searchMatchScore`)

- Stemming (eggs↔egg, tomatoes↔tomato, berries↔berry; the `-es` rule only fires
  after a sibilant so "apples" → "apple", not the broken "appl").
- Diacritic stripping (Pâté → Pate) + percentage/number stripping ("85% lean
  meat / 15% fat" no longer pollutes the score).
- Recall weighted above precision (0.72 / 0.28) because authoritative verified
  rows are verbose by design and must not lose to a terse branded dish.
- Lead-segment boost: the queried food appearing in the first two comma segments
  of a USDA "Category, specifier, …" name (e.g. "Fish, salmon, …") marks it as a
  head term, not a buried sub-ingredient.
- Dish/processing-word penalty (fried, breaded, burger, curry, bowl, …) demotes
  prepared dishes; floored so one dish word can't annihilate a full-recall row.
- Prefix boost + first-word bonus.

`searchRelevance` is retained for back-compat and now delegates to
`searchMatchScore`, so every consumer shares one scorer.

### 2. Honest confidence tier (`searchRowConfidenceTier`)

Derived from **both** provenance **and** the computed match score — never source
alone:

- `"verified"` only when the source is authoritative (verified USDA
  Foundation/SR Legacy/Survey **or** Suppr's curated generic foods/beverages)
  **and** the match score ≥ `VERIFIED_TIER_MIN_SCORE` (0.55).
- Everything else is `"estimated"` (the amber chip).
- Branded product data (USDA Branded, OFF, Edamam, FatSecret) is never
  auto-verified — a USDA Branded "EGGS" with perfect token overlap reads
  Estimated, not Verified.

Exposed on the row object as `confidenceTier` on both
`UnifiedSearchResult` (mobile) and `SearchResult` (web).

### 3. Best matches / More results split (`splitBestMatches`)

The prototype splits the ranked list into "Best matches" and "More results" by a
score threshold (`BEST_MATCH_MIN_SCORE` = 0.6) on the combined rank score —
independent of the tier (both Verified and Estimated rows appear in both
sections). Exposed via `splitFoodSearchResults(query, rows)` on each platform,
both backed by the shared `splitBestMatches`. Guarantees a non-empty Best
section whenever results exist (promotes the top row if none clear the bar).

### 4. Real low-confidence demotion (`isLowConfidenceDemotedRow`)

Extends the F-90 `isLowRelevanceNonVerifiedRow` gate to key off the **real
tier** instead of the raw `verified` flag: an estimated-tier row below
`LOW_CONFIDENCE_DEMOTE_SCORE` (0.30, the same boundary as F-90) is dropped. This
is a strict superset — it additionally catches estimated-tier rows (e.g. USDA
Branded mislabels) that the raw-flag gate let through. Verified-tier rows are
always kept.

### 5. Recently-logged tie-break (`RECENTLY_LOGGED_BOOST` = 0.05)

`foodSearchRankScore` accepts an optional `recentlyLogged` flag adding a small
boost — capped low so it breaks a near-tie but never floats an irrelevant row
above a real match. (Wiring the recent-log source into the panel is a follow-up;
the scorer hook is in place.)

## Why not import `confidenceForMatch` from `verifyIngredients.ts`?

`verifyIngredients.ts` imports server-only clients (FatSecret/USDA/serverEnv) and
can't be pulled into the mobile-safe `foodSearchRanking.ts`. The pure scoring
*machinery* (stemming, stopwords, neutral descriptors, dish-word penalty,
precision blend) is ported into the shared module instead, so the search ranker
and the ingredient verifier agree on what "a good name match" means without
coupling the mobile bundle to server code.

## Testing

- `tests/unit/foodSearchRanking.test.ts` — scorer, tier, split, recency unit tests.
- `tests/unit/foodSearchRankingGolden.test.ts` — **golden-query regression**: ~28
  real queries with deterministic candidate pools and expected top-1/top-3, so
  ranking drift fails CI. If a legitimate scorer change moves an expectation,
  update it in the same change — never silence the test.
- `tests/unit/searchRowTrust.test.ts` — `isLowConfidenceDemotedRow` gate.
- `tests/unit/foodSearchConfidenceTierParity.test.ts` — **web ↔ mobile parity**:
  both data layers consume the same shared helpers, stamp `confidenceTier`, and
  back `splitFoodSearchResults` with `splitBestMatches`; plus a runtime check
  that identical input resolves the identical tier (one implementation).

Full web (6080) + mobile (1998) unit suites green; web + mobile typecheck clean.

## Parity

Identical scoring on both platforms — all math is shared from
`foodSearchRanking.ts`. No intentional divergence. The JSX that renders the chip
and the section headers is the next stage's lane (behind the
`redesign_search_results` flag); this change only exposes the tier + section
split on the row data and applies the honest demotion gate.

## Follow-ups

- UI stage: render the Verified/Estimated chip + Best/More section headers from
  `confidenceTier` / `splitFoodSearchResults`, gated behind
  `redesign_search_results`.
- Wire a recently-logged food source into the panel so `recentlyLogged` fires.

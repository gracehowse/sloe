# Trust vocabulary — canonical five-tier implementation (ENG-1431 / ENG-1464 / ENG-1567)

- **Date:** 2026-07-06
- **Area:** Nutrition trust / cross-system consistency
- **Status:** Completed — mechanical alignment and user-facing copy retirement shipped
- **Linear:** ENG-1431, ENG-1464, ENG-1567

## Summary

The 2026-07-05 audit found Suppr had accumulated 5+ overlapping ways to represent
"how much should the user trust this nutrition number" (`TrustChipVariant`,
`IngredientVerificationTier`, `SearchRowConfidenceTier`, `is_verified`,
`user_foods.verification_status`), with real contradictions between them (e.g. a
row could read "Partial match" in one place while being rejected by the accept
floor everywhere else). A Fable-backed pass proposed a single canonical 5-tier
ladder (Matched/Partial/Estimated/Manual/No-data) that retires the word
"Verified"/"Structured" from user copy and shows the actual source name instead.

Grace approved the full proposal. The work shipped in two controlled parts: the
safe mechanical alignment first, followed by the cross-platform copy-retirement
pass once its real blast radius had been audited. The resulting display contract
is now complete; persistence identifiers and confidence calculations are
unchanged.

## Shipped this pass

1. **`IngredientVerificationTier`'s `partial` floor moved 0.50 → 0.55**
   (`src/lib/recipe-ingredients/ingredientVerificationStatus.ts`), aligning with
   `MIN_ACCEPT_CONFIDENCE` (`verifyConfidencePolicy.ts`). Before this, a row at
   confidence 0.52 read "Partial match" in the ingredient-detail view while the
   accept-floor pipeline simultaneously rejected it elsewhere — a real,
   user-visible contradiction on the same data.
2. **"Estimated" recolored red → amber** on web
   (`src/app/components/RecipeDetail.tsx`'s `ING_TIER_COLOR`). Red is reserved
   for errors/destructive actions per the 2026-07-01 calorie-ring red retirement
   (ENG-1296) — a low-confidence estimate isn't an error. This also fixes a
   real web/mobile parity gap: mobile's ingredient-tier color mapping
   (`apps/mobile/app/recipe/[id].tsx`) already used amber (`Accent.warningSolid`)
   for both `partial` and `estimated`; only web had drifted to red.
3. **`VERIFIED_TIER_MIN_SCORE` renamed to `SEARCH_MATCH_MIN_SCORE`**
   (`src/lib/nutrition/foodSearchRanking.ts`). Both constants happened to equal
   0.55, which read as a shared floor — they measure unrelated things (text
   search relevance vs. nutrition-match confidence). Comment references in
   `foodHistorySearch.ts` and `favoriteFoodsSearch.ts` updated to match.

All three are mechanical, low-blast-radius, and directly fix confirmed
contradictions. Full test coverage updated and green (see Verification).

## Copy-retirement / five-tier ladder — completed by ENG-1464 and ENG-1567

Fable's proposal to retire "Verified"/"Structured"/"Unverified" from user copy
and show the source name as the strongest trust signal touched more surface than
the initial scoping assumed. ENG-1464 delivered the shared TrustChip/SourceDot
slice; ENG-1567 completed the remaining display surfaces:

- nutrition-source badges on web and iOS;
- food-search confidence chips on web and iOS;
- barcode result confidence on web and iOS;
- recipe ingredient trust labels on web and iOS;
- the web Discover filter (mobile has no equivalent filter control); and
- RecipeUpload's success, tooltip and macro-summary copy.

The canonical visible ladder is **source name (or Matched) / Partial /
Estimated / Manual / No data**. Discover uses **Source-backed only** because it
describes the filter without implying certification. `structuredSourceGate.ts`
was audited and left unchanged: it matches real stored source identifiers, not
display labels. The existing default-on `trust_source_name_v1` flag gates every
meaning-changing copy path and retains the old wording as an emergency kill
switch.

Still deferred (unchanged from the original Fable recommendation's own
scoping): the `user_foods.verification_status` → `moderation_status` column
rename. That column is referenced by the ENG-1393 security lockdown trigger
shipped earlier this session — renaming it needs its own careful pass, not a
bundle with unrelated copy work.

## Verification

- `tests/unit/nutritionTrustVocabulary.test.ts` pins the canonical five-tier
  formatter, cross-platform adoption, provenance naming and Discover wording.
- Web and mobile search-result tests pin source names on the default-on path;
  the mobile confidence-chip test separately pins the legacy flag-off wording.
- Web barcode coverage pins Open Food Facts on a source-backed result rather
  than the retired generic Structured label.
- The targeted web and mobile lint/typecheck/test suites, decision index and
  final repository CI are required before ENG-1567 closes.

### Earlier mechanical pass

- `tests/unit/ingredientVerificationStatus.test.ts` — updated pinned boundary
  tests for the 0.55 floor, added a regression test for the killed 0.50–0.549
  contradiction band. Green.
- `tests/unit/foodSearchRanking.test.ts`, `tests/unit/foodSearchConfidenceTierParity.test.ts`
  — updated for the rename. Green.
- Confirmed live confidence distribution on `recipe_ingredients` before
  finalizing (15 rows total in prod today — thin, but the 0.55–0.75 band isn't
  empty (3/15) or dominant, so the `partial` tier is neither dead weight nor
  banner-blindness risk at current scale).

## Cross-platform parity

The threshold change lives in a shared lib (`ingredientVerificationStatus.ts`)
consumed by both web `RecipeDetail.tsx` and mobile `apps/mobile/app/recipe/[id].tsx`
— both platforms get the 0.55 floor automatically. The color fix was web-only
because mobile was already correct (see above) — this closes a drift, not
opens one.

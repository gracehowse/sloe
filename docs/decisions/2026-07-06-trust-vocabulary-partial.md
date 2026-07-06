# Trust vocabulary — partial implementation (ENG-1431)

- **Date:** 2026-07-06
- **Area:** Nutrition trust / cross-system consistency
- **Status:** Partially shipped — mechanical fixes landed, full unification deferred
- **Linear:** ENG-1431

## Summary

The 2026-07-05 audit found Suppr had accumulated 5+ overlapping ways to represent
"how much should the user trust this nutrition number" (`TrustChipVariant`,
`IngredientVerificationTier`, `SearchRowConfidenceTier`, `is_verified`,
`user_foods.verification_status`), with real contradictions between them (e.g. a
row could read "Partial match" in one place while being rejected by the accept
floor everywhere else). A Fable-backed pass proposed a single canonical 5-tier
ladder (Matched/Partial/Estimated/Manual/No-data) that retires the word
"Verified"/"Structured" from user copy and shows the actual source name instead.

Grace approved the full proposal. This pass shipped the safe, mechanical half of
it and deferred the copy-retirement half after its real blast radius turned out
to be materially larger than scoped — documenting the split explicitly rather
than silently doing a partial job.

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

## Deferred — the copy-retirement / 5-tier-ladder unification

Fable's proposal to retire "Verified"/"Structured"/"Unverified" from all user
copy and show the source name as the trust signal touches far more surface than
the initial scoping assumed:

- `src/app/components/ui/trust-chip.tsx` and its mobile twin
  `apps/mobile/components/ui/TrustChip.tsx` (the actual copy).
- `src/app/components/ui/source-dot.tsx` / `apps/mobile/components/ui/SourceDot.tsx`.
- `src/lib/nutrition/structuredSourceGate.ts` — needs to be read carefully to
  confirm it doesn't do any literal string-matching against label text
  (as opposed to matching source *identifiers*) before any label text changes.
- `apps/mobile/app/(tabs)/discover.tsx`.
- At least 6 test files pin the exact string "USDA verified" across both
  platforms (`trustPostureSweepPhase3.test.tsx`, `trustPostureSweepPhase4.test.tsx`,
  `supprPrimitives.test.tsx` on both platforms, `searchResultConfidenceChip.test.tsx`).

This is a real, separate refactor — not a copy tweak — and deserves its own
dedicated pass with full regression coverage rather than being rushed alongside
the ENG-1415/1417 persistence fix (the higher-priority sev-5 launch blocker)
in the same session. Filed as ENG-1464, not silently dropped.

Also deferred (unchanged from the original Fable recommendation's own
scoping): the `user_foods.verification_status` → `moderation_status` column
rename. That column is referenced by the ENG-1393 security lockdown trigger
shipped earlier this session — renaming it needs its own careful pass, not a
bundle with unrelated copy work.

## Verification

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

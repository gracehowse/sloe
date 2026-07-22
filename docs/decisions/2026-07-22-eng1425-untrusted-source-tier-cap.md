# Cap untrusted-source ingredient rows at "partial" tier (ENG-1425)

- **Date:** 2026-07-22
- **Area:** Nutrition trust / recipe ingredient verification
- **Status:** Shipped
- **Linear:** ENG-1425

## Problem

`deriveIngredientVerificationTier` (`src/lib/recipe-ingredients/ingredientVerificationStatus.ts`)
had a confidence-only fallback bucket that granted the top "verified" tier
(green dot, no Verify CTA) to any row with `confidence >= 0.75` — even when
the row was neither manually verified (`is_verified !== true`) nor from an
allow-listed trusted source (USDA / FatSecret / OFF / Edamam / manual /
user / custom / barcode). An AI-parse row with an unspecified or untrusted
`source` at, say, 0.92 confidence rendered identically to a human-verified
USDA row — the strongest "nothing to check here" signal in the ingredient
grid, on a bare score.

Flagged by the 2026-07-05 deep audit
(`docs/audits/2026-07-05-deep-audits/audit3-nutrition-trust/findings.json`,
finding `conf-2`, confirmed at both the mechanical and customer-lens review
passes): the 0.70–0.75 band was never validated as a "no further
verification needed" bar — the 2026-05-26 impact review only ratified it as
display copy — so granting the no-CTA tier on that score alone from an
unspecified source is an overclaim. The audit explicitly declined to guess
a fix and routed the call to Grace as a product-policy decision
(`needs/decision` label).

## Decision

Grace's call (per the ticket, a settled product-policy decision, not an
open question): **the untrusted-source confidence fallback is capped at
"partial"** — it can no longer reach "verified". The no-CTA "verified" tier
is now reserved for exactly two signals:

1. `is_verified === true` (the user, or an equivalent trusted write path,
   explicitly confirmed the row), or
2. `source` is an allow-listed trusted database source.

A bare confidence score from an unspecified/untrusted source now tops out
at "partial" (amber dot, Verify CTA visible) — matching the same visual
treatment a 0.55–0.74 row already got, just extended to also cover the
0.75+ band for untrusted sources.

### Alternatives considered

- **Require an allow-listed source in addition to the 0.75 bucket** (the
  audit's own engine-side recommendation, option (a)) — functionally this
  is what shipped: once the fallback can't independently reach "verified,"
  the only paths left to "verified" are exactly the two conditions above.
- **Document the 0.75 bar with an impact-review citation instead of
  changing behaviour** (option (b)) — rejected. No such citation exists;
  inventing a post-hoc justification for an unvalidated threshold would be
  worse than fixing it, and the ticket explicitly frames this as a real
  gap, not a documentation debt.
- **Leave the threshold alone and rely on the Verify flow's other
  surfacing mechanisms** (accept-floor exclusion, recipe-level
  `ingredientVerifyNeedsReview` nudge) — rejected. Those operate on
  different signals (aggregate/recipe-level, not per-row tier) and don't
  put a Verify CTA on the specific row a user is looking at; the whole
  point of the finding is that the _row-level_ CTA was suppressed.

## Implementation

`deriveIngredientVerificationTier`'s confidence-only fallback branch
(reached only after `is_verified === true` and `sourceIsTrusted(source)`
both fail) no longer has a distinct `>= 0.75 → "verified"` bucket — that
case now falls into the same `>= 0.55 → "partial"` bucket. `is_verified`
and trusted-source classification (the two branches above the fallback)
are untouched.

```ts
if (input.isVerified === true) return "verified";
if (sourceIsTrusted(input.source)) return "verified";
// fallback — can now only reach "partial" / "estimated" / "unverified"
if (c == null) return "unverified";
if (c >= 0.55) return "partial";
if (c > 0) return "estimated";
return "unverified";
```

No feature flag: this is a confidence-threshold/classification correctness
fix (the same category as the 2026-07-06 trust-vocabulary partial-floor
move, ENG-1431, which also shipped unflagged in this same file) — not a
layout, navigation, colour-mapping, or copy-meaning change per the
feature-flag rule's own carve-out for "bug fixes with no visual surface."
The visual surface here (amber dot + CTA vs. green dot) already exists on
every "partial" row; this change only corrects which rows land in that
existing state.

## Tests

`tests/unit/ingredientVerificationStatus.test.ts`:

- Untrusted-source row at 0.75, 0.92, and 0.99 confidence now returns
  `"partial"` with `ingredientShouldShowVerifyCta` true (was `"verified"`
  pre-fix at 0.92 and the newly-added 0.75/0.99 cases).
- Trusted-source rows (USDA/FatSecret/OFF/Edamam/manual, including at
  high confidence 0.95) are pinned unchanged: `"verified"`, no CTA.
- `is_verified === true` rows are pinned unchanged regardless of
  confidence or source: `"verified"`, no CTA.
- Updated the pre-existing 0.55/0.75 boundary test — 0.75 is no longer a
  distinct boundary in the untrusted-fallback path (both 0.55 and 0.75
  bucket to `"partial"` now).

All green; no other test file in the repo hardcoded an untrusted-source
row at confidence >= 0.75 expecting `"verified"` (`recipeVerifyModal.test.tsx`
computes tiers dynamically via the same shared helper, so it tracks the
fix automatically).

## Cross-platform parity

Single shared lib (`src/lib/recipe-ingredients/ingredientVerificationStatus.ts`,
resolved on mobile via the `@suppr/shared/*` → `src/lib/*` tsconfig path
mapping) consumed by both web `RecipeDetail.tsx` and mobile
`apps/mobile/app/recipe/[id].tsx` — both platforms get the cap
automatically from the one file change.

## Refs

- `src/lib/recipe-ingredients/ingredientVerificationStatus.ts`
- `tests/unit/ingredientVerificationStatus.test.ts`
- `docs/audits/2026-07-05-deep-audits/audit3-nutrition-trust/findings.json` (conf-2)
- `docs/decisions/2026-05-02-recipe-ingredient-verify-and-amount-fixes.md` (introduced the shared helper)
- `docs/decisions/2026-07-06-trust-vocabulary-partial.md` (prior threshold change in the same file, ENG-1431)

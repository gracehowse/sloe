# Shopping list display quality — V7 + V8 from 2026-05-11 visual sweep

## Source

`docs/audits/2026-05-11-visual-sweep/mobile/06-shopping.png` surfaced two real data-quality issues that aren't simple surface fixes.

## V7 — Same ingredient duplicated across prep states

Observed in the Crispy Sticky Lemon Chicken row group:

```
○ cornflour (2 tbsp)
○ 1/2 tsp cornflour mixed with warm water (0.5 tsp)
```

Both lines are cornflour for the same recipe. The second isn't a separate shopping item — it's a mid-prep state ("make a slurry") that the recipe-import parser mis-extracted as an ingredient.

Similar pattern:

```
○ cooked rice to serve (optional) (1)
○ Rice, to serve (2)
```

## V8 — Aggregated quantity display is unintuitive

```
○ 175 g Instant Oats (525 g)
```

Reads as "175 g of Instant Oats, in a 525 g package" but actually means "3 recipes use 175 g each = 525 g total". The dual-quantity parenthetical creates more confusion than clarity.

## Right fix (deferred)

### V7 — Ingredient parser improvement + display dedup

1. **Recipe-import pipeline**: when extracting ingredients from caption / URL / image, skip lines that match cooking-instruction patterns:
   - `/\bmixed with\b/i`
   - `/\bto serve\b/i` (when preceded by another ingredient quantity)
   - `/\b(combined|stirred|whisked) with\b/i`
2. **Backfill**: re-run extraction on affected recipes to clear existing bad ingredient rows. Migration shape:
   ```sql
   delete from recipe_ingredients
   where recipe_id in (...)
     and (
       name ilike '%mixed with%'
       or name ilike '%to serve (optional)%'
     );
   ```
3. **Shopping list display dedup** (`src/lib/planning/shoppingDisplayGroups.ts`): when two items in the same recipe group share an ingredient stem (cornflour ≈ cornflour, rice ≈ rice), collapse to one row with the larger quantity. Needs a small stemmer (lowercase + strip leading qty + strip common cooking-state suffixes).

### V8 — Aggregate-quantity display redesign

Replace `175 g Instant Oats (525 g)` with one of:

| Option | Display | Pros | Cons |
|---|---|---|---|
| A. Total only | `525 g Instant Oats` | Simple, what user needs to buy | Loses per-recipe info |
| B. Total + subtitle | `525 g Instant Oats` + `3× recipes, ~175 g each` | Both signals visible | Two lines per item |
| C. Total + tooltip | `525 g Instant Oats` + ⓘ → tap reveals recipes | Clean default, detail on demand | Hidden info |

**Recommendation**: Option B for the visible shopping list (the per-recipe info already shows below as the recipe-title subtitle on existing items). Drop the parenthetical total entirely on existing single-quantity items.

## Why this is deferred, not in the current PR

- The parser change is downstream of F-138 Phase 5 (vision auto-verify matcher contract is in flux). Touching the extractor now risks breaking the cross-contract.
- The backfill is non-trivial (must dedupe across ALL existing recipes, not just affected ones, to be safe).
- The display redesign deserves a UI prototype review by `ui-product-designer` before shipping.

## Owner / next step

- Owner: Grace + Claude
- When: after F-138 Phase 5 lands
- Tracker: this file
- Related: `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`

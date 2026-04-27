# Decision log: FatSecret tier upgrade for full micronutrient panel

**Date:** 2026-04-26
**Status:** Resolved (Grace will action billing; engineering work is no-op until tier flips)
**Trigger:** Tester feedback in the 2026-04-26 visual-QA round: "the micronutrients list is very short — all other providers (MFP, Lose It etc) show all nutrients."

---

## Decision

Upgrade the FatSecret API tier from the free tier (7 nutrients per food: calories, protein, carbs, fat, fibre, sugar, sodium) to a paid tier that returns the full nutrient panel (saturated fat, polyunsaturated fat, monounsaturated fat, trans fat, cholesterol, potassium, iron, calcium, vitamin A, vitamin C, vitamin D, etc.).

Grace owns the billing decision and will action the upgrade directly with FatSecret. Once the tier flips, the existing nutrient pipeline absorbs the wider response without code changes — Suppr's storage and renderer already accept 32 nutrients (the OFF barcode-import path populates them today; the FatSecret search path will start matching).

## Rationale

Two paths considered:

**Path A (rejected): Build an OFF-backed ingredient-search shadow path.**

OFF (Open Food Facts) returns a much richer nutrient panel than free-tier FatSecret. Building an OFF-search path that resolves text queries (not just barcodes) would close the breadth gap without changing the FatSecret contract. But this is multi-sprint engineering: OFF doesn't ship a hosted search endpoint as well-integrated as FatSecret's, the data is community-curated (variable confidence, more rejection logic needed), and we'd be running two text-search paths in parallel with reconciliation logic for conflicts.

**Path B (chosen): Upgrade FatSecret tier.**

Single vendor relationship, no engineering churn until the tier flips, and the storage/renderer already handle the wider panel. The cost is a recurring spend; the benefit is parity-with-MFP nutrient breadth that solves the user complaint directly.

## Engineering implications (none until upgrade lands)

- `src/lib/nutrition/normalizeServingToMacros.ts` already extracts every nutrient FatSecret returns; if the response gains additional fields, the normalizer absorbs them without change.
- `recipes` and `recipe_ingredients` tables already carry columns for the wider panel (saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat, cholesterol_mg, potassium_mg, iron_mg, calcium_mg, vitamin_a_mcg, vitamin_c_mg, vitamin_d_mcg).
- Recipe Detail micronutrient render already iterates an array — adding nutrient rows is data-driven; the UI absorbs new entries automatically.
- No migration needed. No type-shape changes needed.

What WILL need a follow-up after the tier flips:
- Re-verify a sample of existing recipes so the wider panel is populated for already-imported rows. A backfill script that walks recipes with a non-null `fatsecret_food_id` and re-fetches food details should land the data without re-doing the user-facing verify flow.
- Update the licence page (`app/licences/page.tsx`) if the upgraded ToS changes attribution requirements (probably no change — the existing FatSecret licence wording covers all tiers).
- Smoke-test that any rate-limit characteristics on the upgraded tier match expectations.

## Cross-platform check

This is a vendor-tier change; web and mobile read the same nutrients through the same shared helpers (`src/lib/nutrition/normalizeServingToMacros.ts`). No platform divergence introduced.

## Status of the visual-QA fix that flagged this

The 2026-04-26 polish round did NOT land a fix for "short micronutrient list" — it documented this as the deferred item, with the FatSecret upgrade as the resolution path. See sibling decision `2026-04-26-visual-qa-polish-round.md` §9.

## Outcome

Pending: Grace upgrades the FatSecret tier on her side. Engineering work scheduled for follow-up: (a) backfill script for already-imported recipes; (b) licence-page wording check; (c) smoke-test of rate-limit characteristics. None of those are launch-blocking.

---

## 2026-04-26 update — Premier Free application submitted

Grace applied for the **Premier Free** tier (FatSecret's startups/non-profits/students offer). FatSecret confirmed receipt with this reply:

> We offer a 'Premier Free' tier for startups/non-profits/students, which provides access to our US dataset as well as all other premium features (e.g. barcode scanning, auto-complete, food categories) while attribution is required. We also offer a paid 'Premier' which gives paid users fully white-labelled access to data sets outside the US.

### Tier comparison

| Tier | Dataset | Premium features | Attribution | Cost |
|---|---|---|---|---|
| **Basic (current)** | US | No barcode / no auto-complete / 7 nutrients | Required on `/licences` (already in place) | Free, but ToS forbids macro caching |
| **Premier Free** (applied) | **US only** | Barcode scan, auto-complete, food categories, full nutrient panel | Required + visible | Free for qualifying applicants |
| **Premier** (paid) | Worldwide incl. UK / EU / AU | Full feature set | White-labelled (no attribution required) | Paid |

### Implications for Suppr

**Good for the original goal (full nutrient panel):** Premier Free unlocks the wider nutrient set — saturated fat, polyunsaturated fat, cholesterol, potassium, iron, calcium, vitamins A/C/D, etc. The storage + renderer already accept 32 nutrients (the OFF barcode-import path populates them today); the FatSecret search path will start matching the same shape.

**New geo-mismatch risk for a UK-first product:** Premier Free is **US dataset only**. A UK user searching for `Greggs sausage roll`, `Tesco Finest pasta sauce`, `M&S Count On Us yogurt` will not find UK-specific brand items. Mitigations:
- The OFF (Open Food Facts) ingredient-search fallback path (originally rejected in favour of FatSecret upgrade) becomes relevant again — OFF carries good UK / EU brand coverage.
- Eventually upgrade to paid Premier when revenue justifies (white-labelled + worldwide datasets).
- Until then, gate "expected in dataset?" UX hint based on user locale: UK users see "Try a barcode scan if your brand isn't in the database" CTA.

### Engineering prep (no-op until credentials land)

- **Env vars:** when FatSecret approves, Grace gets a new client_id + secret. The existing env vars (`FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, `FATSECRET_TIER`) are already wired through `src/lib/nutrition/fatSecretConfig.ts`. Plan: add an optional `FATSECRET_TIER=premier` flag so the search path can opt into premium endpoints (auto-complete, food categories) when the tier indicates support.
- **Attribution:** `app/licences/page.tsx` already carries the FatSecret attribution block (verified during the 2026-04-25 P1-18 sweep). Premier Free doesn't change the attribution requirement — same wording works.
- **Backfill:** when the tier flips, run a script that walks `recipes` rows with non-null `fatsecret_food_id` and re-fetches food details to populate the wider nutrient panel for already-imported recipes. Tracked separately; not launch-blocking.
- **Locale hint:** update `app/discover` empty-state copy to include "Brand not found? Try a barcode scan" for UK users until paid Premier lands.

### Status

- [x] Premier Free applied (Grace, 2026-04-26)
- [ ] Approval received — awaiting FatSecret response
- [ ] Credentials swapped into prod env (Grace, 5-min ops task once approved)
- [ ] Backfill script for already-imported recipes (engineering, post-approval)
- [ ] Locale-aware empty-state copy (engineering, post-approval)
- [ ] Decision: paid Premier upgrade timing (Grace, post-launch revenue review)

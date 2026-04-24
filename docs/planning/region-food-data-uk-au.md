# Regional food & nutrition data (UK, Australia, …)

**Status:** Discovery / architecture note — not a committed roadmap.  
**Audience:** Product, nutrition-engine, data-integrity.

## What “expand the database” can mean

| Layer | What it is today | UK / AU expansion levers |
|-------|------------------|---------------------------|
| **Postgres (`foods`, `food_sources`, `user_foods`, …)** | Canonical foods are **global**; `food_sources` records **which external ID** backs a row (`USDA`, `OpenFoodFacts`, `FatSecret`, …). No `region` or `market` column on `profiles` or `foods`. | Optional: store **region-specific provenance** (same logical food, multiple sources) or **market-specific** user preference without duplicating every row. |
| **Verify pipeline** (`verifyIngredients`) | Order: Suppr DB → **USDA** → Edamam → **OFF** (world search) → FatSecret → estimation. `searchOffProducts` is called **without** `countryTag`. | **Low lift:** pass a user- or locale-derived `countryTag` into `searchOffProducts` so UK/AU shelves rank higher for branded / local names. **Medium lift:** change **provider priority** by market (e.g. AU: try OFF earlier or prefer FatSecret where labels match). |
| **Open Food Facts** | `src/lib/openFoodFacts/searchProducts.ts` already supports `opts.countryTag` (maps to OFF `countries` tag filter) and documents `uk.openfoodfacts.org` as a possible mirror. | Wire `countryTag` values such as `united-kingdom`, `australia` (confirm against OFF search behaviour in staging). Optionally hit **region mirrors** for latency or catalogue skew. |
| **USDA FDC** | Strong for **generic whole foods**; weak for UK-specific brands and AU label conventions. | Keep as **global fallback** for generic ingredients; do not assume it replaces local databases for compliance copy. |
| **Recipes & community content** | Mostly language-agnostic; ingredient **strings** are often US-English. | Product/content: UK spellings (“courgette”), AU metrics on cards, and **curated** regional recipe sets are separate from the **nutrition DB** expansion. |

## Recommended phases (engineering + product)

### Phase A — Preference + OFF bias (no new licensed datasets)

1. **Product:** Define how the user picks **nutrition market** (onboarding or Settings): e.g. `UK`, `AU`, `US`, `EU-generic`, `Global`.  
2. **Schema (minimal):** `profiles.preferred_nutrition_market` (text enum or ISO-like codes) — nullable default meaning “infer from timezone/locale” if you want zero onboarding friction later.  
3. **App:** Map market → OFF `countryTag` (and optionally base URL `world` vs `uk`). Thread through `verifyIngredients({ …, nutritionMarket })` and `searchOffProducts(query, { countryTag })`.  
4. **QA:** Golden tests for OFF branch with `countryTag` set; regression on US users (tag omitted or `united-states` if OFF supports it).

**Outcome:** Better **branded** matches and local product names for UK/AU without ingesting new government tables.

### Phase B — Barcode and label reality

- **UK / AU barcodes** already live in OFF; ensure **mobile/web barcode flows** use the same search path and consider **country-biased** resolution when multiple OFF hits exist.  
- **Sodium / salt:** UK labels often show **salt**; pipeline already normalises sodium where data provides it — validate edge cases when expanding marketing copy, not necessarily schema.

### Phase C — Additional authoritative composition sources (large)

Examples: **FSANZ** (Australia), **McCance & Widdowson / CoFID** (UK) — typically **licence-bound**, **versioned**, and heavy to import.

1. Legal / data team: terms of use, redistribution, attribution.  
2. Data model: extend `food_sources.source` check (or parallel table) for new enums; ingestion jobs; version pins.  
3. Nutrition-engine: match keys, portion rules, and **confidence** relative to USDA/OFF.

**Outcome:** Scientifically defensible “per 100g” rows for **generic** AU/UK foods; highest cost and maintenance.

## Risks and decisions

- **Single vs multi-region foods:** Prefer **one canonical food** + multiple `food_sources` rows over duplicating `foods` per country unless product requires hard splits.  
- **Pipeline order:** Reordering USDA vs OFF by market affects **all users** of that market — needs A/B or metrics (match rate, user overrides).  
- **Recipes:** Regional “database” for **meal ideas** is a **content** problem; this doc focuses on **nutrition verification** and **catalog** provenance.

## Code pointers (today)

- OFF search + optional country filter: `src/lib/openFoodFacts/searchProducts.ts`  
- Verify order and OFF call site: `src/lib/nutrition/verifyIngredients.ts` (search without `countryTag`)  
- Unified food schema: `supabase/migrations/20260408170000_food_db_unification.sql`, `docs/data/schema.md`  
- Locale / units thinking: `.claude/agents/nutrition-engine.md` (egg sizes, cups)

## Next step

Product chooses **Phase A** (preference + OFF bias) vs **Phase C** (licensed national tables). Engineering can spike Phase A behind a feature flag with no migration risk beyond a nullable `profiles` column once the enum list is frozen.

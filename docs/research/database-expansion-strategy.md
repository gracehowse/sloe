# Nutrition Database Expansion Strategy

> **Date:** 2026-04-16
> **Context:** 28% of negative reviews across the calorie-tracking category cite database inaccuracy as the top complaint. Suppr currently uses USDA FoodData Central, Open Food Facts, and FatSecret. Coverage gaps exist for everyday branded products, restaurant meals, and regional foods.

---

## 1. Current Suppr Architecture

### Verification pipeline (`src/lib/nutrition/verifyIngredients.ts`)

Suppr's ingredient verification follows a waterfall:

1. **USDA FoodData Central** (primary) -- Foundation/SR Legacy/Survey first, then Branded
2. **Open Food Facts** (barcode + text search)
3. **FatSecret** (fallback API search)
4. **Local estimation** (hardcoded STAPLES table, ~100 foods in `estimateIngredientMacros.ts`)

Each match is scored with `confidenceForMatch()` (stemmed token overlap + penalty for extra/dish words). Minimum thresholds: 0.42 (USDA/FatSecret), 0.52 (OFF). All matches are Atwater-validated before acceptance.

### Current env keys

| Source | Env var | Status |
|--------|---------|--------|
| USDA FDC | `USDA_FDC_API_KEY` | Required |
| FatSecret | `FATSECRET_CONSUMER_KEY` / `FATSECRET_CONSUMER_SECRET` | Optional |
| Open Food Facts | (no key needed) | Always available |

### Pricing tiers (live)

| Tier | Price | Nutrition sources |
|------|-------|-------------------|
| Free | $0 | USDA food search |
| Base | $5/mo | USDA + barcode (OFF) + recipe import |
| Pro | $12/mo | All sources + AI photo & voice |

---

## 2. Database-by-Database Analysis

### 2a. USDA FoodData Central (current -- primary)

| Attribute | Detail |
|-----------|--------|
| **Coverage** | ~380,000 foods (Foundation, SR Legacy, Survey/FNDDS, Branded) |
| **Types** | Generic whole foods (excellent), branded (moderate, FDA label data), restaurant (poor) |
| **Accuracy** | Lab-analysed; federal standard. Gold-standard for generic ingredients |
| **Pricing** | Free. Requires API key (free signup) |
| **Rate limits** | 1,000 requests/hour/IP |
| **Data quality** | Verified by USDA; not crowd-sourced |
| **Gaps** | Weak on branded grocery, no restaurant menus, US-centric |

**Suppr status:** Primary source. Working well for recipe ingredients. Poor for branded/restaurant.

---

### 2b. Open Food Facts (current -- barcode + search)

| Attribute | Detail |
|-----------|--------|
| **Coverage** | 2.8--4 million products across 150+ countries |
| **Types** | Packaged/branded grocery (good), no restaurant, no generic cooking ingredients |
| **Accuracy** | Variable -- crowd-sourced with some automated checks |
| **Pricing** | Free, open-source (ODBL license) |
| **Rate limits** | ~100 req/min recommended (be a good citizen) |
| **Data quality** | Crowd-sourced. Quality varies significantly by product. ~30% of entries have incomplete nutrition |
| **Gaps** | Many entries missing key nutrients (fiber, sodium). No restaurant. Quality inconsistent |

**Suppr status:** Used for barcode scanning (Base+) and text search fallback. Confidence threshold set higher (0.52) due to noisy data.

---

### 2c. FatSecret Platform API (current -- fallback)

| Attribute | Detail |
|-----------|--------|
| **Coverage** | Large global database; exact size not publicly stated but substantial (branded + generic) |
| **Types** | Generic foods, branded grocery, some restaurant chains |
| **Accuracy** | Mix of verified + community-contributed |
| **Pricing** | **Premier Free:** US dataset, all API features, attribution required. Good for startups. **Premier Paid:** Access to non-US markets, white-label (no attribution). Pricing is per-market + per-volume; requires sales contact. Startups/non-profits may get 50% discount |
| **Rate limits** | Not publicly documented; varies by tier |
| **Data quality** | Better than OFF for structured data; serving size normalization needed (Suppr already handles this in `fatsecretNormalize.ts`) |
| **Gaps** | Restaurant coverage limited. Regional/local brands sparse outside US |

**Suppr status:** Optional fallback (env vars not required). Likely on Premier Free tier. Should confirm attribution compliance.

---

### 2d. Nutritionix

| Attribute | Detail |
|-----------|--------|
| **Coverage** | **1.9M+ unique foods:** 991K+ grocery items, 202K+ restaurant menu items, 600+ restaurant chains monitored |
| **Types** | Branded grocery (92% US/Canada coverage), restaurant menus (best in class), generic foods |
| **Accuracy** | Full-time registered dietitians verify data. 3,000+ grocery items added/updated monthly |
| **Pricing** | **No public free tier** (discontinued due to misuse). Starter: ~$299/mo. Enterprise: ~$1,850/mo. Trial available via sales contact |
| **Rate limits** | Not publicly documented; likely per-plan |
| **Data quality** | Highest for restaurant + branded. Dietitian-verified. NLP endpoint ("natural language" queries like "1 large egg and 2 slices of toast") |
| **Gaps** | Expensive. US/Canada focused. No free tier for bootstrapped startups |

**Assessment for Suppr:** Best-in-class restaurant coverage. The NLP endpoint would dramatically improve Suppr's free-text logging. However, $299/mo minimum is significant. Best reserved for Pro tier or as a future growth investment.

---

### 2e. Edamam

| Attribute | Detail |
|-----------|--------|
| **Coverage** | ~900K foods (325K+ packaged with UPC, 200K restaurant items, 75K common meals), 680K+ UPC codes, 2.3M recipes |
| **Types** | Branded, restaurant, generic, recipes |
| **Accuracy** | Calculated nutrition from ingredients; NLP-based parsing |
| **Pricing** | **Food Database API:** Free (1,000 req/day, 50 req/min) up to $799/mo. **Nutrition Analysis API:** Free tier, then $49/mo, custom enterprise. **Pro pay-as-you-go:** ~$0.00003/request. **Vision API** (photo recognition): Bundled with Food DB API |
| **Rate limits** | Free: 1,000 req/day, 50 req/min. Paid: scales with plan |
| **Data quality** | Mix of verified + calculated. Good for recipe analysis. 28 nutrients tracked |
| **Gaps** | Restaurant data less comprehensive than Nutritionix. Calculated values less reliable than lab-analysed |

**Assessment for Suppr:** Strong value proposition. Free tier (1,000 req/day) could supplement USDA for branded lookups at zero cost. Pay-as-you-go at $0.00003/req means 100K daily lookups = $3/day. Vision API is a potential replacement for Suppr's current OpenAI-based photo recognition.

---

### 2f. CalorieKing

| Attribute | Detail |
|-----------|--------|
| **Coverage** | Comprehensive US + Australia databases. Exact size not publicly stated |
| **Types** | Branded grocery, restaurant chains, generic foods |
| **Accuracy** | High -- used by health professionals. Dietitian-maintained |
| **Pricing** | **API access:** Contact sales. **Data licensing:** CSV/XML/SQL export available. Pricing not public. Historically premium (thousands/year) |
| **Rate limits** | N/A (license-based) |
| **Data quality** | Professional-grade. Trusted by clinical settings |
| **Gaps** | No public pricing. Likely expensive. US + AU only. API is basic compared to Nutritionix/Edamam |

**Assessment for Suppr:** High quality but likely cost-prohibitive for a startup. Better suited for enterprise health platforms. Not recommended at this stage.

---

### 2g. NCCDB (Nutrition Coordinating Center Database)

| Attribute | Detail |
|-----------|--------|
| **Coverage** | 17,000+ foods, 70+ nutrients per food. Used by Cronometer |
| **Types** | Generic/whole foods only (no branded, no restaurant) |
| **Accuracy** | Lab-analysed, research-grade. Gold standard for micronutrients |
| **Pricing** | NDSR software license: $6,600 initial + $4,400/year. Database-only licensing: contact NCC (likely similar range) |
| **Rate limits** | N/A (licensed dataset, not API) |
| **Data quality** | Highest quality for micronutrient depth (70+ nutrients vs USDA's ~40) |
| **Gaps** | Small database (17K foods). No branded/restaurant. Very expensive. Overkill unless Suppr targets clinical nutrition |

**Assessment for Suppr:** Not cost-effective for Suppr's use case. The micronutrient depth is impressive but irrelevant when the gap is branded/restaurant coverage. USDA Foundation data covers the same whole-food space adequately.

---

### 2h. Other Notable Sources

| Source | Coverage | Cost | Notes |
|--------|----------|------|-------|
| **Spike Nutrition API** | Aggregates USDA + OFF + others into unified endpoint | Not publicly stated | New entrant (2025). AI-powered image analysis included. Worth evaluating |
| **GreenChoice** | 1M+ US food/beverage UPCs | Enterprise pricing | Weekly updates. Product attributes beyond nutrition (sustainability, additives) |
| **MyNetDiary** | Licensed database | Enterprise only | Powers MyNetDiary app. Not available as standalone API |
| **Syndigo (formerly Nutritionix B2B)** | Brand-submitted data | Enterprise | Direct brand partnerships for verified product data |

---

## 3. Expansion Strategies (Low-to-Zero Cost)

### 3a. Edamam Free Tier as Fourth Source (Recommended -- immediate)

Add Edamam's Food Database API as a fourth source in the verification waterfall, between OFF and FatSecret:

```
USDA -> Open Food Facts -> Edamam (free) -> FatSecret -> Local estimation
```

- **Cost:** $0 (1,000 req/day free)
- **Benefit:** 900K foods including 200K restaurant items and 325K branded products
- **Implementation:** Add `EDAMAM_APP_ID` and `EDAMAM_APP_KEY` env vars; create `src/lib/edamam/client.ts`
- **Risk:** Low. Same confidence-scoring approach as existing sources

### 3b. User Corrections Feedback Loop (Recommended -- medium term)

Build a verified community database:

1. When users scan a barcode and OFF data is incomplete/wrong, let them submit corrections
2. Store corrections in a `user_food_corrections` Supabase table
3. Require photo of nutrition label for verification
4. After N confirmations (e.g., 3 users agree), promote to "community verified"
5. Community-verified entries get priority over raw OFF data

**Cost:** Development time only. No API costs.
**Benefit:** Steadily improves coverage for the exact products Suppr users eat.
**Model:** This is how Cronometer maintains quality -- users submit label photos for review.

### 3c. AI-Powered Nutrition Estimation with Confidence Scoring (Recommended -- medium term)

Suppr already has AI photo logging (Pro tier, uses OpenAI). Extend this:

1. For unmatched foods, use GPT-4o/Claude to estimate macros from the food name + context
2. Assign confidence tiers: High (>0.8), Medium (0.5-0.8), Low (<0.5)
3. Always flag AI estimates in the UI with source badge (already implemented: `NutritionSourceBadge.tsx`)
4. Cross-validate AI estimates against Atwater factors (already in `scaledMacrosPlausible()`)

Research supports this approach:
- LLMs achieve r=0.58-0.81 correlation with lab values for macros from food photos
- DietAI24 framework combines LLM vision with RAG against nutrition databases for 65-nutrient estimation
- Adequate for dietary pattern tracking even if absolute values need calibration

**Cost:** OpenAI API costs (already budgeted for Pro tier photo logging).
**Risk:** Must clearly communicate estimates vs verified data. Suppr's existing confidence scoring handles this.

### 3d. Restaurant Menu Data via FDA Mandates (Low cost)

US chains with 20+ locations are legally required to publish calorie counts (FDA 21 CFR 101.11). This data is:
- Publicly available on chain websites
- Required to include: calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbs, sugars, fiber, protein
- Updated when menus change

**Approach:**
1. Build a curated database of top 100 US restaurant chains (covers ~80% of restaurant dining)
2. Source nutrition PDFs/pages from official chain websites (not scraping -- using published data)
3. Structure and normalize into Suppr's format
4. Update quarterly

**Legal considerations:**
- Using officially published nutrition data is legal (it's public compliance data)
- Scraping menu prices/descriptions from third-party aggregators (DoorDash, UberEats) raises TOS and copyright issues -- avoid
- Directly scraping chain websites is generally acceptable for factual nutrition data but check each chain's TOS

**Cost:** Development time for initial build + quarterly maintenance. No API fees.

### 3e. Brand Partnership Program (Long term)

Invite food brands to submit verified nutrition data directly:
- Offer a "Verified by Brand" badge in the app
- Brands get visibility to health-conscious users
- Start with popular DTC health food brands (e.g., protein bars, meal kits)
- Provide a simple submission portal

**Cost:** Development time for portal. Potentially revenue-positive (brands may pay for featured placement).

---

## 4. Revenue Model and Cost Analysis

### 4a. Competitor Pricing Reference

| App | Free tier | Premium price | Database approach |
|-----|-----------|---------------|-------------------|
| **MyFitnessPal** | Basic tracking, ads | $19.99/mo or $79.99/yr | 14M entries (mostly user-submitted, variable quality) |
| **Cronometer** | Basic tracking | $9.99/mo or $49.99/yr | NCCDB + USDA + user-submitted with photo verification |
| **Lose It!** | Basic tracking | ~$39.99/yr | Curated database + barcode |
| **Suppr** | 10 recipes, USDA | $5/mo (Base), $12/mo (Pro) | USDA + OFF + FatSecret + AI photo/voice |

### 4b. Per-API-Call Cost vs Revenue

Assuming a Base subscriber ($5/mo) logs 3 meals/day with ~4 ingredient lookups each:

| Scenario | Daily calls/user | Monthly calls/user | Cost/call | Monthly API cost/user |
|----------|-----------------|-------------------|-----------|---------------------|
| USDA only | 12 | 360 | $0 | $0 |
| + Edamam free | 4 overflow | 120 | $0 | $0 |
| + Edamam Pro | 4 overflow | 120 | $0.00003 | $0.004 |
| + Nutritionix | 4 overflow | 120 | ~$0.01* | ~$1.20 |
| + FatSecret Premier | 4 overflow | 120 | ~$0.001* | ~$0.12 |

*Estimated from monthly pricing / typical call volumes.

**Key insight:** USDA + Edamam free tier covers most needs at $0/user/month. Nutritionix's $299/mo minimum only makes sense at 250+ active Pro subscribers ($1.20/user amortization drops below $1 at scale).

### 4c. Recommended Tiered Database Access

| Tier | Sources | Monthly cost to Suppr | User price |
|------|---------|----------------------|------------|
| **Free** | USDA + local STAPLES table | $0 | $0 |
| **Base** | USDA + OFF (barcode) + Edamam (free tier) + FatSecret | ~$0 | $5/mo |
| **Pro** | All above + Edamam Pro + AI estimation + restaurant DB | ~$0.05-0.10/user | $12/mo |
| **Pro (future)** | All above + Nutritionix NLP | ~$1-2/user | $12-15/mo |

### 4d. Break-Even Analysis

At current pricing:
- **Base ($5/mo):** Pure margin on database costs (all free sources). Revenue funds development.
- **Pro ($12/mo):** Even with Edamam Pro + OpenAI for photo/voice, API costs are ~$0.50-1.00/user/month. 90%+ margin.
- **Nutritionix addition:** At $299/mo minimum, need 25+ active Pro users to keep API cost under $12/user. At 250+ Pro users, cost drops to ~$1.20/user -- comfortable margin.

---

## 5. Implementation Roadmap

### Phase 1: Quick wins (0-4 weeks)

1. **Add Edamam free tier** as fourth source in waterfall (between OFF and FatSecret)
2. **Expand local STAPLES table** from ~100 to ~500 common foods (zero API cost, improves fallback quality)
3. **Audit FatSecret tier** -- confirm Suppr is on Premier Free; ensure attribution compliance

### Phase 2: Community data (1-3 months)

4. **User correction flow** -- let users fix nutrition data with label photo upload
5. **Community verification** -- promote corrections after multiple confirmations
6. **Restaurant database v1** -- curate top 50 US chains from official published nutrition data

### Phase 3: AI + scale (3-6 months)

7. **AI nutrition estimation** for unmatched foods with confidence scoring
8. **Upgrade Edamam to Pro** pay-as-you-go when free tier limits are regularly hit
9. **Restaurant database v2** -- expand to 200 chains, add regional chains

### Phase 4: Premium data (6-12 months)

10. **Evaluate Nutritionix** when Pro subscriber count exceeds 250
11. **Brand partnership portal** for verified product submissions
12. **International expansion** -- FatSecret Premier Paid for non-US markets

---

## 6. Key Recommendations

1. **Immediate:** Add Edamam free tier. Zero cost, 900K additional foods, fills branded + restaurant gaps.
2. **Do not** pursue NCCDB or CalorieKing licensing -- too expensive for marginal benefit over USDA.
3. **Build user corrections** as a moat -- this is what differentiates Cronometer's accuracy reputation.
4. **Restaurant data from FDA-mandated public sources** is free and legal -- build a curated database.
5. **AI estimation is table-stakes** for 2026 -- Suppr already has the infrastructure (photo logging, confidence scoring, Atwater validation). Extend it to text-based estimation.
6. **Nutritionix is the endgame** for restaurant/branded coverage but defer until Pro subscriber revenue justifies $299+/mo.
7. **Per-user API cost should stay under $1/mo** to maintain healthy margins at $5-12/mo subscription prices.

---

## Sources

- [Nutritionix API](https://www.nutritionix.com/api)
- [Nutritionix Database Licensing](https://www.nutritionix.com/database)
- [Edamam Food Database API](https://developer.edamam.com/food-database-api)
- [Edamam Nutrition Analysis API](https://developer.edamam.com/edamam-nutrition-api)
- [FatSecret Platform API Editions](https://platform.fatsecret.com/api-editions)
- [FatSecret Platform API](https://platform.fatsecret.com/platform-api)
- [CalorieKing Developer Resources](https://www.calorieking.com/us/en/developers/)
- [CalorieKing Data License](https://www.calorieking.com/us/en/developers/data-license/)
- [NCCDB Licensing -- Nutrition Coordinating Center](https://www.ncc.umn.edu/food-and-nutrient-database/)
- [NCC Pricing](https://www.ncc.umn.edu/products/pricing/)
- [USDA FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/)
- [Open Food Facts](https://world.openfoodfacts.org/)
- [Open Food Facts API Documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Top Nutrition APIs for App Developers in 2026](https://www.spikeapi.com/blog/top-nutrition-apis-for-developers-2026)
- [Best Nutrition Databases and APIs](https://about.greenchoicenow.com/nutrition-data-api-comparison)
- [FDA Menu Labeling Requirements](https://www.fda.gov/food/food-labeling-nutrition/menu-labeling-requirements)
- [LLM Nutritional Estimation Study (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12513282/)
- [DietAI24 Framework (Nature)](https://www.nature.com/articles/s43856-025-01159-0)
- [MyFitnessPal Review 2026](https://calorie-trackers.com/reviews/myfitnesspal/)
- [Cronometer Data Sources](https://support.cronometer.com/hc/en-us/articles/360018239472-Data-Sources)

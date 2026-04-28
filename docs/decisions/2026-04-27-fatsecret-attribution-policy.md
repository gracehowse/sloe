# Decision log: FatSecret attribution policy implementation

**Date:** 2026-04-27
**Status:** Resolved — implementation shipped in this commit
**Owner:** integration-manager (review), executor (implementation), Grace (App Store submission)
**Authority:** FatSecret Platform API Attribution Policy (contract requirement)
**Supersedes/extends:** `2026-04-25-fatsecret-tier-confirmation.md`, `2026-04-26-fatsecret-upgrade.md`

---

## 1. Tier confirmation

| Question | Answer |
|---|---|
| **Current tier** | **Basic** (confirmed by Grace, 2026-04-25) |
| **Premier Free application** | Applied 2026-04-26; awaiting FatSecret approval |
| **Pending credentials** | When Premier Free is approved, Grace receives new `client_id` + `client_secret`; env vars `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET` already wired through `src/lib/nutrition/fatSecretConfig.ts` |
| **Effective scope on Basic** | `scope: "basic"` at token exchange (`src/lib/fatsecret/client.ts:74`) |

### What Basic tier grants access to

- Food and nutrition database via `foods.search` and `food.get`
- 7 nutrients per food: calories, protein, carbs, fat, fibre, sugar, sodium
- **No barcode scanning, no auto-complete, no food categories**
- **No recipe content fields**: the FatSecret Platform API does not expose recipe instructions, headnotes, body copy, or photos through any tier. The Platform API is a nutrition/ingredient database — not a recipe content database. This is confirmed in the FatSecret API documentation.
- Rate limit: ~5,000 calls/day on Basic
- Attribution: **required** (visible badge or "Powered by fatsecret Platform API" text)
- Caching: **prohibited** on Basic (existing T19 Path B compliance in place)

### What Premier Free adds (when approved)

- US dataset (only — no UK/EU brands)
- Full nutrient panel: saturated fat, polyunsaturated fat, monounsaturated fat, trans fat, cholesterol, potassium, iron, calcium, vitamins A/C/D
- Barcode scanning, auto-complete, food categories
- Attribution still required (same wording)
- Caching: permitted on Premier Free

### What Premier (paid) adds

- Worldwide datasets (UK + EU + AU brands)
- No attribution required (white-labelled)
- Engineering implication: when Grace upgrades to paid Premier, remove the `FatSecretBadge` renders and update the `/licences` page wording

---

## 2. Edamam status

Edamam keys are present in `.env.local` (`EDAMAM_APP_ID=7e8d54f7`).

| Question | Answer |
|---|---|
| **Tier** | Free (inferred from `.env.local` comment: "Free tier: 1,000 req/day") |
| **Content access** | Restaurant + branded food nutrition via Food Database API v2. Nutrition Analysis API (recipe-level macros from ingredient lines). **No recipe prose, instructions, or content fields through any Edamam tier.** |
| **Attribution** | Required per Edamam ToS. Already documented on `/licences` page as `Edamam API terms (commercial licence)`. Comment in `FoodSearch.tsx:937` correctly notes the Edamam attribution requirement. |
| **Rate limit** | 1,000 req/day on Free tier |
| **Implementation status** | Fully wired: `src/lib/edamam/client.ts`, `app/api/edamam/search/route.ts`, FoodSearch merges Edamam results alongside USDA and OFF |

The `/licences` page entry for Edamam (`"commercial licence"`) is the correct wording per the 2026-04-25 licence page sweep — Edamam is on a commercial-tier contract. No change required.

---

## 3. Attribution policy: what the FatSecret ToS requires

Per the FatSecret Platform API Attribution Policy (the contract):

1. **In-app badge or text**: wherever FatSecret content is displayed, show the official badge image *or* the attribution snippet `"Powered by fatsecret Platform API"`.
2. **At least one public (pre-login) placement**: the badge must appear on a page accessible without user authentication.
3. **App Store / Play Store description**: must include `"Powered by fatsecret nutrition API (www.fatsecret.com)"`.
4. **Public website**: the official badge must appear on the product's public web presence.
5. **Must not modify the attribution HTML**: do not alter wording, recolour, resize beyond natural proportions, or suppress the badge conditionally for aesthetic reasons.

---

## 4. Implementation shipped

### (A) `<FatSecretBadge>` primitive

**Web:** `src/app/components/ui/FatSecretBadge.tsx`
- `variant="badge"` — official 90×15 badge image via `<img>` (must not be modified)
- `variant="text"` — plain "Powered by fatsecret Platform API" text fallback
- `show={bool}` — when false renders null; call sites pass `show={hasFatSecretContent}` to keep attribution conditional and declarative

**Mobile:** `apps/mobile/components/ui/FatSecretBadge.tsx`
- `variant="badge"` — remote `<Image>` of the official badge SVG
- `variant="text"` — plain Text link (offline-safe; recommended for result lists)
- `show={bool}` — same pattern as web

### (B) Wire-up sites

| Surface | File | Condition |
|---|---|---|
| Landing page footer (public, always) | `app/(landing)/LandingPage.tsx` | Always renders — satisfies the "public placement" requirement |
| Web recipe detail — Ingredients tab | `src/app/components/RecipeDetail.tsx` | `hasFatSecretIngredients` derived from ingredient `source` fields |
| Web log-sheet — Search results | `src/app/components/suppr/log-sheet.tsx` | Any result has `source === "fatsecret"` |
| Mobile recipe detail — Ingredients tab | `apps/mobile/app/recipe/[id].tsx` | `hasFatSecretIngredients` derived from ingredient `source` + `fatsecret_food_id` |
| Mobile recipe detail — Nutrition tab | `apps/mobile/app/recipe/[id].tsx` | Same `hasFatSecretIngredients` |
| Mobile log-sheet — Search results | `apps/mobile/components/today/LogSheet.tsx` | Any result has `source === "fatsecret"` (via `ListFooterComponent`) |

### (C) Existing attribution surfaces (unchanged)

| Surface | File | Status |
|---|---|---|
| `/licences` page | `app/licences/page.tsx:39` | Already accurate ("FatSecret Platform terms (Basic developer tier — non-caching)") |
| Trademarks section | `app/licences/page.tsx:139` | "FatSecret is a trademark of FatSecret, LLC" already present |

### (D) App Store + Play Store listing

`docs/launch/app-store-listing.md` updated to add:

> Powered by fatsecret nutrition API (www.fatsecret.com)

This phrase is in the Description section under `[ATTRIBUTION]` and in the new `## Attribution requirements` section. Grace must copy this phrase verbatim into App Store Connect and the Play Console description before submission. It must survive any copy-editing pass.

---

## 5. Recipe sourcing strategy for onboarding seeds

### Context

The 15 onboarding seed recipes (`src/lib/onboarding/onboardingSeeds.ts`) are hand-curated titles that resolve via case-insensitive match against `recipes.title` in the database. The titles reference dishes like "Sheet-pan harissa chicken with chickpeas" and "Lentil bolognese". These are **generic recipe names**, not content from any third-party database.

### Key facts established above

- FatSecret Platform API: **nutrition/ingredient database only**. Does not provide recipe instructions, headnotes, body copy, or photos through any tier. If we sourced seeds "from FatSecret" we would get macro data for ingredients only — we'd still need to write the recipe prose ourselves.
- Edamam Food Database + Nutrition Analysis API: **nutrition analysis only**. Returns macros from ingredient lines, not recipe prose.
- USDA FoodData Central: nutrition data for raw ingredients, not recipe content.
- Open Food Facts: product/barcode data, not recipe content.
- NHS / government recipe collections: exist but are text-dense and optimised for nutritional education, not cooking UX.

### What "FatSecret-sourced recipes" actually means

No tier of the FatSecret Platform API dispenses recipe text. When the decision refers to "FatSecret-sourced" it means: the **ingredient nutrition** was resolved against FatSecret's food database. The recipe prose — title, description, instructions, headnotes — must always originate from a licensed or original source.

### Recommendation: Path B (all 15 are originally written)

**This is the cleanest practical path for the following reasons:**

1. **No third-party content at risk.** Path B means the seed recipes are Suppr originals — prose written by Grace or the team. No ToS entanglement for recipe text. Attribution only applies to the ingredient nutrition lookup (FatSecret / USDA / OFF), which is already handled by the per-ingredient `source` attribution and the `FatSecretBadge` component shipped in this commit.

2. **The current seeds are already de-facto original titles.** The 15 seeds in `onboardingSeeds.ts` are generic recipe names: "Lentil bolognese", "Miso salmon with greens", "Korean chicken rice bowl". None are scraped or imported from a creator's site. When Grace writes the corresponding recipe prose (instructions, headnotes, images), they become Suppr originals with no third-party content obligation.

3. **N=1 tester context.** At solo-tester scale, the priority is that these 15 recipes exist in the database as properly verified records with accurate macros. Recipe prose quality matters for the first-impression UX but does not require a licensed third-party provider.

4. **Seeds are matched by title, not imported by URL.** The `seed-recipe-urls.txt` file is marked `TEMPORARY` and `NOT licensed for public redistribution — purge before any external launch`. The current seed titles in `onboardingSeeds.ts` are not the same as those blog URLs — the seeds list was independently authored. The URL list is for the Discover feed seeding script, not the onboarding picker.

5. **Path A (FatSecret-sourced recipe content) is not available on any tier.** FatSecret does not provide recipe prose. This path is not a real option.

6. **Path D (Edamam) is not available.** Same: Edamam provides nutrition analysis, not recipe text.

7. **Path E (NHS / government recipe text)**: technically available — government works in the UK are Crown Copyright, and the NHS offers some recipe content under OGL (Open Government Licence). Usable, but the UX quality is not first-impression-quality. Not recommended when original prose is equally achievable.

**Practical implementation of Path B:**

- Grace writes prose for each of the 15 seeds (or nominates someone to). Short: title, ~50-word description, ingredient list, 5–8 instruction steps.
- Ingredient macros are resolved through the existing USDA → OFF → FatSecret pipeline at `verify-recipe` time.
- The resulting database records are Suppr originals with accurate, attributed nutrition.
- The `FatSecretBadge` component renders on the recipe detail whenever FatSecret matched any ingredient — which is the correct and sufficient attribution.

---

## 6. When to re-open this decision

- **Grace receives Premier Free credentials** → swap env vars, update `src/lib/fatsecret/client.ts` scope to `"premier"`, re-allow caching in `fatsecretCacheGuard.ts`, update `/licences` page wording to "Premier Free developer tier — caching permitted", verify attribution requirement is unchanged (it is on Premier Free).
- **Grace upgrades to paid Premier** → remove `FatSecretBadge` renders (attribution no longer required), update `/licences` page wording to "Premier developer tier — white-labelled".
- **FatSecret changes their attribution requirements** → update badge implementation and all wire-up sites.
- **App Store submission** → confirm the attribution phrase is in the description before submitting. One-time Grace action.

---

## Related artefacts

- `src/app/components/ui/FatSecretBadge.tsx` — web primitive
- `apps/mobile/components/ui/FatSecretBadge.tsx` — mobile primitive
- `app/(landing)/LandingPage.tsx` — public footer placement
- `src/app/components/RecipeDetail.tsx` — ingredient + nutrition tab
- `src/app/components/suppr/log-sheet.tsx` — search result list
- `apps/mobile/app/recipe/[id].tsx` — ingredient + nutrition tab
- `apps/mobile/components/today/LogSheet.tsx` — search result list
- `docs/launch/app-store-listing.md` — App Store + Play Store attribution phrase
- `app/licences/page.tsx` — `/licences` page (already accurate)
- `src/lib/fatsecret/client.ts` — `scope: "basic"` token exchange
- `src/lib/onboarding/onboardingSeeds.ts` — 15 seed titles (all original)
- [Tier confirmation 2026-04-25](./2026-04-25-fatsecret-tier-confirmation.md)
- [Tier upgrade 2026-04-26](./2026-04-26-fatsecret-upgrade.md)

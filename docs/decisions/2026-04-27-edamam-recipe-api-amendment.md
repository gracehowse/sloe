# Amendment: Edamam Recipe Search API — correction to 2026-04-27-fatsecret-attribution-policy.md

**Date:** 2026-04-27
**Status:** Resolved — recommendation updated
**Owner:** integration-manager
**Corrects:** `docs/decisions/2026-04-27-fatsecret-attribution-policy.md` §2, which stated "No recipe prose, instructions, or content through any Edamam tier." That statement described the Food Database API and the Nutrition Analysis API only. It incorrectly omitted the Edamam **Recipe Search API**, which is a separate product.
**Related:** `docs/decisions/2026-04-27-onboarding-seed-copyright-review.md`, `docs/decisions/2026-04-27-fatsecret-attribution-policy.md`

---

## 1. Credentials status — RECIPE SEARCH API

`.env.local` contains exactly two Edamam keys:

```
EDAMAM_APP_ID=7e8d54f7
EDAMAM_APP_KEY=87f0a5418db401dddab0b6cd35cd5ee1
```

These credentials are registered against the **Edamam Food Database API** and the **Edamam Nutrition Analysis API**. Both APIs share one app registration.

The **Edamam Recipe Search API** (`https://api.edamam.com/search`) is a separate product requiring a separately registered application — its own `app_id` and `app_key` pair obtained by creating a "Recipe Search" application at `developer.edamam.com`. The Food Database credentials **do not** work against the Recipe Search endpoint.

**Verdict: no Recipe Search credentials exist in this repo.** Grace would need to apply for a separate Recipe Search application to access this API.

---

## 2. Edamam Recipe Search API — tiers and application path

Edamam offers three tiers for the Recipe Search API (as of knowledge cutoff August 2025 — verify against https://developer.edamam.com/edamam-detailed-pricing-recipe-api before applying):

| Tier | Cost | Rate limit | Commercial use |
|---|---|---|---|
| **Developer (Free)** | $0 | 10,000 calls/month | **Non-commercial only** |
| **Production** | ~$99–$299/month (varies) | Higher; SLA provided | **Commercial — permitted** |
| **Enterprise** | Custom | Custom | Commercial + white-label |

Typical approval time for a Developer tier registration: near-instant (self-serve). Production tier requires a business agreement; approval takes 1–5 business days in practice.

**Application path if Grace wants to pursue this:** visit `https://developer.edamam.com/edamam-docs-recipe-api`, create a new "Recipe Search" application under the developer account, and select the Production tier for commercial use. The Developer (Free) tier is not suitable for a paid app.

---

## 3. ToS read — Edamam Recipe Search API

Source: Edamam Developer Terms of Service and Recipe API documentation, as of knowledge cutoff August 2025. Grace must verify current wording at `https://developer.edamam.com/edamam-detailed-pricing-recipe-api` and the linked Terms before applying, since Edamam has revised its terms several times.

The citations below reference the clauses as they stood at knowledge cutoff. Exact clause numbers should be confirmed against the live document.

### 3a. Attribution requirements

The Edamam Recipe Search API contract requires:
- Display of an **Edamam attribution badge** ("Powered by Edamam") wherever recipe content from the API appears.
- A **clickable link** from each recipe back to the **source publisher's URL** (the `url` field in the API response). This is load-bearing: the recipe content belongs to the publisher, not Edamam. Edamam licenses the index; the underlying content stays under the publisher's terms.
- Edamam supplies a badge asset (SVG/PNG) for this purpose.

**Key distinction:** Edamam's attribution requirement has two layers — attribution to Edamam for the search/index capability, and a source link back to the original publisher for the recipe content. Both are required simultaneously.

### 3b. Republication / redistribution clause

This is the crux. Edamam's Recipe Search API is explicitly designed as a **distribution/discovery layer**: the use case is surfacing recipes from across the web to end users via a third-party application. The API response includes:

- Recipe title
- Source publisher name and URL
- Thumbnail image URL (hosted on Edamam's CDN)
- Ingredient list
- Nutrient totals
- Diet/health labels

**What Edamam's contract permits:** displaying these fields to your end users within your application, provided attribution is present. This is the intended and contracted use.

**What Edamam's contract does not permit:** storing and re-serving recipe body text (instructions, headnotes, method steps) from the publisher's page without the publisher's separate licence. The Recipe Search API response does not return full recipe instructions — it returns the indexed metadata (title, ingredients, nutrients, source URL). Full instructions require fetching the publisher's page directly, which is outside Edamam's licence scope.

**Legal-reviewer reconciliation:** The legal-reviewer concern in `2026-04-27-onboarding-seed-copyright-review.md` §B was:
> "Surfacing third-party-imported content to new users in onboarding is a step-change from private personal-import storage."

For **URL-import** (scraping a publisher's recipe page), that concern stands: the app has no licence from the publisher.

For **Edamam Recipe Search API responses**, the position is different:
- Edamam has licensed the right to index and distribute this metadata to its API subscribers.
- Displaying the API response (title, ingredients, nutrients, source URL, thumbnail) to app users is the contracted use — not a fair-use stretch.
- The publisher URL is required to be displayed, which preserves the publisher's traffic attribution.
- **Full instructions remain out of scope** — the API does not return them, and Edamam's contract does not cover scraping the source page to retrieve them.

If usage is confined to what the API response actually contains (metadata + ingredients + macros + source link), **legal-reviewer's republication concern is satisfied via the Edamam contract chain**, subject to the attribution requirements being correctly implemented.

### 3c. Caching rules

Edamam's terms on the Developer (Free) tier typically prohibit or heavily restrict caching (same posture as their Food Database Free tier). On the Production tier, caching is permitted, subject to a maximum retention period. The current documented limit in the Recipe Search API agreement is **24 hours** on Production (verify against live terms — this clause has changed between API versions).

Implication: if we cache seed recipes at DB seeding time (a one-time write, not a live query cache), this needs to be interpreted carefully. A one-time seed write is closer to "storing content" than "caching a query result." Edamam's contract language tends to focus on query-result caching, not permanent DB storage. This is a clause Grace's counsel should confirm before committing to persistent storage of the API response fields.

### 3d. Modification rules

The API response fields (recipe title, ingredients, source attribution) must be displayed as returned. Modifying the recipe title, altering attribution, or omitting the source URL is not permitted. Ingredient list can be used for macros computation, but the display must preserve provenance.

**Implication for seeding:** if we seed with Edamam Recipe Search content, we cannot detach the record from its `source_url`. The seed rows must carry `source_url` pointing back to the publisher, and that URL must be displayed wherever the recipe appears in the app. The `source_name = 'Suppr'` pattern used for originally-authored content must not be applied to Edamam-sourced rows.

### 3e. Commercial use rules

The **Developer (Free) tier explicitly excludes commercial use.** The Production tier permits commercial use (paid apps, monetised service). Since Suppr has an active Stripe paywall, the Developer tier is not usable for production. Production tier must be obtained before any Edamam Recipe Search content is served to users.

**This is a hard gate.** Do not use Developer-tier credentials in the production app.

---

## 4. Updated recommendation

### Path A (Edamam Recipe Search seeds with attribution)

**Status: Conditionally viable, but blocked on two prerequisites.**

The ToS analysis above shows that surfacing Edamam Recipe Search API metadata (title, ingredients, macros, source URL) to end users is the product's intended contracted use. If the Production tier is obtained and attribution is correctly implemented, legal-reviewer's republication concern is satisfied via the contract chain.

**However, two hard gates must be cleared before Path A is viable:**

1. **Production tier required.** Current Suppr setup has no Recipe Search credentials at all. A Production-tier Recipe Search application must be registered and paid for (~$99–$299/month depending on volume). This is a recurring cost with no current budget allocation.

2. **Full recipe instructions are not in scope.** The API returns metadata, not instructions. For onboarding seeds, we need a usable cooking experience — title, ingredients, macros, and a source link are not enough for a recipe the user will actually cook. The instructions would need to come from the publisher's page (not covered by Edamam's licence) or be written originally.

**The second gate is the more fundamental problem.** Edamam Recipe Search returns enough to power a discovery/inspiration surface, but not enough to replace originally-authored recipes for a cooking-primary use case. A seed recipe without instructions is not a seed recipe — it is a meal plan entry with macros.

**Narrow valid use case under Path A:** if the goal shifted from "15 cookable seed recipes" to "15 nutritionally-accurate meal entries the user can log as inspiration," Edamam Recipe Search could power that. That is not the stated intent of the seed list.

### Path B (original prose by Grace)

**Status: Still the cleanest path. Recommendation unchanged.**

Path B remains correct for the following reasons:

1. The seed recipes need instructions to be useful to users at the cooking surface. No third-party API covers this need within their contract scope.
2. Original prose means `source_name = 'Suppr'`, no attribution UI complexity, no recurring third-party API cost, no contract renewal risk.
3. At N=1 tester scale, 15 recipes is not a burdensome writing task. At 200 words each, it is approximately 3,000 words total.

### Hybrid path

Not recommended at this stage. The overhead of managing two provenance streams (Suppr-original vs Edamam-attributed) within the seed set outweighs any benefit. If Edamam Recipe Search is adopted later as a **Discover feed** data source (its natural product fit), that is a separate surface with different UX constraints and a natural home for attributed external content.

---

## 5. If Path A is pursued in future — implementation sketch

This section is scoped for future reference. Do not ship without Grace and legal-reviewer acceptance. Phase 5 executor continues on Path B.

### 5a. Required prerequisites

- Register a "Recipe Search" application at `developer.edamam.com` under the Production tier.
- Add env vars `EDAMAM_RECIPE_APP_ID` and `EDAMAM_RECIPE_APP_KEY` to `.env.local`, `.env.example`, and all deployment environment configs.
- Confirm caching clause with counsel (whether one-time DB seeding constitutes prohibited caching).
- Obtain Production tier contract sign-off from Grace before any API calls in production.

### 5b. Client module

New file: `src/lib/edamam/recipeSearchClient.ts`

- Reads `EDAMAM_RECIPE_APP_ID` / `EDAMAM_RECIPE_APP_KEY` — completely separate from the existing `edamamConfigFromEnv()` in `client.ts`.
- Wraps `GET https://api.edamam.com/search?q=<query>&app_id=...&app_key=...`.
- Schema validates the response (title, url, source, image, ingredientLines, totalNutrients).
- 8-second timeout. Returns empty array on 429 or 5xx. No retries on 4xx.
- Returns `EdamamRecipeHit[]` with fields: `title`, `url`, `source` (publisher name), `image`, `ingredientLines`, `calories`, `totalNutrients`.

### 5c. Seed-fetching script

New file: `scripts/seed-edamam-recipes.ts`

- Accepts a list of search queries matching the 15 seed slugs.
- For each query, calls `recipeSearchClient`, takes the top candidate, prompts for human review (since this is a one-time seed operation).
- Persists to `recipes` table with:
  - `source_name = 'Edamam'`
  - `source_url = <publisher URL from API response>`
  - `published = false` (not Discover-eligible without separate review)
  - `is_seed = true`
  - SQL comment: `-- origin: edamam-recipe-search, seeded YYYY-MM-DD`
- Does NOT store full instructions (they are not in the API response). Stores ingredient lines and macros only. This is the fundamental limitation that makes Path A unsuitable for a cooking-primary surface.
- Does NOT apply as a Supabase migration via MCP. Grace runs `supabase db push --linked`.

### 5d. Attribution primitive

New component: `src/app/components/ui/EdamamBadge.tsx` (web) and `apps/mobile/components/ui/EdamamBadge.tsx` (mobile)

Mirrors the `FatSecretBadge` pattern:
- `variant="badge"` — official Edamam "Powered by Edamam" badge image.
- `variant="text"` — plain text fallback.
- `show={bool}` — conditional on `source === 'Edamam'`.
- Always paired with a visible `source_url` link to the original publisher — the two are not separable.

### 5e. Surface attribution

Wherever a recipe with `source === 'Edamam'` renders:
- Recipe detail: `<EdamamBadge>` + publisher link below recipe header.
- Log-sheet search results: `<EdamamBadge>` in list footer (same pattern as `FatSecretBadge`).
- Landing page: add Edamam to the existing data sources section.
- `/licences` page: add entry for "Edamam Recipe Search API (Production commercial licence)".
- App Store listing: add "Recipe discovery powered by Edamam (www.edamam.com)".

### 5f. Seed-resolver gate update

The existing gate in the copyright review (`source_name = 'Suppr'` whitelist) would need to expand to include `source_name = 'Edamam'` conditionally. Requires a separate legal-reviewer sign-off before that gate is opened.

---

## 6. Open questions for legal-reviewer follow-up

1. **Caching clause (Priority: HIGH if Path A is pursued).** Edamam's Production tier caching terms need to be read against the specific use case of one-time DB seeding. Is storing the API response fields permanently in Supabase a caching violation, or is caching defined as "query-result cache" (TTL-based)? This is the clause that determines whether seed persistence is permitted at all.

2. **Publisher chain of rights (Priority: HIGH if Path A is pursued).** Edamam indexes third-party publisher pages. The API contract with Edamam covers display of indexed metadata, but the publisher has not separately contracted with Suppr. If a publisher requests removal, what is Suppr's obligation? Edamam's contract should clarify this — legal-reviewer should confirm takedown/removal obligations before seeding with publisher content.

3. **Instructions gap (Priority: MEDIUM — affects product decision).** If the 15 seeds genuinely need instructions, no contract path delivers them without either original authorship or a direct licence from each publisher. Legal-reviewer should confirm there is no contract path Edamam offers (e.g. a content licence tier) that covers instructions.

4. **Developer vs Production tier mixing (Priority: LOW — housekeeping).** The existing `EDAMAM_APP_ID` / `EDAMAM_APP_KEY` in `.env.local` are registered as Food Database API credentials. The comment in `.env.local` calls this a "commercial licence" and the `/licences` page reflects that. What tier are these actually registered under? This does not affect the Recipe Search API question but should be confirmed when Grace next accesses the Edamam developer dashboard.

---

## 7. Correction to 2026-04-27-fatsecret-attribution-policy.md

The following sentence in §2 of that document is incorrect:

> **No recipe prose, instructions, or content fields through any Edamam tier.**

The corrected statement is:

> The Food Database API and Nutrition Analysis API do not return recipe prose, instructions, or content fields — these are nutrition-data products only. The **Edamam Recipe Search API** is a separate product that does index and return recipe metadata (title, ingredients, macros, source URL) from third-party publishers. We do not currently hold Recipe Search credentials. The Recipe Search API does not return full cooking instructions; those remain outside its contract scope. See `docs/decisions/2026-04-27-edamam-recipe-api-amendment.md` for full analysis.

That correction should be applied to the source doc as a note. The original doc stands for all other content; only that one sentence in §2 is superseded.

---

## 8. Summary

| Question | Answer |
|---|---|
| Do we have Recipe Search credentials? | **No.** Only Food Database + Nutrition Analysis credentials exist. |
| Are Recipe Search credentials the same as Food Database credentials? | **No.** Separate product, separate app registration, separate key pair. |
| Does Edamam Recipe Search return recipe prose / instructions? | **No.** It returns title, ingredients, macros, source URL, thumbnail. Instructions are not in the response. |
| Does the Recipe Search ToS permit surfacing results to end users? | **Yes, on Production tier.** That is the product's intended use. Attribution to Edamam + link to source URL required. |
| Is the Developer (Free) tier usable in our paid app? | **No.** Non-commercial only. Production tier required. |
| Does Path A satisfy the legal-reviewer republication concern? | **Yes, narrowly** — for metadata display with attribution. Not for instructions (those are not in the API response). |
| Is Path A viable for the 15 onboarding seeds (which need cooking instructions)? | **No.** The API does not return instructions. Seeds without instructions are not usable at the cooking surface. |
| Recommendation | **Path B unchanged.** Original prose by Grace. Edamam Recipe Search is the natural fit for a Discover feed (future), not onboarding seeds that require cookable instructions. |

---

## Related artefacts

- `docs/decisions/2026-04-27-fatsecret-attribution-policy.md` — source of the incorrect claim (§2, Edamam status)
- `docs/decisions/2026-04-27-onboarding-seed-copyright-review.md` — legal-reviewer's republication finding (§B)
- `src/lib/edamam/client.ts` — Food Database + Nutrition Analysis client (unchanged; not Recipe Search)
- `https://developer.edamam.com/edamam-docs-recipe-api` — Recipe Search API docs
- `https://developer.edamam.com/edamam-detailed-pricing-recipe-api` — Recipe Search pricing + ToS (verify before applying)

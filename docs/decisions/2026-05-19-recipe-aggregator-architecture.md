# Recipe aggregator architecture — Deglaze-style search without the copyright exposure

Date: 2026-05-19
Status: **Proposed. Approval needed before any implementation.**
Owner: Grace
Related: `docs/decisions/2026-05-19-suppr-design-direction-v1.md`
(this is a parallel workstream — product/data architecture, not visual direction)

## The question

Grace identified Deglaze as a competitor that does what Suppr wants
to do — *"recipe search for recipes from all top sites (follow sites
and recipe authors etc) — we need to work out how they do that
without hitting copyright issues as that's exactly what we want to
do."*

This doc answers that question and proposes the architecture for
Suppr's equivalent.

## What Deglaze appears to be doing (best inference)

Deglaze's marketing site and Terms of Service are deliberately
vague on the technical architecture. What I can establish from the
public artefacts:

**Confirmed:**
- Primary import is **user-initiated share extension** (Safari, Chrome, Instagram, TikTok → tap Share → Deglaze → recipe saved to user's library)
- Photo OCR import for cookbook pages + handwritten recipes
- Recipe Search advertised: *"includes recipes from all the top sites. Follow your favorite sites and recipe authors to get personalized search results."*
- DMCA takedown process (email: help@deglaze.app)
- ToS distances Deglaze from third-party content but doesn't explain how recipes are sourced for search
- ToS grants Deglaze a *"nonexclusive, worldwide, royalty-free, perpetual, transferable, sublicensable, fully paid, irrevocable license"* over **user-submitted content** — which suggests their legal model leans heavily on the user-as-actor pivot

**Most likely (inferred):**
- They index **schema.org/Recipe JSON-LD** from a curated allowlist of publisher sites (NYT Cooking, BBC Good Food, Bon Appétit, Serious Eats, etc.). This data is *intended* for indexing — publishers add it specifically so search engines + apps can read it.
- Search results show title + (probably hotlinked) image + cook time + small attribution + a "Save" button.
- The "Save" action triggers their existing user-initiated import flow — the user becomes the actor, and the recipe is parsed into their personal library.
- "Follow a site" = personalisation signal weighting search results.
- "Follow an author" = either schema.org `recipeAuthor` field or a manually maintained author-to-publisher mapping for known names.

**Likely legal exposure they accept that we shouldn't:**
- Image hotlinking from publisher CDNs (we already learned not to do this — see `next.config.ts` history with `images.immediate.co.uk`)
- No publisher licensing agreements (most aggregators don't have these)
- Reliance on DMCA reactive takedowns rather than proactive licensing

## What's actually copyrightable in a recipe (US, UK, EU)

This is the crux. Most of a recipe is NOT protected.

**Not protected — free to index and reproduce:**
- Ingredient list (a "mere listing of ingredients" is uncopyrightable)
- Bare cooking instructions ("functional directions" / "factual statements")
- The dish itself (only the *written expression* can be copyrighted, not the food)
- Recipe title (usually too short for protection)
- Cook time, prep time, servings, nutrition info (facts)

**Protected — must NOT reproduce without licence:**
- Photography (always — even of public dishes)
- "Substantial literary expression" in headnotes, anecdotes, creative descriptions
- Recipe text as a specific written expression (someone can rewrite a recipe with different language and not infringe; copying the exact wording infringes)
- Cookbook compilations as a whole (selection + arrangement is protected even if individual recipes are not)
- Publisher trademarks + logos

**Database rights (UK + EU sui generis):**
- The SELECTION and ARRANGEMENT of a publisher's recipe corpus is protected, even where individual recipes are facts
- Wholesale reproduction of a publisher's recipe collection = infringement of database rights
- Indexing for search (the way Google does) = generally OK
- The line: we can INDEX and LINK; we cannot REPUBLISH the corpus

**Fair use (US) vs fair dealing (UK):**
- US fair use is broader; might cover transformative aggregation if the use is genuinely transformative (e.g. adding macro analysis the original doesn't have)
- UK fair dealing is narrower — limited to research, criticism/review, news reporting, quotation. None cleanly covers commercial recipe aggregation.
- **Suppr's posture (UK Ltd / Cayman-immigrating): we do NOT rely on fair use.** We rely on (a) indexing facts, (b) user-initiated import, (c) attribution + link-out, (d) avoiding protected expression in search previews.

## The Suppr architecture — proposed

Three layers. Each clean independently; together they deliver Deglaze's
feature without its exposure.

### Layer 1 — Indexed recipe corpus (schema.org/Recipe JSON-LD)

A curated allowlist of ~50 publisher sites that publish
schema.org/Recipe JSON-LD on their recipe pages. We index this
structured data via a backend crawler running on a schedule.

**What we store per recipe (all facts, none protected):**
- Title
- Source URL (canonical link to publisher page)
- Source publisher name (e.g. "BBC Good Food")
- Source author name (`recipeAuthor`)
- Cook + prep time
- Servings
- Cuisine + meal type tags
- Ingredients list (facts — uncopyrightable)
- Nutrition info from the publisher (if provided)
- **NO** headnote / story / creative description
- **NO** publisher photography URL (we never store + never hotlink — see Layer 2)
- **NO** step-by-step instructions (deferred to Layer 3)

**Crawl posture:**
- Respect `robots.txt`
- Identify ourselves with a documented User-Agent: `SupprBot/1.0 (+https://suppr-club.com/bot)`
- Rate-limit conservatively (1 req / 2s per host)
- Honour `nofollow` + `noindex` metatags
- Honour publisher opt-out by email request — same as Google does

**Allowlist of publishers (initial 50):**
- We start with sites that publish schema.org/Recipe JSON-LD AND have a public crawling-permitted robots.txt
- Examples: NYT Cooking (their public free recipes), BBC Good Food, Serious Eats, Bon Appétit, Food Network, Eatingwell, Delicious, Recipe Tin Eats, Half Baked Harvest, Smitten Kitchen, etc.
- Excludes: paywalled-only publishers (NYT premium, Cook's Illustrated), publishers whose ToS explicitly forbids scraping

### Layer 2 — Search + browse UX (preview only, never republish)

When a user searches, Suppr shows results from the indexed corpus.
Each result card is **a teaser, not a republication**.

**What each search result card shows:**
- Title (fact — fine)
- Publisher name + author (attribution — required)
- Cook time, servings (facts)
- Macro estimate (OUR derivation — see Layer 4)
- Cuisine tag
- **A neutral placeholder image OR our own commissioned photography** — NEVER the publisher's photo. This is the single most important legal call.
- **"View on [Publisher] →" link to the original source page** (drives traffic to publisher — fair attribution)
- **"Save to Library" button** that triggers Layer 3

**What each search result card explicitly does NOT show:**
- Publisher's photography (hotlinked or stored)
- Headnote / story / creative description
- Full ingredient list (we have it indexed but don't display in the preview — the preview teases, the save fetches in full)
- Full instructions

**"Follow site" + "Follow author":**
- Site follow = personalisation signal; weights search results toward that publisher
- Author follow = the same on the `recipeAuthor` field
- A small per-site / per-author indicator on relevant cards
- A dedicated "Following" feed showing recent recipes from followed sources

**Image strategy (the differentiator):**
- For our top ~50 hero recipes (Phase V9 of the design direction plan), commission our own photography
- For the remaining indexed corpus, use a neutral placeholder OR an AI-generated tasteful representation OR a generic per-cuisine ceramic-bowl illustration
- Trade-off: search results look LESS like Pinterest visually. Trade-off accepted because (a) it's the legally clean path, (b) Suppr's aesthetic is restrained anyway, (c) once the user saves a recipe, the full recipe page can show the publisher's photo as fair-use in-context attribution.

### Layer 3 — User-initiated full import (save action)

When the user taps "Save to Library" on a search result, OR uses
the share extension on a publisher page, the same import flow
runs. The user is the actor; we are providing a tool.

**What the import does:**
- Fetches the recipe URL (one-time, on user request)
- Parses ingredients (already indexed — no fetch needed)
- Parses step-by-step instructions (factual, not literary expression)
- Stores in the user's PRIVATE library
- The full recipe IS available to the user in-app from that point — same as Paprika, Recime, Crouton

**The legal pivot:**
- The user is the actor. They're saving a recipe they're consuming.
- This is analogous to the user clipping a recipe from a magazine for personal use — long-established as fair use / fair dealing under "private study" / "private copy" doctrines.
- The recipe lives in the user's private library, not in our public corpus.
- **At no point do we re-publish the recipe publicly.**

**Photography on the user's saved recipe page:**
- Now in private context, we CAN store + display the publisher's photograph (in-context personal use attribution)
- OR continue to use our own placeholder — Phase V9 (photography commission) decision
- Recommendation: **publisher's photo permitted on private library recipe page with prominent attribution + link-out**. Same posture as Pocket or Instapaper.

### Layer 4 — The Suppr value layer (the differentiator)

What Suppr adds that Deglaze, Paprika, Recime don't:

- **Verified macros**: every imported recipe gets parsed against USDA + Open Food Facts + FatSecret with plausibility checks. Count-to-weight normalisation. Macros that pass the bar are shown; recipes that fail get a "Verify this recipe" prompt.
- **Plan integration**: a saved recipe can drop into the meal planner as-is, with portions auto-adjusted to fit the day's targets.
- **Cook Mode**: the recipe's parsed steps power our Crouton-bar Cook Mode (voice + wink-nav).

These features are NOT republication of the recipe — they're transformative
use built on top of the user's saved copy. They're also the
£7.99/mo justification. Deglaze doesn't have any of this.

## Legal risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Publisher DMCA / cease-and-desist on indexing | Medium | Honour all takedowns within 24h. Maintain `help@suppr-club.com` for notices. Document the corpus + crawl posture publicly. |
| Photography hotlinking infringement | High if we did it / Zero if we don't | Architecture forbids hotlinking. Never store publisher images on Suppr CDN. Never render them via `<img src="publisher.com/...">`. |
| Database-rights infringement (EU sui generis) | Medium | Index facts only. Never reproduce a publisher's full corpus. Limit corpus per publisher to "popular recipes" (top N) not exhaustive crawl. |
| Trademark misuse (publisher logos in UI) | Low | Use nominative-use text attribution ("via BBC Good Food"). Don't render publisher logos without permission. |
| User-saved recipes leaking publicly | Low | All saved recipes are user-private by default. The "Go Public" affordance (existing on web per repo memory) requires explicit user action + warns about copyright. |
| Aggregation looks like republication in screenshots | Medium | UX discipline: search cards are clearly previews, not full recipes. Attribution prominent. "View on [Publisher]" CTA equal weight to "Save". |
| Indexing paywalled content | High exposure | Allowlist excludes paywalled-only publishers. Free articles from mixed-paywall publishers (NYT Cooking has free + paid) only. |

## What the existing Suppr codebase already supports

I'm not starting from zero. The repo already has:

- Recipe import via URL (the share-extension / paste flow) — full ingredient + step parsing, USDA + OFF macro matching, plausibility validation. See `src/lib/imports/`.
- Photo OCR import for cookbook pages + screenshots.
- The `recipes` table + `recipe_ingredients` table — already structured for the per-user library model.
- The 2026-05-16 CSV import adapter framework (per memory `reference_csv_import_adapter_framework.md`) — pluggable per-format.
- The image-hotlinking memory + `next.config.ts` carve-out (we already learned not to hotlink BBC Good Food).
- The repo `recipe_go_public` flow (existing per memory `project_recipe_go_public_web_only.md`) — user-controlled public sharing.

**What needs to be built:**

- The schema.org/Recipe JSON-LD crawler (new — backend service)
- The indexed-corpus database table (new — `indexed_recipes` separate from `recipes`)
- The search API surface (`/api/recipes/search` — currently scoped to user's library only)
- The "Follow site" + "Follow author" data model + UI (new)
- The placeholder / commissioned-photography mapping layer (parallel to the V9 commission)

## Phased implementation

This is **a separate workstream from the design direction plan.** Both can
run in parallel because they touch different layers:
- Design direction = visual + interaction
- Recipe aggregator = data + product feature

### Phase R0 — Legal sign-off + crawl policy publication

- Document the crawl posture publicly at `https://suppr-club.com/bot`
- Email each publisher on the proposed allowlist with a courteous notice + opt-out instructions (best practice + reduces takedown risk)
- Brief Grace's IP lawyer for any incorporation-track legal review
- **Time: 1-2 weeks (depends on lawyer availability)**

### Phase R1 — Schema.org JSON-LD crawler + indexed-recipes table

- Backend crawler (likely Cloudflare Worker + Postgres `indexed_recipes`)
- Initial corpus: 10 publishers, ~500 recipes total
- Respect robots.txt, rate-limit, dedupe by canonical URL
- **Time: 1 week eng**

### Phase R2 — Search API + result-card UX

- `/api/recipes/search?q=...&follow=...` — Postgres FTS or Algolia
- Result-card UI per the Layer 2 spec — placeholder image, attribution, "View on [Publisher]" + "Save" CTAs
- A11y: search results are clearly previews, not full recipes
- **Time: 1 week eng**

### Phase R3 — Follow site + follow author

- `user_followed_sites` + `user_followed_authors` tables
- "Following" feed surface (new tab section or filter on Discover)
- Push notification on followed-creator new-recipe-published events
- **Time: 1 week eng**

### Phase R4 — Save action wires to existing import flow

- "Save to Library" on a search result triggers the existing
  parse-and-save pipeline (no new code path — just reuse import)
- User's library now grows from both share-extension AND in-app
  search-save
- **Time: 2-3 days eng**

### Phase R5 — Expand corpus to 50 publishers + monitoring

- Add publishers in batches of 10, monitoring takedown rate
- Build the publisher-relations playbook for the day a publisher
  asks for removal
- **Time: ongoing, ~1 day per publisher batch**

### Phase R6 — Differentiation polish

- Macro verification badge on every search-result card ("Macros: Suppr-verified")
- Compare across publishers ("Same recipe, 3 sources" deduplication)
- "Similar recipes you might prefer" — uses the our own personalisation, not publisher's
- **Time: 1-2 weeks eng**

## What this doc explicitly does NOT do

- **Does not** advocate scraping paywalled content
- **Does not** hotlink publisher photography
- **Does not** reproduce protected expression (headnotes, stories)
- **Does not** treat fair use / fair dealing as a primary defence — we operate on (a) facts not protected, (b) user-as-actor for saves, (c) attribution + link-out
- **Does not** require any publisher licensing agreement — but we'd happily accept one if a publisher offers
- **Does not** conflict with the design direction v1 plan — runs parallel, references the V9 photography commission for our hero recipes

## Decisions Grace owns

1. **Approve the architecture** as described — three-layer (index facts / preview only / user-saves-and-imports) with explicit no-hotlink rule.
2. **Approve Phase R0** — legal sign-off + crawl-policy publication. Brief Grace's IP lawyer (possibly the same one handling Cayman incorporation per `project_incorporation_sequencing.md`).
3. **Approve initial publisher allowlist** — start with 10, ramp to 50. First 10 candidates: BBC Good Food, Serious Eats, NYT Cooking (free recipes only), Bon Appétit, Food Network, Eatingwell, Half Baked Harvest, Smitten Kitchen, Recipe Tin Eats, Delicious. Grace's final call.
4. **Approve placeholder strategy** for non-hero recipes in search results — neutral ceramic-bowl illustration OR per-cuisine generic OR AI-generated. Recommend: per-cuisine generic from a stylist commission paired with the V9 photography work.
5. **Approve "Follow author" data model scope** — schema.org `recipeAuthor` only (cheap) OR manually maintained mapping for known authors (expensive but better). Recommend: schema.org-only for v1, manual mapping if user demand surfaces.

## Sources cited

- [Deglaze — All Your Recipes in One Place](https://www.deglaze.app/)
- [Deglaze — Terms of Service](https://www.deglaze.app/terms)
- [Deglaze: Cooking, Simplified — App Store](https://apps.apple.com/us/app/deglaze-cooking-simplified/id6443578246)
- [Deglaze vs. Recime (Deglaze blog)](https://www.deglaze.app/blog/deglaze-vs-recime)
- [Copyright Alliance — Are Recipes and Cookbooks Protected by Copyright](https://copyrightalliance.org/are-recipes-cookbooks-protected-by-copyright/)
- [Copyrightlaws.com — Copyright Protection in Recipes](https://www.copyrightlaws.com/copyright-protection-recipes/)
- [recipe-scrapers Python library](https://github.com/hhursev/recipe-scrapers) — reference for schema.org/Recipe parsing
- [Schema.org Recipe spec](https://schema.org/Recipe)
- [Google Recipe Schema Markup docs](https://developers.google.com/search/docs/appearance/structured-data/recipe) — proof publishers expect their JSON-LD to be indexed
- Repo memory: `next.config.ts` (BBC Good Food hotlink removal rationale), `reference_csv_import_adapter_framework.md`, `project_recipe_go_public_web_only.md`, `project_incorporation_sequencing.md`

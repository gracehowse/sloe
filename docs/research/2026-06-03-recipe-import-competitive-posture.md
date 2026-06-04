# How recipe-import apps "get around" importing recipes — competitive interrogation (2026-06-03)

Sourced interrogation of ~17 apps (4 parallel research agents). Question: how does each legally + technically justify importing recipes from other sites/apps? Goal: benchmark Suppr's posture (we import **facts only**, **block creator photos**, keep a **source link**).

## The 5 legal models in play

1. **Recipes-as-facts (the foundation — every importer).** Ingredient lists + functional steps aren't copyrightable (US Copyright Office Circular 33; 37 CFR §202.1; *Publications Int'l v. Meredith*, 7th Cir. 1996). Importers extract the *unprotected* layer. **Danger zone = the creative method prose + the photo** (those ARE copyrightable).
2. **User-as-actor / personal copy.** "You're making a personal copy — like pasting into Notes or printing for a home cookbook; we don't use bots; private by default; no sharing." **ReciMe** is the gold standard (explicit article). Indie apps achieve it structurally.
3. **Disclaimer + attribution + link-back.** Don't store the method — link to the source to credit the creator. **Julienne** (disclaimer footer), **MyFitnessPal** (auto source link + offloads instructions), and most strikingly **Samsung Food** + **Plan to Eat** *gate the directions* behind a forced visit to the origin.
4. **Architecture-as-defence (indie/local-first).** On-device parsing + data stored in the user's *own* iCloud the vendor can't access → user is the actor, vendor is just a tool. **Paprika, Mela, Crouton, Pestle.** Pestle is loudest (on-device ML, explicitly rejected OpenAI on privacy).
5. **Licensing (Samsung Food only).** Actually *licenses/partners* for head content (publisher deals; Creator Fund paying $0.15/recipe view, $0.50/"Made It") and uses link-back for the long tail. The only app that pays creators.

## Comparison

| App | Legal model | Method/instructions | Creator photo | Link-back | Bots |
|---|---|---|---|---|---|
| **ReciMe** | User-as-actor (explicit) + private-by-default + no-sharing | copies (caption→audio→find source) | unknown | unknown | **claims none / no bulk** |
| **Julienne** | Disclaimer + attribution + link-back | copies facts | **generates** (replaces photo) | yes + disclaimer | unknown |
| **Honeydew** | Generic SaaS "you warrant rights" | copies (AI extract) | unknown | unknown | unknown |
| **Flavorish** | "public posts"; no theory | **AI-generates recipe from dish name+hashtags** ⚠ | unknown | unknown | unknown |
| **Saffron** (Ben Awad)¹ | Manual/concierge bulk; thin | copies (single-URL parse) | unknown | unknown | bulk = manual, not scrape |
| **Paprika** | Personal-use licence; DMCA agent | copies | **downloads + stores photo** ⚠ | stores source URL | user-initiated (extension/bookmarklet) |
| **Mela** | Local-first / no-data-collection | copies | **saves source image** ⚠ | yes (source link) | on-device implied |
| **Crouton** | Local-first (iCloud, vendor no access) | copies | unknown | unknown | user-initiated |
| **Pestle** | On-device ML (rejected OpenAI) | copies from caption | unknown | link on fallback only | **on-device** |
| **Samsung Food** | Link-back to credit + ToS + AUP + **licensing** | **links out (doesn't store full method)** | unknown | **yes, enforced** | user-initiated; partners contracted |
| **AnyList** | schema.org "publishers expose it for Google"; thin ToS | **copies full incl. instructions** | **fetches/copies photo** ⚠ | weak (no gate) | user-initiated (extension) |
| **Plan to Eat** | Link-back to credit (**gates directions**) | **locks method until you visit source** | unknown | **yes, enforced** | user-initiated (clipper) |
| **RecipeKeeper** | Local-first/private; thinnest | copies | unknown | weak | in-app fetch |
| **MyFitnessPal** | User-warranty+indemnity (ToS); link-back | **links out for instructions** | **none (facts only)** | **yes, auto** | reads page; protects own site from scraping |
| **MacroFactor** | User-warranty+indemnity; structured-data-first | copies steps | **none (facts only)** | optional/manual | schema.org-first + AI fallback ⚠ |
| **Cronometer** | User-warranty (recipes named in ToS) | copies steps | **none (facts only)** | **none found** | reads page; paid feature |
| **Cal AI** | N/A — **no recipe import** (photo meal scanner) | — | — | — | — |
| **Suppr (us)** | facts-only + block photo + source link | facts (we also capture description ⚠) | **blocked in code** ✅ | stored, not surfaced ⚠ | "honest bot UA" |

¹ Agent corrected a misattribution: Saffron is by **Ben Awad / Awad Development**, not Aaron Patzer/Mysa (Mysa = a thermostat company; Patzer has no recipe app). Confirm if a different app was meant.

## Image handling = the litigation-likely vector
Photos are *unambiguously* copyrightable (unlike ingredient lists), so this is where exposure is highest — and it's the universal blind spot:
- **Store the creator's photo** (riskiest): Paprika (base64-embeds it), Mela, AnyList.
- **No photo / facts only** (safest): MyFitnessPal, MacroFactor, Cronometer.
- **Generate a substitute**: Julienne (the copyright workaround = why their image-gen exists).
- **Suppr blocks it in code** → at/above the safest actor in the field. **This is a genuine differentiator, not parity.**

## Riskiest practices observed
1. **Cronometer's "save as your *own* recipe / magic wand" marketing** — invites the misappropriation its own ToS disclaims. (framing risk, cheap to avoid)
2. **Copying the method prose verbatim** (Cronometer, MacroFactor, AnyList) — the method can carry "substantial literary expression" (*Meredith*). MFP avoids it by linking out.
3. **AI-inventing a recipe** from dish name + hashtags (Flavorish) or arbitrary page text (MacroFactor AI fallback) — accuracy + IP risk; opposite of our "don't guess" rule.
4. **Storing the creator's photo** (Paprika, Mela, AnyList).

## Where Suppr sits + recommended posture (best-of-the-field)
We're already at/ahead of the safest actor (MFP) on photo + facts-only. To reach the strongest defensible posture, combine the best of each model:
- **Extract facts, prefer schema.org/JSON-LD** (MacroFactor's lowest-risk path); AI free-parse only as a labelled fallback.
- **Never reproduce the creative method prose verbatim** — structure/paraphrase it, or link out (MFP). **GAP: we currently capture the creator's `description`/caption** — stop reproducing it verbatim.
- **Block the photo (done) or generate a labelled substitute** (Julienne).
- **Mandatory, visible link-back + creator credit + a short disclaimer** (Samsung Food/Julienne). **GAP: we store `source_url` but don't surface it.**
- **User-as-actor + private-by-default framing** (ReciMe). Borrow the "personal copy, no bots" wording; reconsider our "honest bot UA".
- **Never "your own recipe" framing** (Cronometer's mistake).
- **Register the DMCA agent** (open P0; Samsung Food + Paprika both have one).
- **(Longer term)** Samsung Food's licensing/Creator-Fund + the creator claim/merge model = how the import model reconciles with first-party creators.

## Caveats
- Saffron misattribution (above). Several Samsung Food / Plan to Eat / MacroFactor / MFP pages 403'd to automated fetch — image-rehosting specifics for ~half the field are genuinely undocumented (marked "unknown", not guessed). Crouton's social-platform support is press-asserted, not first-party.

## Julienne in-app inspo (Grace's screenshots, 2026-06-03)

Walked the full Julienne flow (IG import → recipe detail → ingredients → cook steps → meals → paywall → import-loading).

**VALIDATES our just-made decisions (external proof we're right):**
- **Legal-safe import, exactly as our legal review prescribed.** Recipe detail shows **"by @Emily English · See Original Link"** + a **"Watch"** button to the source video (prominent creator credit + link-back = our gap #2). And critically: the **description is a NEUTRAL AI summary** ("A delicious and healthy toastie packed with creamy avocado…"), **NOT** the creator's verbatim IG caption ("The veggie toastie I cannot stop eating…"). The **steps are restructured + granularised + given their own "Tip:" callouts**, not copied verbatim. → This is precisely legal P1-1 (don't reproduce the creator's prose; generate a neutral description + structure the steps) + gap-2 (surface credit + link-back). **Julienne already does the thing we just decided to do — copy this pattern.**
- **Image-gen everywhere, one consistent style.** AI ingredient tiles (marble/white, stylised-photoreal — our exact DS rule), the **import-loading hero** (a generated green Dutch oven on a flame), and the paywall **"Over 1,000 trending recipes" food-bowl grid** (top-down bowls on cream) are all generated. Validates our engine + locked-template + that gen also serves **loading + marketing/library heroes**, not just recipe cards.

**ADOPT (strong patterns; ★ = new to our designs):**
- ★ **Cook mode "Cooking Steps":** big serif numerals (01/02/03) + **per-step ingredient chips** (the exact quantities used in that step) + **AI "Tip:" callouts** per step. Excellent cook-mode pattern — fold into our D6 cook frame.
- ★ **Import-loading state:** generated cookware hero + honest **"This could take 15–30 seconds"** expectation-setting + progress bar + **Cancel**. Calm + premium. Adopt for our import flow.
- ★ **Est. Cost per recipe** (on the ingredients screen, alongside macros + Fibre %DV) + **"Get recipe ingredients"** (Instacart-style buy) beside **Add all to grocery list**.
- **Recipe detail Details card** (Skill Level / Cook Time / Servings) + action row (Saved / Ask / Edit / Watch).
- **Cookbook** = Recipes / Shopping List tabs + **Collections** ("+ Add collection") + a "Try Pro" pill; recipe cards show cook-time + ⋮.
- **Meals planner** = Today / 7 Days / This Month + **Generate** (AI plan); calm dashed "Choose a recipe" empty rows.

**BE SELECTIVE / AVOID:**
- The **30+ auto-tag cloud** on the recipe is excessive — great for search indexing, cluttered as UI. Generate tags for search; don't dump them all on screen.
- **Reliability:** their App Store reviews complain of **crashes + lost saves on import**; Grace's Discover "What others are saving" first rendered as **empty skeletons** but a **reload fixed it** (transient load failure, NOT a broken/removed feature — they're not winding down). When loaded it's strong: a **2-col card grid of AI food images + title + cook-time + bookmark-to-save**, with category tabs (All / Breakfast / Lunch / Dinner / Dessert / Vegetarian). Lesson for us: handle load failure gracefully (skeleton → retry/empty, never an indefinite skeleton). Their public "what others saved" + Shared Collections IS the imported-content-republished surface our two-plane model handles differently.

## Julienne release-cadence read (App Store Version History, 2026-06-03)
Mature + actively shipping (~10+ months of frequent releases; latest **2mo ago**) → definitively **not winding down**. Their evolution = a validated build-order for a recipe-import app:
- **1.3.0** (~9mo) enhanced IG/TikTok import + Chat UX → **1.3.5** "**Business model updates**" (monetisation) → **1.3.12** (~5mo) "Pork as a dietary preference to avoid" + longer video limit → **1.3.13** (~5mo) "**Recipe image generation! No more default images**" → **1.3.15** (~4mo) **Search on Discover + Browse & buy cookbooks** (affiliate) → **1.3.18** (~4mo) "**Shared Collections!**" → **1.3.19–1.3.22** (~2–3mo) mostly bug-fixes + "improvements to recipe generation".
**Reads for us:** (1) **image-gen is RECENT for them (~5mo), not deeply entrenched** — we can match/exceed, not catch up to a moat. (2) Their last ~3 months are **dominated by "Bug fixes & Improvements"** and reviews cite crashes/lost-saves → **reliability/correctness is their soft spot = our wedge** (and our nutrition-correctness rules go further). (3) Shared Collections + "what others are saving" = their **social/discovery layer** (the public-republishing surface). (4) "**Pork as a dietary preference**" signals halal/dietary-nuance demand — a cheap inclusive-preference win. (5) They iterate monetisation (ads + Pro + cookbook **affiliate**) — three revenue lines, not just subscription.

## Sources
Per-app first-party sources captured in the research agents' findings (ReciMe copyright article, Samsung Food terms/copyright, Plan to Eat help, AnyList help, Paprika terms, Pestle/TechCrunch, MFP/MacroFactor/Cronometer help+ToS, US Copyright Office Circular 33, *Publications Int'l v. Meredith*). Julienne in-app inspo from Grace's 2026-06-03 screenshots.

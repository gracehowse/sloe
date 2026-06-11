# Logging-surface competitive teardown — tabs, quick-log, modalities, gap matrix

**Date:** 2026-06-11
**Trigger:** Grace screenshotted MFP's log search (History / My Meals / My Recipes / My
Foods tabs; past-logged matches above database results; per-row one-tap `+`; meal-slot
picker in the header) and asked how competitors handle the log section ("my meals, my
recipes etc") and what Suppr is missing.
**Scope:** the LOG-ENTRY surface only — tab/section structure, quick-log affordances,
creation flows, search behaviours, input modalities, standout details. Not the
diary/Today layout, not goal-setting.
**No code changes.** Research doc + gap matrix + ranked opportunity list.

**Out of scope by prior decision:** history-first search re-ranking (personal matches
above database results) is already decided and in flight on a separate branch — it is
listed in the matrix as IN FLIGHT, not researched further here.

---

## 1. Method + receipts

- **Suppr column is code-grounded, not guessed.** Files read/verified for this
  teardown: `apps/mobile/components/today/LogSheet.tsx`,
  `apps/mobile/components/food-search/FoodSearchPanel.tsx`,
  `apps/mobile/components/QuickAddPanel.tsx`,
  `apps/mobile/components/CreateCustomFoodSheet.tsx`,
  `apps/mobile/components/SaveMealSheet.tsx`,
  `apps/mobile/components/CopyMealSheet.tsx`,
  `apps/mobile/components/DuplicateDaySheet.tsx`,
  `apps/mobile/components/VoiceLogSheet.tsx`,
  `apps/mobile/components/PhotoLogSheet.tsx`,
  `apps/mobile/components/BarcodeScannerModal.tsx`,
  `apps/mobile/components/today/TodayQuickLogStrip.tsx`,
  `apps/mobile/components/today/TodayAddFoodForm.tsx`,
  `apps/mobile/components/today/TodayEatAgainScroller.tsx`,
  `src/lib/nutrition/favoriteFoods.ts`, `src/lib/nutrition/siriDeepLinks.ts`, plus
  the web mirrors under `src/app/components/suppr/` (log-sheet, quick-add-panel,
  saved-meals-tab, create-custom-food-dialog, copy-meal-dialog, duplicate-day-dialog,
  voice-log-dialog, photo-log-dialog, today-barcode-dialog — all confirmed present).
- **Competitor claims carry receipts:** Mobbin screen URLs where the app has Mobbin
  coverage (MFP, Cal AI, Yazio, Lifesum — every URL below returned from live Mobbin
  searches this session and read as pixels), official help-centre/feature pages and
  reviews where not (Lose It!, Cronometer, MacroFactor, Foodnoms). Contested claims
  are flagged inline.
- **Notable corrections this pass** (vs received wisdom / the first draft):
  MFP's 2022 barcode paywall has since been REVERSED — single-item barcode scan is
  free again as of 2026, and the May 2026 paywall expansion gates Meal Scan,
  **recipe-URL import**, and macro-by-meal instead; Yazio DOES have an Apple Watch
  app; Lifesum DOES have a multi-add basket; Cronometer has multi-add + voice +
  photo (Gold); Cal AI has a nutrition-label scan mode.

---

## 2. Suppr today — honest inventory (code-grounded)

### 2.1 Entry points
- **FAB** (`LogFab.tsx`) opens the LogSheet.
- **TodayQuickLogStrip** — 4 chips under the hero: Search / Voice / Snap / Scan
  (Voice + Snap Pro-gated; lucide icons per §1.5 spec).
- **Eat-again banner/scroller** (`TodayEatAgainBanner` / `TodayEatAgainScroller`) —
  slot-aware "eat again" candidates from food history, horizontal pager, one-tap
  "Log it".
- **QuickAddPanel** on the Today meals section — see 2.3.

### 2.2 LogSheet (`apps/mobile/components/today/LogSheet.tsx`, web mirror `src/app/components/suppr/log-sheet.tsx`)
- **Meal-slot selector** (ENG-773): 4-segment pills (Breakfast/Lunch/Dinner/Snacks),
  visible + tappable on the sheet itself.
- **Inline search-first**: real `TextInput` with `autoFocus`; results render inline
  via `FoodSearchPanel` (no nested modal).
- **Browse tabs** (empty-query state): **Recent / Library / Saved meals**.
  - Recent = recent meals via `computeRecentMeals`, one-tap log per `BrowseRow`.
  - Library = saved recipes surfaced inline so one-tap logging no longer routes
    through Recipes → Library → Detail (TestFlight `AECfotBlQgwfgxYHr4dDaM8`).
  - Saved meals = saved combos; one-tap log, or portion editor behind
    `today-edit-entry-v2` (ENG-783).
- **Copy yesterday** row (ENG-709).
- **"Or add manually →"** footer → manual quick-add (title + kcal + macros + slot,
  `TodayAddFoodForm`).
- **Logged confirmation (S13)** with Done + quiet **Undo**.
- **Barcode manual-entry recovery** (`LogSheetBarcodeManualEntry`) when a scan
  resolves to an unusable product.
- **Single-item commit loop:** every pick commits immediately and the sheet resets
  (`setQuery("")` on pick) — there is no staging basket on any manual path.

### 2.3 QuickAddPanel (`apps/mobile/components/QuickAddPanel.tsx`, web `quick-add-panel.tsx`)
A SECOND quick-log surface on the Today meals section, with a DIFFERENT tab set:
**My meals (saved) / Frequent / Favourites / Recent**.
- Frequent = frequency-ranked (`computeFrequentMeals`).
- Favourites = a real Supabase model (`public.user_favorite_foods`,
  `favoriteFoods.ts`: list/add/remove/isFavorite, optimistic star/unstar) shared
  web+mobile.
- Saved meals get rename / delete / log-count increment.
- Default tab resolved by the shared usual-meal heuristic
  (`resolveQuickAddDefaultTab`, parity with web).

### 2.4 FoodSearchPanel (`apps/mobile/components/food-search/FoodSearchPanel.tsx`)
- Unified debounced search over FatSecret (Premier branded) + USDA + OFF + Edamam +
  user custom foods.
- **Category filter chips: All / Recents / Custom / Branded / Generic.**
  **A Favourites tab was REMOVED** (ENG-748 #8) as a dead affordance — the
  favourites model exists (2.3) but no per-row favourite shape reaches search rows.
- **Confidence chips** per row (`SearchResultConfidenceChip`: Verified / Estimated)
  plus source provenance and FatSecret attribution.
- Premier autocomplete typeahead (2026-04-26).
- Portion preview with **fit-this-in projection** (`projectRemaining` vs daily
  targets) — forward-looking "will this fit" feedback at log time.
- **Barcode-fallback hint** on no-results ("Brand not found? Try a barcode scan").
- Create-custom-food entry point inline.

### 2.5 Creation flows
- **CreateCustomFoodSheet**: name + brand; natural serving + servings-per-container;
  macros **per 100 g OR per serving** (basis persisted, F-156); collapsed
  detailed-nutrition disclosure (**sugar / sat fat / sodium only**); barcode TEXT
  field (no scanner hookup — scan-not-found prefills it, F-156 PR-2); density-aware
  volume→grams conversion from a sourced density table (ENG-748 #15).
- **SaveMealSheet**: meal-as-unit from selected items — name, default slot,
  reorderable/removable item list (= "create meal from selection").
- **Recipe builder** lives in the Recipes tab (import-first: URL/Reel via
  `expo-share-intent`, photo, manual) — no creation entry point inside the LogSheet;
  the Library tab only consumes recipes.

### 2.6 Repeat-day plumbing
- **CopyMealSheet**: date picker + "Next 2 / 3 / 7 days" quick chips (verified
  `QUICK_RANGES`).
- **DuplicateDaySheet**: whole-day duplicate.
- **Copy-yesterday** row in LogSheet.

### 2.7 Input modalities
- **Barcode** (free): camera scan, lookup, per-barcode **portion memory**
  (audit/2026-04-30), **physical-plausibility guard** with user override (P0
  2026-05-26), data-correction submission (`submitFoodCorrection`), manual-entry
  recovery.
- **Voice** (Pro): native STT with **typed fallback**, multi-item review with
  per-item confidence + inline macro edit, "Log all" commit.
- **Photo** (Pro + free taster): `FREE_PHOTO_LOG_WEEKLY_LIMIT = 5` free logs per
  rolling 7-day window; itemised breakdown with per-item kcal **ranges** (range-first
  decision 2026-05-01), add-on chips ("Add Glass of red wine: +120–150 kcal"), plate
  total range.
- **Siri / Shortcuts**: deep links for **water, start-fast, today-remaining only**
  (`siriDeepLinks.ts` `SiriAction` union) — **no food-logging intent**.
- **Share extension**: recipe import (the Reel-import wedge) — not a food-log path.
- **No Apple Watch target, no WidgetKit target** (verified: `apps/mobile/ios`
  contains only `Suppr` + `ShareExtension`), no Spotlight integration.

### 2.8 Cross-platform
Web mirrors confirmed for every surface above; pure logic shared via
`src/lib/nutrition/*`.

**The honest headline:** Suppr's logging surface is feature-dense — slot pills,
inline search, three browse tabs, copy-yesterday, confirmation+undo, and a full
modality row are competitive or better. The weaknesses are (a) **fragmentation** —
LogSheet (Recent/Library/Saved) vs QuickAddPanel (My meals/Frequent/Favourites/
Recent) vs search chips (All/Recents/Custom/Branded/Generic): three tab systems, no
single "my food" model; (b) **favourites missing from the place people search**
(model exists, search tab removed as dead); (c) **single-item commit loop** (no
basket — now a 5-of-8-competitor table-stake); (d) **zero OS-surface presence**
(watch / widgets / Siri-food / Spotlight) against an audience defined as "MFP
refugees with watches".

---

## 3. Competitor teardowns

### 3.1 MyFitnessPal — the structure Grace screenshotted
Receipts (all verified on Mobbin this session):
[4-tab search + slot header](https://mobbin.com/screens/3135a437-d710-4bc8-98d1-107806af2555),
[My Meals tab](https://mobbin.com/screens/387f9cb9-24ae-4649-adfd-56375618d3d1),
[My Recipes tab](https://mobbin.com/screens/681c28c7-bb72-4a55-a31e-a9371fbac045),
[History + quick chips](https://mobbin.com/screens/f650a029-33d6-440a-897c-281947a95c51),
[dark log w/ Voice log + Meal scan chips + Suggestions](https://mobbin.com/screens/e37360ae-3585-4698-b1ef-dc295be77024),
[Best Matches + "Only" filter](https://mobbin.com/screens/a6e3cdf5-65dd-4242-b7a9-c4163ed0439f),
[Add Food detail w/ multi-day](https://mobbin.com/screens/f27a36dd-ce06-4f3a-bdf2-d880ce881822),
[frequently-paired foods](https://mobbin.com/screens/19f94997-344e-4ee1-aa44-d5d557d0f5f4),
[paywall changes May 2026](https://thenutritionmagazine.com/articles/myfitnesspal-paywall-changes-explained/),
[2022 barcode-paywall episode](https://www.xda-developers.com/myfitnesspals-barcode-scanner-behind-a-paywall/).

1. **Tabs:** `All / My Meals / My Recipes / My Foods` directly under the search bar.
   Meal-slot picker in the HEADER — "Select a Meal ▾" until chosen, then
   "Breakfast ▾". My Meals tab carries **Create a Meal + Copy Previous Meal** chips
   and a sortable list (Date Created / Most Recent); My Recipes carries **Create /
   Discover / Import**.
2. **Quick-log:** empty-query state = quick chips (Barcode scan / Voice log / Meal
   scan / Quick add), then a sortable **History** section with per-row `+`, then
   **Suggestions** (verified staples). Per-row `+` everywhere; "Best Matches" group
   on search.
3. **Creation:** create flows per tab; Add Food detail offers **"Add to Multiple
   Days"** (a 7-day row at log time), a **Time** field, % of Daily Goals, full
   Nutrition Facts, "Is this information incorrect? Report Food", and on barcode
   matches a "matched to… **Find a better match**" banner.
4. **Search:** verified green checks; **"Only"** toggle to filter to verified-only;
   Best Matches vs More Results grouping.
5. **Modalities:** barcode went Premium in 2022, was later made free again —
   **as of May 2026 single-item barcode scan is FREE**; the current paywall gates
   **Meal Scan (photo), recipe-URL import, and macro-by-meal goals** ($19.99/mo,
   $79.99/yr). Voice Log chip present on the log surface. Watch app exists
   (quick-add-grade; not a full food logger).
6. **Standout details:** **"Add Frequently Paired Foods"** — co-occurrence
   suggestions (logged eggs → offers boiled eggs, salmon skin) inside Add Food; the
   empty-recipes copy ("Mom's Meatloaf Isn't In The Database (Yet)").
   The data moat + habit loops are uncopyable; the IA is.

### 3.2 Lose It!
Receipts: [Amy Food Journal review](https://www.amyfoodjournal.com/blog/lose-it-app-review),
[2026 pricing breakdown](https://nutriscan.app/blog/posts/lose-it-pricing-2026-free-vs-premium-2b4e921555),
[App Store](https://apps.apple.com/us/app/lose-it-calorie-counter/id297368629).

1. **Tabs:** search-first add-food; My Foods library (foods/meals/recipes).
2. **Quick-log:** classic select → serving → confirm loop (45–90 s/meal per
   review); saved meals + recipes for re-log.
3. **Creation:** custom foods, meals, recipes.
4. **Search:** 27M-item database; barcode pulls the entry with serving pre-filled.
5. **Modalities — contested between sources:** the older review says barcode is
   free everywhere, voice "does not exist", no standalone watch app. The 2026
   pricing post says **barcode is moving behind Premium for NEW free accounts**
   (legacy users keep it) and **"Say It" voice logging now exists in Premium**,
   alongside Snap It photo (Premium, ~70% category accuracy, weak portions).
   Treat as: barcode transitioning to Premium, voice Premium-recent, watch minimal.
6. **Standout:** historically the "free barcode" acquisition wedge vs MFP — now
   eroding from both sides (MFP re-freed theirs; Lose It! is gating).

### 3.3 Cal AI
Receipts (all verified on Mobbin this session):
[Describe field + Manual Add/Voice Log chips](https://mobbin.com/screens/e5e9de27-da21-4cea-8382-9675119dcd54),
["Generate results using AI"](https://mobbin.com/screens/938ce500-4796-42c3-9251-f8c3f7fb27c2),
[undo toast](https://mobbin.com/screens/e08f3690-a700-4036-916c-b22b7014e527),
[Log Food tabs](https://mobbin.com/screens/c5623d63-8b45-4cbc-98cd-f70b61d5c4a0),
[My meals](https://mobbin.com/screens/aec0386a-24d6-4997-96a3-525d4a1baeef),
[Saved foods bookmark](https://mobbin.com/screens/8f87eac0-3516-48a1-9b27-360b73f62aa0),
[camera modes incl. Food label](https://mobbin.com/screens/2d599f7d-4472-4df2-8b84-f128876b4751),
[label capture → Tap to Name](https://mobbin.com/screens/2db7609c-6b5f-4a75-8813-4045e4300775),
[result feedback loop](https://mobbin.com/screens/ac4da5ae-acfd-4c04-8038-4eca3bf980d9).

1. **Tabs:** `All / My foods / My meals / Saved foods` on Log Food. My meals =
   "Quickly log your go-to meal combinations"; Saved foods = bookmark any logged
   food.
2. **Quick-log:** Suggestions with per-row `+`; adding fires a non-blocking
   **"✓ Ingredient added — View | Undo"** toast and keeps you in the list — a
   lightweight basket (keep tapping, review at the end).
3. **Creation:** Add Food manual form runs kcal → sat fat and onward; meal
   combinations; label scan creates entries ("Tap to Name").
4. **Search:** the input is literally **"Describe what you ate"** — DB results
   appear as you type with a **"✦ Generate results using AI"** escape hatch for NL
   descriptions; barcode icon in the header.
5. **Modalities:** camera-first product — capture screen toggles **Scan Food /
   Barcode / Food label / Library(photos)**; Manual Add + Voice Log chips ride
   under the describe field; home-screen widget (calories/macros-left) per first
   draft's Mobbin pull.
6. **Standout:** the describe-field framing; **"How did Cal AI do?" 👍/👎 + "Fix
   Issue"** feedback loop on every AI result; widget as the re-engagement hook for
   the exact TikTok cohort Suppr's July push targets.

### 3.4 Lifesum
Receipts (all verified on Mobbin this session):
[favourites tab grouped FOOD/MEALS/RECIPES + Done](https://mobbin.com/screens/60a9bba8-a674-44d2-b0e8-f40e7e15fca1),
[tracked-basket tab](https://mobbin.com/screens/9cb979e3-bd48-4fdb-8532-bbf340804733),
["Same as yesterday?"](https://mobbin.com/screens/265a1509-d17d-49e1-9b41-b562385eda60),
[Recent + intake bar](https://mobbin.com/screens/7d38a460-aab1-4fc7-a704-2402c7644c23),
[in-sheet create menu](https://mobbin.com/screens/62f949cd-3046-4d7e-8b76-5dc326c99968),
[search w/ verified checks](https://mobbin.com/screens/4cdfd989-12f9-43f7-a52d-e78db4fca0a7),
[multimodal AI press, Feb 2025](https://lifesum.com/page/lifesum-transforms-meal-tracking-with-world-first-ai-powered-multimodal-tracker).

1. **Tabs:** meal-scoped sheet ("Breakfast") with THREE icon tabs: **Recent (clock)
   / Favourites (heart) / Tracked (list + count badge)**. Favourites groups
   **FOOD / MEALS / RECIPES** sections with per-section Add.
2. **Quick-log:** per-row `+` with verified blue check + default-serving subtitle
   ("1 Medium serving (230 g)"); **a real basket** — the Tracked tab stages items
   with a counter badge, ✕-to-remove, and a green **DONE** commit; plus a
   **"SAME AS YESTERDAY?"** one-tap suggestion above Recent for the same slot.
3. **Creation:** header ⋯ menu right on the log sheet: **Quick track / Create food
   / Create meal / Create recipe**.
4. **Search:** verified badges; serving-forward rows; barcode icon in the search
   bar.
5. **Modalities:** "world-first multimodal tracker" (Feb 2025): **photo, voice,
   text, barcode — Premium feature**.
6. **Standout:** a **daily-intake bar (433/2219 kcal + per-macro remaining) pinned
   at the top of the log surface** — goal context while picking; per-food "Food
   Rating" chips. Coaching-toned, matches Suppr's warm direction more than MFP.

### 3.5 Yazio
Receipts (all verified on Mobbin this session):
[basket + tabs + category cards + AI-camera/Search toggle](https://mobbin.com/screens/3542227b-4c4f-4d15-aac4-3989a73ca531),
[Create Recipe reuses the same picker](https://mobbin.com/screens/14c8bf53-163a-4cb0-b349-55aea8bc19f3),
[meal-as-unit with item checkboxes](https://mobbin.com/screens/90c55b4c-ad71-49e9-a6c7-51f4045a4c51),
[verified facts + Food Rating](https://mobbin.com/screens/81c25c63-909a-4e9f-80ba-eb79938fd6b6),
[Apple Watch help-centre section](https://help.yazio.com/hc/en-us/sections/360000112749-Apple-Watch-iOS).

1. **Tabs:** meal-scoped screen ("Breakfast" header); category cards
   **Foods / Meals / Recipes** (emoji); segmented **Frequent / Recent / Favorites**.
2. **Quick-log:** **the basket** — per-row `+` increments a counter badge
   (top-left), one blue **Done** commits everything. Past meals re-log as a UNIT
   with per-item checkboxes (untick the broccoli you skipped).
3. **Creation:** Create Recipe reuses the exact same Frequent/Recent/Favorites
   picker — one muscle memory for logging and building. "Your food has been
   created!" confirms inline and offers immediate Add.
4. **Search:** prompt copy "What did you have for breakfast?"; barcode icon inline
   in the field; "Verified nutrition facts" + "Recently logged" markers and **Food
   Rating chips** (Low in calories / fat / carbs) on detail.
5. **Modalities:** bottom toggle **AI camera / Search**; **an Apple Watch app
   exists** (installable from the watch App Store; help centre: use Yazio directly
   on the watch) — correcting the common "Yazio has no watch app" claim.
6. **Standout:** the basket + meal-scoped framing makes an n-item meal feel like
   one action.

### 3.6 Cronometer
Receipts: [search update blog](https://cronometer.com/blog/food-search-updated/),
[10 ways to log faster](https://cronometer.com/blog/log-food-fast/),
[App Store](https://apps.apple.com/us/app/cronometer-calorie-counter/id1145935738).

1. **Tabs/filters:** category filters **All / Favorites / Common Foods /
   Supplements / Brands / Restaurants / Custom**; sort by **A–Z / Most Recent /
   Most Frequent**.
2. **Quick-log:** **Multi-Add** ("select multiple foods at once before adding") —
   a basket; copy/paste of entries, whole days, or diary groups; Repeat Items
   scheduling (Gold); swipe-right to quick-add saved items; long-press app icon
   quick actions.
3. **Creation:** custom foods with FULL micronutrient depth (the product identity);
   custom meals.
4. **Search:** **per-source provenance letters** (USDA / NCCDB / CRDB / Custom) on
   every row; "82 listed nutrients" counts on detail; AI cross-referencing
   auto-backfills missing micros on branded foods (magic-wand icon).
5. **Modalities:** barcode free; **Photo logging (Gold)**; **Voice logging (Gold)**;
   Apple Watch presence (integration-grade).
6. **Standout/uncopyable:** lab-grade data trust. Suppr should NOT chase
   84-nutrient parity (conformity trap) — but source-letters + nutrient-count
   transparency maps cleanly onto Suppr's existing confidence chips + provenance
   dots.

### 3.7 MacroFactor — the strongest logging UX in the set
Receipts: [How to log food](https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor)
(fetched + verified this session), [Apple Watch page](https://macrofactor.com/apple-watch/).

1. **Methods:** unified ribbon of five — **Scan (barcode + label) / Search / Quick
   Add / Library / Describe**. Library = custom foods, recipes, favourites.
2. **Quick-log:** pre-typing screen auto-loads **Favorites (horizontal) → Hourly
   Go-Tos (foods you log near THIS time, weighted by recency+frequency) → Latest**.
   **The Plate**: every selection offers "Add" (stage) vs "Log Foods" (commit);
   plate shows running totals, per-item quantity edit, recipe-ingredient expansion
   before commit — the full basket pattern.
3. **Creation:** custom foods, recipes, Describe-to-entry; **calendar icon on the
   plate logs to any day/time**.
4. **Search:** results grouped **From History / Custom / Common (research-grade) /
   Branded** with expandable "+X" per group — history-first as visible structure.
5. **Modalities:** barcode + **nutrition-label OCR**; AI photo; **Describe** (typed
   or spoken NL); **watchOS app (Sept 2025)**: speak-to-log with AI suggestions,
   favourites/recents/custom foods from the wrist, food editor, timeline,
   complications.
6. **Standout:** "fastest food logger" is their public obsession; **hourly go-tos
   is the single smartest low-cost idea in the set**.

### 3.8 Foodnoms — the OS-integration benchmark
Receipts: [Shortcuts revamp](https://foodnoms.com/news/revamped-shortcuts) (fetched +
verified this session), [feature site](https://foodnoms.com/),
[App Store](https://apps.apple.com/us/app/foodnoms-nutrition-tracker/id1479461686).

1. **Tabs:** clean search-first surface; quality-over-quantity verified database.
2. **Quick-log:** saved meals + favourites; "Log Favorites" and "Copy Meal From
   Yesterday" exist as one-invocation actions (via Shortcuts).
3. **Creation:** custom foods + meals; **nutrition-label scanner** ("Log foods with
   only a nutrition label or barcode").
4. **Search:** curated/verified entries.
5. **Modalities:** the differentiator — **44 Shortcuts actions across 8 categories**
   (Foodnoms / Food / Goals / Library / Log / Meal Types / Meals / Recipes), **9
   App Shortcuts** ("Open Scanner", "Quick Entry", "Log" with Food/Recipe/Meal/
   Favorite/Drink options, "Check Goal Progress", "Copy Meal From Yesterday"),
   **Spotlight integration**, Apple-Intelligence-optimised; AI photo + typed
   summary; home-screen widget; **apps on iPhone, iPad, Mac, and Apple Watch**.
   (Lock-Screen/StandBy widget claims circulate but were not verifiable from
   official pages — treat as unconfirmed.)
6. **Standout:** the entire Apple-platform surface area. This is what "iOS-first"
   means at the bar Suppr claims.

---

## 4. Gap matrix

Verdicts: **HAVE** (shipped, both platforms) / **PARTIAL** (exists but fragmented,
gated, or missing the key half) / **MISSING** / **IN FLIGHT** (decided, being
built). ✓✓ = category-defining. `~` = weak/partial. `?` = unverified. Suppr
receipts are file paths from §2.

| # | Feature | MFP | Lose It! | Cal AI | Lifesum | Yazio | Cronometer | MacroFactor | Foodnoms | **Suppr** |
|---|---------|-----|----------|--------|---------|-------|------------|-------------|----------|-----------|
| 1 | Search-first log surface, type immediately | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **HAVE** — inline autofocus input, `LogSheet.tsx` |
| 2 | Personal history ranked above DB results | ✓ History section | — | — | — | — | — | ✓ From History group | — | **IN FLIGHT** (decided; separate branch). Today: Recents chip + recent block only |
| 3 | "My food" library tabs on the log surface | ✓ 4 tabs | ✓ My Foods | ✓ 4 tabs | ✓ icon tabs + grouped sections | ✓ 3 cards + 3 tabs | ✓ filter set | ✓ Library method | ~ | **PARTIAL** — pieces exist but split across 3 tab systems (LogSheet / QuickAddPanel / search chips); no single "my food" model |
| 4 | Meal-slot picker on the log surface | ✓ header | ~ | — | ✓ meal-scoped | ✓ meal-scoped | ✓ | ✓ + timestamps | ✓ | **HAVE** — ENG-773 slot pills |
| 5 | One-tap `+` per row | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **HAVE** — `BrowseRow`, eat-again "Log it" |
| 6 | Multi-add basket (stage n, commit once) | — (slot popup) | — | ~ undo-toast flow | ✓ Tracked tab + Done | ✓ counter + Done | ✓ Multi-Add | ✓✓ the Plate | ? | **MISSING** on manual paths — every pick commits immediately; only voice/photo have "Log all". Now a 5-of-8 table-stake |
| 7 | Frequent foods (frequency-ranked) | ~ Suggestions | — | — | — | ✓ Frequent tab | ~ Most Frequent sort | ✓ go-tos | ~ | **PARTIAL** — `computeFrequentMeals` + Frequent tab in QuickAddPanel only; absent from LogSheet/search |
| 8 | Time-of-day-aware suggestions | — | — | — | ~ same-slot yesterday | — | — | ✓✓ hourly go-tos | ~ | **PARTIAL** — eat-again banner is slot-aware on Today; nothing inside the LogSheet empty state |
| 9 | Favourites / starring | — | ✓ | ✓ Saved foods | ✓ heart tab | ✓ Favorites tab | ✓ Favorites filter | ✓ | ✓ | **PARTIAL** — full model + UI in QuickAddPanel (`user_favorite_foods`); REMOVED from search as dead (ENG-748 #8); not in LogSheet tabs |
| 10 | Meal-as-unit logging (saved combos) | ✓ My Meals | ✓ | ✓ My meals | ✓ MEALS section | ✓✓ + item checkboxes | ✓ custom meals | ✓ | ✓ | **HAVE** — saved meals + default slot + portion sheet (ENG-783) |
| 11 | Create meal from selection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **HAVE** — `SaveMealSheet` (reorderable) |
| 12 | Copy meal / copy yesterday / copy day | ✓ Copy Previous Meal | ✓ | — | ✓ "Same as yesterday?" | ✓ | ✓ copy day/group | ✓ | ✓ shortcut action | **HAVE** — CopyMealSheet (+2/3/7 days), DuplicateDaySheet, copy-yesterday row |
| 13 | "Add to multiple days" at log time | ✓ 7-day row in Add Food | — | — | — | — | ~ Repeat Items (Gold) | ✓ calendar on plate | — | **PARTIAL** — possible after the fact via CopyMealSheet; not offered at the moment of logging |
| 14 | Custom food creation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **HAVE** — arguably best-in-set form (serving-label-first, dual basis, density volume→grams) |
| 15 | Custom food with full micros | ~ | ~ | ✓ to vitamins | ~ | ~ | ✓✓ identity | ✓ | ✓ | **PARTIAL** — disclosure covers sugar/sat-fat/sodium only |
| 16 | Create recipe from the log surface | ✓ My Recipes tab | ✓ | — | ✓ ⋯ menu | ✓ same picker | ✓ | ✓ Library | ✓ | **PARTIAL** — Library tab consumes recipes; creation only in Recipes tab (import-first is deliberate; no escape hatch from the sheet) |
| 17 | Verified-data badges / trust chrome | ✓ checks + "Only" filter | ~ | — | ✓ blue check | ✓ verified + Food Rating | ✓✓ source letters + nutrient counts | ✓ Common=research-grade | ✓ curated | **HAVE** — Verified/Estimated chips + provenance + attribution |
| 18 | Brand vs generic grouping/filter | ✓ | ~ | — | — | — | ✓ Brands/Restaurants filters | ✓ result groups | — | **HAVE** — Branded/Generic chips |
| 19 | Autocomplete / suggested searches | ✓ | — | ✓ as-you-type DB | — | — | — | — | — | **HAVE** — Premier typeahead |
| 20 | Barcode scan | ✓ free again (2026) | ~ going Premium for new accts | ✓ | ✓ Premium AI tier | ✓ | ✓ free | ✓ | ✓ | **HAVE free** + portion memory + plausibility guard + correction loop — the loop, not the price, is now the differentiator |
| 21 | Nutrition-label OCR scanner | — | — | ✓ Food label mode | — | — | — | ✓ | ✓ | **MISSING** — barcode-miss recovery is a typed form |
| 22 | AI photo logging | ✓ Meal Scan (Premium 5/2026) | ✓ Snap It (Premium) | ✓✓ hero | ✓ Premium | ✓ AI camera | ✓ Gold | ✓ | ✓ | **HAVE** — ranges + grouped items + addon chips + 5/wk free taster; honesty (ranges) exceeds the bar |
| 23 | Voice logging | ✓ Voice Log chip | ~ Say It (2026, contested) | ✓ | ✓ Premium | — | ✓ Gold | ✓ Describe | ~ | **HAVE** (Pro) — STT + confidence review + Log all |
| 24 | Typed NL describe (multi-item) | — | — | ✓✓ the search field itself | ✓ text (Premium) | — | — | ✓✓ Describe method | ✓ typed summary | **PARTIAL** — typed fallback exists INSIDE VoiceLogSheet; not a first-class input (hidden behind a Pro-locked mic) |
| 25 | Quick add (raw kcal/macros) | ✓ | ✓ | ✓ Manual Add | ✓ Quick track | ✓ | ✓ | ✓ ribbon method | ✓ Quick Entry | **HAVE** — "Or add manually" → TodayAddFoodForm |
| 26 | Undo / non-blocking confirm after log | — | — | ✓ toast w/ Undo | — | — | — | — | — | **HAVE** — S13 confirmation + Undo |
| 27 | Report / correct food data | ✓ Report Food + better-match banner | ~ | ✓ Fix Issue + 👍/👎 | — | — | ✓ community + AI backfill | ✓ | ✓ | **HAVE** — `submitFoodCorrection` (barcode + photo paths) |
| 28 | At-log-time goal-fit feedback | ✓ % of Daily Goals | — | — | ✓ intake bar pinned on log surface | — | — | ~ plate totals | — | **HAVE** — fit-this-in projection (`projectRemaining`); BETTER THAN BAR (forward-looking) |
| 29 | Apple Watch app (log from wrist) | ✓ quick-add grade | ~ none standalone | — | ? | ✓ app exists | ~ integration | ✓✓ speak-to-log (9/2025) | ✓ | **MISSING** — no watch target in `apps/mobile/ios` |
| 30 | Home/Lock-screen widgets | ✓ | ? | ✓ macros-left widget | ? | ✓ quick-log widgets | ~ icon quick-actions | ✓ | ✓ home widget | **MISSING** — no WidgetKit target |
| 31 | Siri / Shortcuts / Spotlight food logging | ~ | — | — | — | — | — | — | ✓✓ 44 actions + 9 App Shortcuts + Spotlight | **PARTIAL** — deep-link infra exists (`siriDeepLinks.ts`) but water/fast/remaining only; no food intent, no App Shortcuts |
| 32 | Social/share-sheet import wedge into logging | — (URL import now Premium) | — | — | — | — | — | — | — | **HAVE (uncopyable angle)** — free Reel/URL recipe import via share extension feeds the Library tab; MFP just PAYWALLED recipe-URL import (5/2026) |

---

## 5. Ranked opportunity list — FOR GRACE'S CALL

Ranking = impact for the **MFP-refugee + Watch-owner** audience × build cost. Items
1–3 are launch-blocker-grade; 4 is a launch-window stretch; 5–9 post-launch. Per the
no-silent-deferrals rule, anything accepted here needs a Linear issue that day.

### 1. Unify "my food" + put Favourites back where people search — LAUNCH-BLOCKER-GRADE
Three tab systems (LogSheet: Recent/Library/Saved · QuickAddPanel: My meals/
Frequent/Favourites/Recent · search chips: All/Recents/Custom/Branded/Generic)
fragment one mental model. MFP refugees arrive with "My Meals / My Recipes / My
Foods" muscle memory (receipt §3.1) and will read the split as "where are my
foods?". The favourites model + DB already exist (`favoriteFoods.ts`); the search
tab was removed only because no favourite shape reaches result rows (ENG-748 #8).
**Build:** plumb favourites into FoodSearchPanel rows (star on row, Favourites
filter restored) + converge LogSheet/QuickAddPanel on ONE tab vocabulary (web in
the same pass). Cost: S–M (model exists; this is wiring + IA). Impact: high —
first-session comprehension for the exact refugee cohort. *Watch-out: don't grow
the pill row past 4; consider one "My food" tab with FOOD/MEALS/RECIPES sections,
Lifesum-style (§3.4 receipt shows exactly this grouping working).*

### 2. Multi-add basket on the manual path — LAUNCH-BLOCKER-GRADE
Now a **5-of-8 table-stake** (Yazio counter+Done, Lifesum Tracked tab, Cronometer
Multi-Add, MacroFactor Plate, Cal AI undo-toast-keep-in-list — receipts
§3.3/3.4/3.5/3.6/3.7). Logging a 4-item dinner in Suppr = 4 full
search→pick→commit round-trips (LogSheet resets after every pick, §2.2). Suppr
already has commit-many machinery (voice/photo "Log all", SaveMealSheet item
lists). **Build:** "Add" stages into a slot-scoped tray with running kcal total;
"Log n items" commits; offer "Save as meal" on the way out (feeds saved-meals
adoption). Cost: M. Impact: high — THE daily-loop speed gap for anyone who cooks
(Suppr's positioning audience). MacroFactor's plate-with-running-totals is the
quality bar; Yazio's counter+Done is the acceptable floor.

### 3. First-class typed "Describe" input — LAUNCH-BLOCKER-GRADE (cheap)
The multi-item NL pipeline already exists (VoiceLogSheet typed fallback →
review-with-confidence → Log all, §2.7) but is hidden behind a Pro-locked mic. Cal
AI's search field literally says "Describe what you ate" with a "Generate results
using AI" action (§3.3 receipts); MacroFactor's Describe is a first-class method
(§3.7). **Build:** detect multi-item NL queries in the search field (or add a
"Describe it" row) and route to the existing review screen. Cost: S (UI routing
only). Impact: medium-high — converts an existing AI investment into a
discoverable default. Pricing call for Grace: typed describe could sit in the free
tier (n/week, like photo) as the hook.

### 4. Home-screen widget (ring + quick-log launchers) — LAUNCH-WINDOW STRETCH
Cal AI ships a macros-left widget to exactly the TikTok cohort the 2026-07-01 push
targets; Yazio, MFP, MacroFactor, Foodnoms all have widgets (§matrix row 30). A
widget is daily re-engagement + a screenshot-able artefact for social. **Build:**
WidgetKit extension (ring + remaining macros + deep-link buttons into
LogSheet/scan — `suppr://` links already exist). Cost: M (new native target in the
Expo project). Impact: high for retention during the push. If it slips, it is the
first post-launch item.

### 5. Apple Watch app — POST-LAUNCH, but the audience is literally "Watch-owner"
MacroFactor (speak-to-log + library from the wrist, Sept 2025) and Foodnoms (full
watch app) set the bar; MFP's watch is quick-add-grade; Yazio's exists but is
basic; Lose It! has none standalone (§matrix row 29). A Suppr watch app doing
speak-to-log (reusing the voice pipeline) + favourites/saved-meals one-tap would
beat MFP's watch outright and match MacroFactor. Cost: L (new watchOS target,
native work, review surface). Impact: high for the named audience — but too big
for the launch window. Sequence: widget (#4) first, watch second; both reuse the
same "remaining + quick actions" contract.

### 6. Siri App Shortcuts for food ("Log my usual breakfast") — POST-LAUNCH
Infra exists (`siriDeepLinks.ts`: water/fast/remaining only). Foodnoms' 44 actions
+ 9 App Shortcuts + Spotlight is the benchmark; NOBODY else in the set does this
well (§3.8) — second-mover slot is open. **Build:** `suppr://log/...` intents +
App Shortcuts for "log my usual <slot>" (the usual-meal heuristic
`resolveQuickAddDefaultTab` already defines "usual") and "log <saved meal name>".
Cost: S–M. Impact: medium — small cohort, outsized loyalty + App Store featuring
angle.

### 7. Nutrition-label OCR scanner — POST-LAUNCH
Cal AI, MacroFactor, Foodnoms have it (matrix row 21 — three, not two; Cal AI's
"Food label" camera mode receipt §3.3). Suppr's barcode-miss recovery is a typed
form; label OCR turns it into a camera pass and doubles as custom-food creation.
The vision pipeline already exists for photo logging. Cost: M. Impact: medium —
UK/EU regional brands miss barcode DBs often, so this disproportionately helps
Suppr's home market.

### 8. "Add to multiple days" at log time — POST-LAUNCH (cheap)
MFP offers a 7-day row inside Add Food (receipt §3.1); MacroFactor a calendar on
the plate. Suppr has the logic in `CopyMealSheet` but only reachable after the
fact. **Build:** surface the next-N-days chips in the portion/confirm step.
Cost: S. Impact: low-medium (meal-preppers).

### 9. Full micros on custom foods — POST-LAUNCH (cheap)
Cal AI's form reaches vitamins; Cronometer is the identity benchmark (don't chase
it — conformity trap). Extending the existing disclosure from 3 fields to the
micro set Suppr already stores is honest parity for Cronometer-curious refugees.
Cost: S. Impact: low-medium.

### Cheap-delight honourable mention
MFP's **"Add Frequently Paired Foods"** (co-occurrence suggestions inside the
confirm step, receipt §3.1) — Suppr's meal history could power the same with a
simple pairwise count; natural follow-on once the basket (#2) exists ("people who
logged X also added Y to this meal").

### Explicitly NOT recommended
- **Cloning MFP's 4-tab header verbatim** — Suppr's slot pills + inline search are
  already a stronger frame; adopt the *single-library* idea (#1), not the exact IA.
- **Chasing Cronometer's 84-nutrient verified depth** — differentiator-erasing
  (conformity trap); Suppr's confidence chips + provenance + correction loop is the
  right-sized trust story.
- **Watch-before-widget** — both are OS-surface bets; the widget is a third of the
  cost and feeds the launch push.
- **Leaning on "free barcode beats MFP" in marketing** — no longer true; MFP
  re-freed single-item barcode scan (May 2026 receipt §3.1). The durable contrasts
  are portion memory + plausibility guard + correction loop, and the **free
  recipe-URL/Reel import that MFP just paywalled**.

---

## 6. Defended choices (where Suppr already meets or beats the bar)

- **Fit-this-in projection** at log time (forward-looking) > MFP's %-of-goals and
  Lifesum's intake bar (both backward-looking).
- **Photo-log kcal ranges + addon chips** — more honest than every point-estimate
  competitor (Snap It's ~70%-category/poor-portion record is the cautionary
  receipt, §3.2).
- **Barcode loop quality** — per-barcode portion memory + physical-plausibility
  guard + correction submission + manual recovery; nobody in the set documents an
  equivalent loop. (Price parity with MFP now, so the loop IS the story.)
- **Logged confirmation + Undo** — only Cal AI has an equivalent non-blocking
  undo.
- **Reel/URL recipe import feeding the Library tab** — no competitor connects
  social recipe content to the log surface, and MFP just moved recipe-URL import
  behind Premium (May 2026). This is the uncopyable wedge (Julienne pattern memo);
  the basket/favourites work above should funnel INTO it, not compete with it.

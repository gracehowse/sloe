# Competitor Feature Catalog with User Sentiment

Date: 2026-04-17
Scope: Every feature area across MyFitnessPal, Cronometer, Lose It!, MacroFactor, Yazio, Lifesum, FatSecret, Carb Manager, Noom, WeightWatchers, Eat This Much, PlateJoy (now defunct), Mealime, Paprika, Samsung Food (Whisk), Copy Me That, Plan to Eat, AnyList, Yummly (defunct), AllRecipes, NYT Cooking, BBC Good Food, Zero, Fastic, Lumen, Ultrahuman, Fitbod, Strong, MyNetDiary, Foodnoms, Moderation, MealBoard, Listonic.

> **Note (added 2026-06-20, ENG-1112):** this catalog predates the acquisition. **MyFitnessPal acquired Cal AI** (deal closed Dec 2025, announced 2 Mar 2026); Cal AI is now a standalone app inside MFP with paywalled photo logging, **no longer an independent competitor.** Cal-AI references below are retained as historical sentiment data. Canonical differentiation statement: `docs/competitor-set-and-mfp-exodus-2026-05-03.md`.

Legend:
- Criticality: Daily / Weekly / Edge
- Effort: Cheap (days) / Medium (weeks) / Heavy (months or external data)
- Frequency: how often the sentiment appears — one-off / repeated / universal

---

## 1. MEAL LOGGING (Core Diary)

### 1.1 Quick Add Calories Only
- Competitors: MyFitnessPal, Cronometer, FatSecret, MyNetDiary, Lose It!
- Sentiment: Users love MFP's "Quick Add" for restaurant meals when macros are unknown. On r/loseit, users say "Quick Add is the only way I log at a wedding." Cronometer users on its forum (thread 5534) explicitly asked for a "calorie only" quick add — "I just want to add 200 cal without a full food."
- Criticality: Daily. Effort: Cheap. Frequency: repeated.

### 1.2 Quick Add Macros
- Competitors: MFP Premium, MacroFactor, Cronometer, Carb Manager
- Sentiment: "I ate someone's cooking and know the macros from a label photo — just let me punch them in." MFP paywalls this which angers users.
- Criticality: Weekly. Effort: Cheap.

### 1.3 Copy Meal to Another Day (single)
- Competitors: All trackers, but with different UX. Cronometer's "copy and paste" is praised as the gold standard.
- Sentiment: MFP forum thread 10914258: "Copy Previous Day's meals has disappeared from the Android app" — massive outcry. Thread 10952472: "Copy and Save meals feature are missing!"
- Criticality: Daily. Effort: Cheap. Frequency: universal.

### 1.4 Copy Meal to Multiple Days / Date Range
- Competitors: Cronometer (best), MacroFactor, FatSecret
- Sentiment: MFP thread 10551543 "Copying food to more than one day" — users complain MFP only allows copy to the ±2 day window. "I meal prep for 5 days — why can I only copy to tomorrow?" (thread 10930874).
- Criticality: Weekly for meal-preppers, daily for power users. Effort: Cheap.

### 1.5 Copy Entire Day
- Competitors: Cronometer, MacroFactor, MFP (limited), Lose It!
- Sentiment: Highly requested for repeatable eaters. "I eat the same thing Mon–Fri, just copy Monday." Very popular among military, shift workers on r/loseit.
- Criticality: Daily for many. Effort: Cheap.

### 1.6 Copy Meal to Meals Tab (save as meal)
- Competitors: MFP, Cronometer, MacroFactor, Lose It!, FatSecret
- Sentiment: Users love saving "my usual breakfast" as a one-tap meal. FatSecret "Saved Meals" praised. MFP thread 10952472 complains when this disappeared.
- Criticality: Daily. Effort: Cheap.

### 1.7 Recent Foods List
- Competitors: All trackers. MacroFactor's "Smart History" considered best.
- Sentiment: "Smart history learns what I eat at what time of day" — MacroFactor reviewers love this. MFP's is time-ordered not context-aware.
- Criticality: Daily. Effort: Medium (intelligent ordering).

### 1.8 Favorites / Starred Foods
- Competitors: All. Lifesum limits favorites to free tier count.
- Sentiment: Lifesum users complain unlimited favorites are Premium-gated.
- Criticality: Daily. Effort: Cheap.

### 1.9 Frequent Foods (auto-detected)
- Competitors: MacroFactor, Cronometer
- Sentiment: "It knows I have oatmeal every morning" — MacroFactor differentiator.
- Criticality: Daily. Effort: Medium.

### 1.10 Bulk Add (add multiple foods in one flow)
- Competitors: Cronometer, MFP, MacroFactor
- Sentiment: Cronometer's multi-select loved; MFP's "Multi Add" exists but hidden. "I didn't know MFP had bulk add for 3 years" — r/loseit.
- Criticality: Daily. Effort: Cheap.

### 1.11 Custom Foods
- Competitors: All serious trackers
- Sentiment: Universal must-have. Complaints when custom food nutrition becomes "private" to user and invisible in search.
- Criticality: Weekly. Effort: Cheap.

### 1.12 Custom Recipes
- Competitors: All trackers, with huge quality gap.
- Sentiment: "MFP recipes are fine but Cronometer's are more accurate because ingredients are verified." MacroFactor's recipe import from URL is the best.
- Criticality: Weekly. Effort: Medium.

### 1.13 Barcode History
- Competitors: Cronometer, FatSecret, Yazio, Lose It!
- Sentiment: Users love seeing last-scanned items for re-scanning same-brand yogurt variants. MFP doesn't expose barcode history, which frustrates.
- Criticality: Weekly. Effort: Cheap.

### 1.14 Offline Entry
- Competitors: Cronometer (partial), Paprika (full), Plan to Eat (partial)
- Sentiment: Complaints explode during travel/gym with poor reception. "Why can't I log while my plane is in the air?" — App Store review MFP.
- Criticality: Daily for travelers. Effort: Heavy.

### 1.15 Meal Timing (log time of meal, not just date)
- Competitors: Cronometer (via Gold timestamps), MacroFactor, Yazio
- Sentiment: Cronometer free users complain they can't separate breakfast/lunch timing — "timing is paywalled". Users asking on r/cronometer for this.
- Criticality: Daily for fasting users. Effort: Cheap.

### 1.16 Meal Categories (Breakfast/Lunch/Dinner/Snack)
- Competitors: All
- Sentiment: Yazio users complain "only 4 meals allowed" — limiting for grazers.
- Criticality: Daily. Effort: Cheap.

### 1.17 Custom Meal Categories / Rename
- Competitors: MFP, Cronometer, MacroFactor, FatSecret
- Sentiment: "Let me add 'Pre-workout' and 'Post-workout'." Heavily requested by lifters.
- Criticality: Weekly. Effort: Cheap.

### 1.18 Unlimited Meal Slots
- Competitors: MFP, Cronometer, MacroFactor
- Sentiment: Yazio's 4-meal limit called out: "the app only allows for 4 meals" — Trustpilot.
- Criticality: Weekly. Effort: Cheap.

### 1.19 Notes per Entry
- Competitors: Cronometer, FatSecret, MyNetDiary
- Sentiment: "How else do I remember 'ate this 2 hours before workout'." Loved by data-driven users.
- Criticality: Weekly. Effort: Cheap.

### 1.20 Serving Size Sliders
- Competitors: Cronometer (best), MacroFactor, MFP
- Sentiment: Cronometer praised; complaints that decimals don't register cleanly: "it wouldn't always register the entire amount entered" — App Store 1-star.
- Criticality: Daily. Effort: Cheap.

### 1.21 Serving Size Units (g, oz, cup, tbsp, each)
- Competitors: Cronometer (best, USDA-backed), MFP
- Sentiment: MFP gets crucified for crowd-sourced servings being wrong. Cronometer: "I trust the grams because I trust USDA."
- Criticality: Daily. Effort: Medium.

### 1.22 Partial Servings (0.5x, 0.25x, fractional)
- Competitors: All. Paprika's scale slider loved.
- Sentiment: Users want quick "0.5 serving" toggle; MFP forces typing decimals.
- Criticality: Daily. Effort: Cheap.

### 1.23 Drag-to-Reorder Diary Entries
- Competitors: Cronometer (yes), MFP (no)
- Sentiment: "Why can't I drag lunch to dinner if I ate late?" — r/MyFitnessPal.
- Criticality: Weekly. Effort: Cheap.

### 1.24 Move Entry Between Meals
- Competitors: All
- Sentiment: Most implement this; frustration when forced to delete and re-add.
- Criticality: Daily. Effort: Cheap.

### 1.25 Edit Quantity Inline from Diary
- Competitors: MacroFactor, Cronometer, Foodnoms
- Sentiment: MFP requires navigating back in — "too many taps." MacroFactor's inline edit praised.
- Criticality: Daily. Effort: Cheap.

### 1.26 Undo Last Entry
- Competitors: Foodnoms, MacroFactor
- Sentiment: "I scanned the wrong item and needed a swipe-undo." Widely praised where present.
- Criticality: Daily. Effort: Cheap.

### 1.27 Swipe-to-Delete
- Competitors: All
- Sentiment: Users complain when removed. MFP on iOS retained it; web version doesn't.
- Criticality: Daily. Effort: Cheap.

### 1.28 Label Scanner (OCR nutrition label)
- Competitors: MacroFactor, Yazio, Foodnoms, Carb Manager
- Sentiment: Highly loved. "I don't care about database — just scan the label." Foodnoms's label scanner often cited as reason for switch.
- Criticality: Weekly. Effort: Medium.

### 1.29 AI Meal Photo Recognition
- Competitors: MacroFactor, Yazio, SnapCalorie, Cal AI (acq. MFP 2026), Fastic, Carb Manager Premium
- Sentiment: Mixed. Loved for speed, hated for 16% error rate (SnapCalorie). App Store reviewers: "describe the exact same food, get vastly different results." Power users distrust; casual users love.
- Criticality: Daily for new users, weekly for power. Effort: Heavy.

### 1.30 Voice Entry
- Competitors: MacroFactor, MyNetDiary (Siri), Talk-to-Track, Moderation
- Sentiment: "Hands-free while cooking is gold" (macpowerusers forum). MFP users begged for it on thread 10892050.
- Criticality: Daily for busy parents. Effort: Medium.

### 1.31 Natural Language Parsing ("2 eggs and toast")
- Competitors: MacroFactor, Talk-to-Track, Welling, Moderation
- Sentiment: Reduces friction enormously when accurate. Accuracy concerns: users compare with barcode scan afterwards.
- Criticality: Daily. Effort: Heavy.

### 1.32 Siri Shortcuts / iOS Shortcuts
- Competitors: Lose It!, MyNetDiary, Foodnoms, MacroFactor
- Sentiment: Power user feature — "Log 16oz water via Siri" automations. MFP users begging on forum thread 10892050.
- Criticality: Daily for power users. Effort: Medium.

### 1.33 Widget — Home Screen Quick Add
- Competitors: Foodnoms, MacroFactor, Lose It!
- Sentiment: Foodnoms home-widget praised. MFP has a weak widget.
- Criticality: Daily. Effort: Medium.

### 1.34 Widget — Lock Screen (iOS 16+)
- Competitors: Foodnoms, MacroFactor (partial)
- Sentiment: "I see my remaining calories before I unlock" — loved by dieters.
- Criticality: Daily. Effort: Medium.

### 1.35 Apple Watch Entry
- Competitors: MyFitnessPal, Lose It!, MyNetDiary, Cronometer, Yazio
- Sentiment: "Log water from my wrist, nothing else needed." Yazio's watch app praised. MFP's called "barebones."
- Criticality: Daily. Effort: Medium.

### 1.36 Apple Watch Complication
- Competitors: Foodnoms, MyNetDiary
- Sentiment: Tiny but loved feature. "Glance at calories on my watch face."
- Criticality: Daily. Effort: Medium.

### 1.37 Live Activities (iOS)
- Competitors: Zero (fasting timer)
- Sentiment: Zero uses Live Activity for fasting — loved. Nutrition apps lag.
- Criticality: Weekly. Effort: Medium.

### 1.38 Smart Defaulting (suggest meal type by time of day)
- Competitors: MacroFactor, Foodnoms
- Sentiment: Small QoL delight. "It auto-picks 'Dinner' at 7pm."
- Criticality: Daily. Effort: Cheap.

### 1.39 Log by Photo Only (just a memory, no nutrition)
- Competitors: Noom (habit tracking), Ate app
- Sentiment: Mindful-eating users love "photo journal without numbers." Rejected by macro-trackers.
- Criticality: Edge. Effort: Cheap.

### 1.40 Brand Memory (prefer brands user has logged before)
- Competitors: MacroFactor (strong), Cronometer
- Sentiment: "It learns I buy Oikos, not Chobani" — loved.
- Criticality: Daily. Effort: Medium.

### 1.41 Store Memory (prefer foods by retailer)
- Competitors: AnyList (for shopping only)
- Sentiment: Requested on Reddit. No tracker does it well.
- Criticality: Edge. Effort: Medium.

### 1.42 Diary Download as CSV/PDF
- Competitors: MyNetDiary, Cronometer Gold, MFP Premium
- Sentiment: Dietitian users need it for client sessions. "Only reason I keep MFP Premium."
- Criticality: Edge. Effort: Cheap.

### 1.43 Historical Search (search through old diary entries)
- Competitors: Cronometer, MacroFactor
- Sentiment: "When did I last eat pad thai?" Niche but loved.
- Criticality: Edge. Effort: Cheap.

### 1.44 Duplicate Yesterday (one-tap)
- Competitors: Cronometer, Carb Manager
- Sentiment: Meal-prep Mondays favorite.
- Criticality: Weekly. Effort: Cheap.

### 1.45 "Eat Again" (one-tap repeat yesterday's dinner)
- Competitors: MacroFactor, Foodnoms
- Sentiment: "Leftovers button is my most-used."
- Criticality: Daily. Effort: Cheap.

### 1.46 Meal Templates (save composite meal)
- Competitors: MFP ("Meals"), Cronometer ("Groupings"), FatSecret ("Saved Meals")
- Sentiment: Universally loved. Yazio's absence noted in complaints.
- Criticality: Daily. Effort: Cheap.

### 1.47 Frequent Pair Suggestions (eggs → toast)
- Competitors: MacroFactor
- Sentiment: Small delight; not widely adopted.
- Criticality: Edge. Effort: Medium.

### 1.48 Quick Water Tracking
- Competitors: All major trackers
- Sentiment: Tap-to-add-glass is table stakes. Users complain when units are wrong.
- Criticality: Daily. Effort: Cheap.

### 1.49 Water by Beverage Type (coffee, tea, soda)
- Competitors: WaterMinder, Waterllama, Lifesum Premium
- Sentiment: WaterMinder users love the beverage breakdown. Requested on r/cronometer.
- Criticality: Daily. Effort: Cheap.

### 1.50 Export Single Day Screenshot (share with coach)
- Competitors: MacroFactor, Cronometer
- Sentiment: Coaches love this. "Send a screenshot to your dietitian."
- Criticality: Weekly. Effort: Cheap.

---

## 2. FOOD DATABASE & SEARCH

### 2.1 Verified Food Database
- Competitors: Cronometer (USDA-verified), MacroFactor (curated)
- Sentiment: Cronometer's differentiator. MFP's crowd-sourced called "garbage" repeatedly.
- Criticality: Daily. Effort: Heavy.

### 2.2 Crowd-Sourced Additions
- Competitors: MFP, Lose It!
- Sentiment: Faster-growing db but rife with errors: "why are there 47 entries for 'apple'?"
- Criticality: Daily. Effort: Medium.

### 2.3 Verified vs Unverified Indicator
- Competitors: Cronometer (green check), MacroFactor
- Sentiment: Users want this on MFP. "At least tell me if this is USDA or someone's guess."
- Criticality: Daily. Effort: Cheap.

### 2.4 Local Store Brand Coverage
- Competitors: Lose It! (US-focused), Yazio (EU-focused), Samsung Food (global)
- Sentiment: UK/AU users complain MFP, MacroFactor don't know Tesco/Woolies brands.
- Criticality: Daily. Effort: Heavy (data).

### 2.5 Restaurant/Chain Food Coverage
- Competitors: MFP (best), FatSecret, Lose It!, Yazio
- Sentiment: Chipotle, Starbucks must-haves. "Can't find Chipotle on Cronometer" = common complaint.
- Criticality: Weekly. Effort: Heavy.

### 2.6 Regional/Ethnic Food Coverage
- Competitors: FatSecret (global), Yazio (EU)
- Sentiment: Indian, Asian, Latin American food gaps consistently cited. "No one has good dosa nutrition."
- Criticality: Daily (non-Western users). Effort: Heavy.

### 2.7 Search Speed
- Competitors: MacroFactor, Foodnoms (fastest)
- Sentiment: "Manual text search takes 45+ seconds per meal" — Cronometer complaint on App Store.
- Criticality: Daily. Effort: Medium.

### 2.8 Fuzzy Matching / Typo Tolerance
- Competitors: MacroFactor
- Sentiment: "Typed 'chikn' and it still knew" — praised.
- Criticality: Daily. Effort: Medium.

### 2.9 Multi-Language Food Names
- Competitors: Yazio, Samsung Food
- Sentiment: Yazio praised for German/Spanish food naming.
- Criticality: Daily (non-US). Effort: Heavy.

### 2.10 Food Photos in Results
- Competitors: Yazio, Samsung Food, Lifesum
- Sentiment: "I find it faster when there's a photo" — Lifesum users.
- Criticality: Daily. Effort: Medium.

### 2.11 USDA Foundation Foods Tier
- Competitors: Cronometer
- Sentiment: Nutrition nerds praise.
- Criticality: Weekly. Effort: Medium.

### 2.12 Community-Flagged Error Reports
- Competitors: MacroFactor
- Sentiment: "Flag wrong entry" button under-used but appreciated.
- Criticality: Weekly. Effort: Cheap.

### 2.13 User-Facing Food Verification (earn green tick)
- Competitors: FatSecret (partial)
- Sentiment: Gamification angle; not universally loved.
- Criticality: Edge. Effort: Medium.

---

## 3. BARCODE SCANNING

### 3.1 Barcode Scan → Auto Log
- Competitors: MFP Premium, Cronometer, Lose It!, Yazio, FatSecret, MacroFactor
- Sentiment: "MFP paywalled barcode — I switched to Cronometer that week" (pocket-lint, 2022). #1 cited reason for MFP churn.
- Criticality: Daily. Effort: Medium.

### 3.2 Multiple Barcode Scan (queue)
- Competitors: MacroFactor
- Sentiment: "Scan my entire grocery bag at once" — niche power-user love.
- Criticality: Weekly. Effort: Medium.

### 3.3 Barcode Fallback to OCR
- Competitors: MacroFactor, Foodnoms
- Sentiment: "If barcode fails, let me just scan the label."
- Criticality: Daily. Effort: Medium.

### 3.4 Off-Brand Substitution ("closest match")
- Competitors: MacroFactor
- Sentiment: Pro-user feature. "It offered generic if my brand wasn't known."
- Criticality: Weekly. Effort: Medium.

### 3.5 Scan Recent Barcodes Quick Access
- Competitors: Yazio
- Sentiment: Small QoL win — users praise.
- Criticality: Weekly. Effort: Cheap.

---

## 4. RECIPE HANDLING

### 4.1 Import Recipe from URL
- Competitors: MacroFactor (best), Samsung Food, Paprika (excellent), Plan to Eat, Copy Me That, AnyList, MFP Premium, Cronometer
- Sentiment: Universal love. Paprika: "works on 99% of websites." MFP's is error-prone.
- Criticality: Weekly. Effort: Medium.

### 4.2 Browser Bookmarklet / Share-Sheet Import
- Competitors: Paprika, Samsung Food, Copy Me That, Plan to Eat, AnyList
- Sentiment: "Share from Safari and it's saved" — iOS users love. Copy Me That praised: "hit the send button like you're printing."
- Criticality: Weekly. Effort: Cheap.

### 4.3 Import from Instagram / TikTok / Facebook
- Competitors: Copy Me That, Samsung Food (partial), Peel, Flavorish
- Sentiment: Yummly's shutdown triggered refugees wanting IG/TikTok import. Loud request.
- Criticality: Weekly. Effort: Heavy.

### 4.4 Import from Photo (OCR paper recipe)
- Competitors: Samsung Food, Paprika (manual OCR via camera)
- Sentiment: Heritage recipe users "photograph grandma's card."
- Criticality: Edge. Effort: Medium.

### 4.5 Import from Video
- Competitors: Samsung Food (beta), Copy Me That
- Sentiment: Emerging. "TikTok video → recipe" is the holy grail.
- Criticality: Edge. Effort: Heavy.

### 4.6 Manual Recipe Entry with Nutrition Calc
- Competitors: All recipe managers + MFP, Cronometer
- Sentiment: Cronometer's is most accurate. MFP's is "slow to calculate."
- Criticality: Weekly. Effort: Medium.

### 4.7 Edit Imported Recipe (post-import)
- Competitors: Paprika (excellent), Plan to Eat, Samsung Food, Copy Me That, MacroFactor
- Sentiment: "Import often picks wrong ingredient match — I must edit." Universal.
- Criticality: Weekly. Effort: Cheap.

### 4.8 Add Ingredient to Imported Recipe
- Competitors: Paprika, Plan to Eat, MacroFactor, Cronometer
- Sentiment: "Importer missed the garlic. Let me add it." Frequent complaint if missing.
- Criticality: Weekly. Effort: Cheap.

### 4.9 Remove Ingredient from Imported Recipe
- Competitors: All recipe managers
- Sentiment: Needed for allergies/preferences.
- Criticality: Weekly. Effort: Cheap.

### 4.10 Scale Servings (2x, 0.5x)
- Competitors: Paprika (slider, loved), Samsung Food, NYT Cooking, AllRecipes, Plan to Eat
- Sentiment: Paprika's 125% scaling praised — "baked a bigger pizza." NYT Cooking lacks strong scaling.
- Criticality: Weekly. Effort: Cheap.

### 4.11 Split Recipe (half into freezer)
- Competitors: Plan to Eat
- Sentiment: Niche but loud: "I cooked 8 servings, froze 4 — split the plan."
- Criticality: Weekly. Effort: Medium.

### 4.12 Combine Recipes (merge shopping lists)
- Competitors: Samsung Food, AnyList, Plan to Eat, Paprika
- Sentiment: "When my week mixes 5 recipes, consolidate flour." AnyList's merge beloved.
- Criticality: Weekly. Effort: Medium.

### 4.13 Substitute Ingredient (suggest swaps)
- Competitors: Cooklist, Samsung Food (limited)
- Sentiment: Heavily requested on r/cooking, r/recipes. "Out of eggs — what works?"
- Criticality: Weekly. Effort: Medium.

### 4.14 Ingredient Substitution Library
- Competitors: BBC Good Food, AllRecipes (commented)
- Sentiment: Comments on AllRecipes recipes often suggest subs — users value.
- Criticality: Weekly. Effort: Medium.

### 4.15 Notes per Recipe
- Competitors: Paprika, Plan to Eat, NYT Cooking, Copy Me That
- Sentiment: "My notes on last cook are why I keep Paprika." Power user love. AllRecipes removed this — complaint.
- Criticality: Weekly. Effort: Cheap.

### 4.16 Photo per Recipe / Photo per Cook
- Competitors: Paprika, Samsung Food, Plan to Eat
- Sentiment: "Photo of my last batch helps me remember adjustments."
- Criticality: Weekly. Effort: Cheap.

### 4.17 Recipe Ratings (personal)
- Competitors: Paprika, Plan to Eat, NYT Cooking
- Sentiment: "Rate so I never make the 2-star chili again." Beloved.
- Criticality: Weekly. Effort: Cheap.

### 4.18 Recipe Ratings (community)
- Competitors: NYT Cooking, AllRecipes, BBC Good Food, Samsung Food
- Sentiment: "NYT Cooking comments are the actual recipe" — universal. AllRecipes community reviews called "its whole moat."
- Criticality: Weekly. Effort: Medium.

### 4.19 Cook Mode (keep screen on, step-by-step)
- Competitors: Paprika, Samsung Food (from Whisk era), NYT Cooking (partial), Mealime
- Sentiment: Paprika's "screen stays on" loved. Mealime's step-by-step praised. NYT Cooking frustration: "app refreshes when screen rests."
- Criticality: Weekly. Effort: Cheap.

### 4.20 Embedded Timers in Instructions
- Competitors: Paprika (auto-detects), Samsung Food, NYT Cooking
- Sentiment: "Tap '10 minutes' in the recipe and timer runs." Paprika: beloved feature.
- Criticality: Weekly. Effort: Medium.

### 4.21 Multiple Simultaneous Timers
- Competitors: Paprika
- Sentiment: "Boil pasta + bake bread at once, both timers" — praised.
- Criticality: Weekly. Effort: Cheap.

### 4.22 Step-by-Step View (next step only)
- Competitors: Mealime (best), Samsung Food
- Sentiment: "One step at a time — less overwhelming" — Mealime reviewers.
- Criticality: Weekly. Effort: Cheap.

### 4.23 Video Step-by-Step
- Competitors: Yummly (defunct), some premium meal plans
- Sentiment: Yummly's loss mourned. "Video was why I used Yummly."
- Criticality: Edge. Effort: Heavy.

### 4.24 Voice-Read Instructions
- Competitors: Mealime, Samsung Food
- Sentiment: "Hands covered in batter — voice reads next step." Niche love.
- Criticality: Weekly. Effort: Medium.

### 4.25 Recipe Collections / Folders
- Competitors: Paprika, Copy Me That, NYT Cooking, Samsung Food, BBC Good Food
- Sentiment: NYT "Recipe Box" loved, but UX bug: saving+moving unsaves. AllRecipes users lost saved recipes when moved — major complaint.
- Criticality: Weekly. Effort: Cheap.

### 4.26 Multi-Category Tagging (one recipe in many folders)
- Competitors: Paprika, Copy Me That, BBC Good Food
- Sentiment: "Chicken tikka is both 'weeknight' and 'Indian'" — users want both.
- Criticality: Weekly. Effort: Cheap.

### 4.27 Recipe Search (in personal collection)
- Competitors: Paprika, Samsung Food, Copy Me That
- Sentiment: NYT Cooking users complain search in saved recipes is weak.
- Criticality: Weekly. Effort: Cheap.

### 4.28 Filter by Ingredient ("what uses zucchini")
- Competitors: Paprika, Samsung Food
- Sentiment: Beloved for pantry use.
- Criticality: Weekly. Effort: Medium.

### 4.29 Filter by Cook Time
- Competitors: Mealime, NYT Cooking, AllRecipes
- Sentiment: "Under 30 min" filter beloved by weeknight cooks.
- Criticality: Weekly. Effort: Cheap.

### 4.30 Filter by Diet (Keto, Vegan, etc)
- Competitors: Mealime (strong), Eat This Much, Samsung Food
- Sentiment: Mealime praised for allergy/dislike filters. PlateJoy too (now shut).
- Criticality: Weekly. Effort: Medium.

### 4.31 Exclude Ingredient (I hate cilantro)
- Competitors: Mealime, PlateJoy (was), Eat This Much, Yummly (was)
- Sentiment: Yummly's "Taste Profile" loss deeply mourned — "knew I hated mushrooms."
- Criticality: Daily. Effort: Medium.

### 4.32 Recipe Duplicate / Copy
- Competitors: Paprika, Samsung Food
- Sentiment: "Clone to modify" standard.
- Criticality: Weekly. Effort: Cheap.

### 4.33 Export Recipe as PDF
- Competitors: Paprika, Copy Me That, Plan to Eat
- Sentiment: "Print my grandma's recipe for her" — sentimental.
- Criticality: Edge. Effort: Cheap.

### 4.34 Share Recipe to Friend / Social
- Competitors: Samsung Food, Copy Me That, Paprika, NYT Cooking
- Sentiment: Samsung Food's social layer growing popular.
- Criticality: Weekly. Effort: Medium.

### 4.35 Private Recipe Notes vs Public
- Competitors: Samsung Food, AllRecipes
- Sentiment: "Keep my tweaks private but share the base."
- Criticality: Edge. Effort: Medium.

### 4.36 Cross-Device Sync of Recipes
- Competitors: Paprika (paid per platform — controversial), Plan to Eat (all platforms one price), Copy Me That
- Sentiment: Paprika's per-device pricing criticized. Plan to Eat wins on this.
- Criticality: Weekly. Effort: Medium.

### 4.37 Recipe Version History
- Competitors: Paprika
- Sentiment: Niche but loved. "I want to try v2 without losing v1."
- Criticality: Edge. Effort: Medium.

### 4.38 Convert Units in Recipe (metric ↔ imperial)
- Competitors: Paprika, NYT Cooking, Samsung Food
- Sentiment: UK/US users love. Missing in many apps.
- Criticality: Weekly. Effort: Cheap.

### 4.39 Ingredient Checkoff While Cooking
- Competitors: Paprika (tap to mark done), Samsung Food
- Sentiment: "Crossed-off flour so I don't add twice." Small but beloved.
- Criticality: Weekly. Effort: Cheap.

### 4.40 Per-Ingredient Nutrition Breakdown
- Competitors: Cronometer, MacroFactor
- Sentiment: "See which ingredient is the sodium bomb." Power user love.
- Criticality: Edge. Effort: Medium.

### 4.41 Recipe Photo Gallery (every cook)
- Competitors: Paprika
- Sentiment: "Watch my sourdough evolve" — niche delight.
- Criticality: Edge. Effort: Cheap.

### 4.42 Private Recipe Lock
- Competitors: Paprika
- Sentiment: Edge case.
- Criticality: Edge. Effort: Cheap.

### 4.43 Recipe Print Layout
- Competitors: Paprika, Plan to Eat
- Sentiment: "Print for my kitchen magnet." Older demo loves.
- Criticality: Edge. Effort: Cheap.

---

## 5. MEAL PLANNING

### 5.1 Weekly Calendar View
- Competitors: Plan to Eat, Samsung Food, Paprika, Eat This Much, Mealime
- Sentiment: Plan to Eat's calendar praised. Users want this across ALL trackers.
- Criticality: Weekly. Effort: Medium.

### 5.2 Monthly View
- Competitors: Plan to Eat, Paprika
- Sentiment: Long-horizon planners love.
- Criticality: Edge. Effort: Cheap.

### 5.3 Drag-Drop Recipes Between Days
- Competitors: Plan to Eat (best), Samsung Food, Paprika
- Sentiment: Universally praised. "It's why I pay for Plan to Eat."
- Criticality: Weekly. Effort: Medium.

### 5.4 Drag-Drop Between Meals (within a day)
- Competitors: Plan to Eat, Samsung Food
- Sentiment: "Move lunch to dinner easily."
- Criticality: Weekly. Effort: Cheap.

### 5.5 Weekly Templates (save "Week A")
- Competitors: Plan to Eat, Samsung Food, Eat This Much
- Sentiment: "I rotate 4 weekly plans — save them." Loud request.
- Criticality: Weekly. Effort: Medium.

### 5.6 Copy Week
- Competitors: Plan to Eat, Samsung Food
- Sentiment: Beloved by routine-oriented users.
- Criticality: Weekly. Effort: Cheap.

### 5.7 AI-Generated Plan from Macros
- Competitors: Eat This Much, PlateJoy (defunct)
- Sentiment: "Just make me a plan that hits 180p/250c/80f." Both apps criticized for repeated recipes.
- Criticality: Weekly. Effort: Heavy.

### 5.8 Budget-Aware Planning
- Competitors: Eat This Much
- Sentiment: "Plan meals under $50/week" — loved.
- Criticality: Weekly. Effort: Medium.

### 5.9 Pantry-Aware Planning (uses what you have)
- Competitors: Eat This Much ("virtual pantry"), Cooklist, Paprika
- Sentiment: Praised by Eat This Much users: "only lists what I need."
- Criticality: Weekly. Effort: Heavy.

### 5.10 Shopping List from Plan (auto-generated)
- Competitors: Plan to Eat, Samsung Food, Paprika, AnyList, Mealime, Eat This Much
- Sentiment: Universal must-have. AnyList integration praised.
- Criticality: Weekly. Effort: Medium.

### 5.11 Partial-Week Plans (Sun-Wed only)
- Competitors: Plan to Eat, Paprika
- Sentiment: Flexible week users love.
- Criticality: Weekly. Effort: Cheap.

### 5.12 Leftovers Handling
- Competitors: Plan to Eat (best)
- Sentiment: "Plan leftovers 3 days ahead" — Plan to Eat signature.
- Criticality: Weekly. Effort: Medium.

### 5.13 Carry Over Unfinished Meals
- Competitors: Plan to Eat
- Sentiment: "Didn't cook Tuesday — roll it to Wednesday."
- Criticality: Weekly. Effort: Cheap.

### 5.14 Freezer Tracker
- Competitors: Plan to Eat, MealBoard
- Sentiment: "Cooked double, froze half, log it" — niche but loyal.
- Criticality: Weekly. Effort: Medium.

### 5.15 Batch Cook Scheduling
- Competitors: Plan to Eat
- Sentiment: Meal prep Sunday warriors love.
- Criticality: Weekly. Effort: Medium.

### 5.16 Send Today's Plan to Log Diary (plan → eaten)
- Competitors: MacroFactor (partial), Cronometer (via recipe)
- Sentiment: Missing loop between plan and tracker is universal complaint. "Plan and tracker never talk."
- Criticality: Daily. Effort: Medium.

### 5.17 Household / Family Sharing of Plan
- Competitors: Plan to Eat, AnyList, Paprika
- Sentiment: "Partner sees tonight's plan." AnyList real-time sync loved.
- Criticality: Weekly. Effort: Medium.

### 5.18 Multiple Dependents in Plan (kids' portions)
- Competitors: PlateJoy (was), limited elsewhere
- Sentiment: Parents want.
- Criticality: Weekly. Effort: Heavy.

### 5.19 Theme Nights (Taco Tuesday)
- Competitors: Plan to Eat, MealBoard
- Sentiment: "Planning structure saves my sanity."
- Criticality: Edge. Effort: Cheap.

### 5.20 Drag Recipes from Browser to Plan
- Competitors: Samsung Food (Chrome extension), AnyList
- Sentiment: Desktop meal-planners love.
- Criticality: Weekly. Effort: Medium.

### 5.21 Plan Print / PDF
- Competitors: Plan to Eat, Paprika
- Sentiment: "Print for fridge." Old-school love.
- Criticality: Edge. Effort: Cheap.

### 5.22 Week Overview Nutrition Totals
- Competitors: Samsung Food, MacroFactor (average view)
- Sentiment: "Does this week hit my weekly macros?" Requested.
- Criticality: Weekly. Effort: Medium.

### 5.23 Meal-Level Macro Targets
- Competitors: MFP Premium, Cronometer, Carb Manager
- Sentiment: Lifters love: "make breakfast 40g protein." MFP paywalls this.
- Criticality: Daily for power users. Effort: Medium.

---

## 6. MACRO / CALORIE GOALS

### 6.1 Custom Calorie Goal
- Competitors: All trackers, but MFP paywalled it (complaint).
- Sentiment: "MFP made me pay to override its calorie calc — unforgivable" — r/loseit.
- Criticality: Daily. Effort: Cheap.

### 6.2 Custom Macro Split (grams or %)
- Competitors: MFP Premium (paywalled), Cronometer, MacroFactor, Lose It!, Carb Manager
- Sentiment: Cronometer praised for "set grams, not percentages." MFP's % only caused frustration.
- Criticality: Daily. Effort: Cheap.

### 6.3 Per-Day Custom Goals (M/T/W different)
- Competitors: MacroFactor, Cronometer, MFP Premium
- Sentiment: Carb cycling and lifters: "Workout days 3000, rest days 2500." MacroFactor's "calorie shifting" praised.
- Criticality: Weekly. Effort: Medium.

### 6.4 Carb Cycling Mode
- Competitors: Carb Manager, MacroFactor (via shifting), not truly dedicated
- Sentiment: MacroFactor explicitly chose NOT to do this; users on help docs thread still request.
- Criticality: Weekly. Effort: Medium.

### 6.5 Refeed Days
- Competitors: MacroFactor (partial), Carbon
- Sentiment: Power users love.
- Criticality: Weekly. Effort: Medium.

### 6.6 Diet Breaks
- Competitors: MacroFactor
- Sentiment: Evidence-based dieters praise. "Maintenance week built in."
- Criticality: Edge. Effort: Medium.

### 6.7 Adaptive Calorie Adjustment (based on weight trend)
- Competitors: MacroFactor (flagship), Carbon, MyNetDiary
- Sentiment: MacroFactor's entire unique selling point. "Only tracker that adjusts to reality."
- Criticality: Weekly. Effort: Heavy.

### 6.8 Weekly Average vs Daily View
- Competitors: MacroFactor (weekly avg added after user demand), Cronometer
- Sentiment: "Weekly matters more than daily" — MF users requested for years before shipped.
- Criticality: Weekly. Effort: Medium.

### 6.9 Adjust Goal Mid-Plan
- Competitors: MacroFactor (auto), MFP (manual)
- Sentiment: Auto-adjust loved.
- Criticality: Weekly. Effort: Medium.

### 6.10 Rate of Loss Slider (slow/fast)
- Competitors: MacroFactor, Cronometer, MFP
- Sentiment: Beloved.
- Criticality: Weekly. Effort: Cheap.

### 6.11 Goal Timeline Projection
- Competitors: Lose It!, MacroFactor
- Sentiment: "Reach goal by July 12" — motivator.
- Criticality: Weekly. Effort: Medium.

### 6.12 Calorie Bank / Roll-Over
- Competitors: Lose It!, Weight Watchers (weekly points rollover)
- Sentiment: Loved. "Saved 500 for Saturday dinner."
- Criticality: Weekly. Effort: Cheap.

### 6.13 Exercise Calories Back (refund)
- Competitors: MFP (default on — controversial), Lose It!, Yazio
- Sentiment: Divisive. "MFP gave me back 1200 cal from a 30min walk — madness." Many disable, some love it.
- Criticality: Daily. Effort: Medium.

### 6.14 Zero-Point / Zero-Calorie Foods
- Competitors: Weight Watchers
- Sentiment: Signature feature. "200+ foods I don't track" — WW users love.
- Criticality: Daily. Effort: Medium.

### 6.15 Maintenance Mode
- Competitors: MacroFactor, Cronometer, MFP
- Sentiment: Post-diet switch is important — users request better flow.
- Criticality: Weekly. Effort: Cheap.

### 6.16 Surplus/Bulk Mode
- Competitors: MacroFactor, Carbon
- Sentiment: Lifters love; most apps force "weight loss" framing.
- Criticality: Weekly. Effort: Cheap.

### 6.17 Recomp Mode
- Competitors: MacroFactor
- Sentiment: "Protein up, calories maintenance" — advanced lifters want more options.
- Criticality: Edge. Effort: Medium.

### 6.18 TDEE Based on Activity Wearable
- Competitors: Cronometer, MFP
- Sentiment: Works best with Garmin/Apple Watch. Yazio and others have weak integration.
- Criticality: Daily. Effort: Medium.

### 6.19 TDEE From Scale + Intake (algorithm)
- Competitors: MacroFactor (v3 algo)
- Sentiment: Signature. Users love "it learns my actual maintenance."
- Criticality: Daily. Effort: Heavy.

### 6.20 Goal Weight Trend vs Scale Weight
- Competitors: MacroFactor, Happy Scale, Libra
- Sentiment: "Stops the freak-outs on water weight days" — beloved.
- Criticality: Daily. Effort: Medium.

---

## 7. NUTRITION DETAIL & MICROS

### 7.1 Macros (Protein/Carbs/Fat)
- Competitors: All
- Sentiment: Table stakes.
- Criticality: Daily. Effort: Cheap.

### 7.2 Fiber Tracking
- Competitors: Cronometer, Carb Manager, FatSecret, MFP Premium
- Sentiment: r/nutrition, r/ibs users desperate. MFP hiding fiber behind premium — loud complaint.
- Criticality: Daily. Effort: Cheap.

### 7.3 Net Carbs Toggle (carbs - fiber)
- Competitors: Carb Manager (signature), Cronometer, MacroFactor
- Sentiment: Keto community insists. Carb Manager's net carb toggle loved.
- Criticality: Daily (keto). Effort: Cheap.

### 7.4 Added Sugars
- Competitors: Cronometer, MacroFactor, Foodnoms
- Sentiment: Health-conscious users praise. Absent in many trackers.
- Criticality: Daily. Effort: Medium.

### 7.5 Sugar Alcohols
- Competitors: Carb Manager
- Sentiment: Keto essential.
- Criticality: Daily (keto). Effort: Medium.

### 7.6 Micronutrients (vitamins/minerals)
- Competitors: Cronometer (flagship — 84 nutrients), MacroFactor (partial)
- Sentiment: Cronometer gold standard. "Only reason I use it."
- Criticality: Weekly. Effort: Heavy.

### 7.7 Nutrient Targets with Visual Bars
- Competitors: Cronometer's "Nutrient Summary view" universally praised
- Sentiment: "No other app gives this" — reviewers.
- Criticality: Weekly. Effort: Medium.

### 7.8 Amino Acid Profile
- Competitors: Cronometer
- Sentiment: Vegans/athletes love.
- Criticality: Edge. Effort: Heavy.

### 7.9 Fatty Acid Breakdown (omega 3/6)
- Competitors: Cronometer
- Sentiment: Health enthusiasts love.
- Criticality: Edge. Effort: Heavy.

### 7.10 Electrolytes (sodium/potassium/magnesium)
- Competitors: Cronometer, Carb Manager
- Sentiment: Keto, endurance athletes love. "Only reason I still use Cronometer for rides."
- Criticality: Daily (niche). Effort: Medium.

### 7.11 Caffeine Tracking
- Competitors: Cronometer, MyCalAgent, WaterMinder, Ultrahuman
- Sentiment: "When should I stop drinking coffee" — Ultrahuman's prompts praised.
- Criticality: Daily. Effort: Cheap.

### 7.12 Alcohol Tracking
- Competitors: Cronometer, MyFitnessPal (counts as carbs), MyCalAgent, dedicated apps (Dry7)
- Sentiment: Users want discrete alcohol tracking, not "carb" mapping. Complaint.
- Criticality: Weekly. Effort: Cheap.

### 7.13 Hydration Target Auto-Calc (based on weight)
- Competitors: Waterllama, WaterMinder, Lifesum Premium
- Sentiment: "It knows I'm 180lb and says 100oz" — beloved.
- Criticality: Daily. Effort: Cheap.

### 7.14 Nutrient Oracle (foods high in X)
- Competitors: Cronometer (Gold)
- Sentiment: "Instead of googling foods high in zinc." Power-user love.
- Criticality: Weekly. Effort: Medium.

### 7.15 Nutrition Score (0-10 meal quality)
- Competitors: Lifesum ("Life Score"), Yazio, Ultrahuman
- Sentiment: Divisive — some love, dietitians hate "simplistic scoring."
- Criticality: Daily. Effort: Medium.

### 7.16 Glycemic Load / Index
- Competitors: Carb Manager
- Sentiment: Diabetics love.
- Criticality: Daily (diabetic). Effort: Medium.

### 7.17 GKI (Glucose-Ketone Index)
- Competitors: Carb Manager
- Sentiment: Keto advanced users love.
- Criticality: Daily (keto). Effort: Medium.

### 7.18 Blood Glucose Logging
- Competitors: Carb Manager, Levels, Ultrahuman (CGM)
- Sentiment: Diabetics essential.
- Criticality: Daily (diabetic). Effort: Medium.

### 7.19 Ketone Logging
- Competitors: Carb Manager, Zero
- Sentiment: Keto users loyal.
- Criticality: Daily (keto). Effort: Cheap.

### 7.20 Insulin Logging
- Competitors: Carb Manager
- Sentiment: T1D users love.
- Criticality: Daily (diabetic). Effort: Medium.

### 7.21 A1C Estimator
- Competitors: Carb Manager
- Sentiment: Niche but important for its community.
- Criticality: Weekly (diabetic). Effort: Medium.

### 7.22 Cholesterol Tracking (HDL/LDL/Triglyceride)
- Competitors: Cronometer (via biometrics)
- Sentiment: Heart-health users love.
- Criticality: Weekly. Effort: Cheap.

### 7.23 Blood Pressure Logging
- Competitors: Cronometer Gold (custom biometric)
- Sentiment: Retiree demographic love.
- Criticality: Daily. Effort: Cheap.

### 7.24 Body Fat % Tracking
- Competitors: MFP, Lose It!, MacroFactor, Cronometer
- Sentiment: Smart scale integration critical.
- Criticality: Weekly. Effort: Cheap.

### 7.25 Body Measurements (waist/hip/chest)
- Competitors: MFP, Lose It!, MacroFactor
- Sentiment: "Scale lies, tape measure doesn't" — MacroFactor users.
- Criticality: Weekly. Effort: Cheap.

### 7.26 Progress Photos
- Competitors: MacroFactor, WW (AI Body Scanner), Fitbod
- Sentiment: Before/after side-by-side loved. WW's 3D scanner polarizing.
- Criticality: Weekly. Effort: Medium.

### 7.27 Custom Biometrics (allergy symptoms, pain, etc)
- Competitors: Cronometer Gold
- Sentiment: Loved by chronic illness community.
- Criticality: Daily (niche). Effort: Cheap.

### 7.28 Correlate Nutrient vs Biometric (chart)
- Competitors: Cronometer Gold (custom charts)
- Sentiment: "See my vit D vs energy level" — data-nerd delight.
- Criticality: Weekly (power). Effort: Medium.

---

## 8. FASTING

### 8.1 Fasting Timer (start/stop)
- Competitors: Zero, Fastic, Cronometer Gold, MacroFactor (partial), Yazio
- Sentiment: Table stakes for fasting apps.
- Criticality: Daily. Effort: Cheap.

### 8.2 Auto-Detect Fast Start (from last meal)
- Competitors: MacroFactor, Cronometer
- Sentiment: "No need to remember to start" — small delight.
- Criticality: Daily. Effort: Medium.

### 8.3 Fasting Zones (fat-burn, autophagy)
- Competitors: Zero, Fastic
- Sentiment: Zero's educational overlay loved. Scientific accuracy questioned.
- Criticality: Daily. Effort: Medium.

### 8.4 Fasting Streaks
- Competitors: Zero, Fastic
- Sentiment: Loss-aversion motivator. "Seeing my 43-day streak keeps me going."
- Criticality: Daily. Effort: Cheap.

### 8.5 Streak Freeze (skip a day)
- Competitors: Duolingo-style; nutrition apps rarely have
- Sentiment: Requested repeatedly. "I had a birthday — let me preserve my streak."
- Criticality: Weekly. Effort: Cheap.

### 8.6 Eating Window Reminders
- Competitors: Zero, Fastic, Yazio
- Sentiment: "Tell me when my window closes" — useful.
- Criticality: Daily. Effort: Cheap.

### 8.7 Fasting Protocols (16:8, 18:6, OMAD)
- Competitors: Zero, Fastic, Cronometer Gold
- Sentiment: Table stakes.
- Criticality: Daily. Effort: Cheap.

### 8.8 Custom Fasting Window
- Competitors: Zero, Fastic
- Sentiment: Must-have. Lumen complained about: "not set up to allow extended fasting."
- Criticality: Weekly. Effort: Cheap.

### 8.9 Live Activity for Fasting (iOS)
- Competitors: Zero
- Sentiment: Loved — "glance at home screen."
- Criticality: Daily. Effort: Medium.

### 8.10 Fasting Stats / Trends
- Competitors: Zero, Fastic
- Sentiment: Longest fast, avg fast, etc. Beloved.
- Criticality: Weekly. Effort: Cheap.

### 8.11 Mood/Energy During Fast
- Competitors: Zero
- Sentiment: Small but loved journaling layer.
- Criticality: Weekly. Effort: Cheap.

### 8.12 Weight Correlation with Fast Length
- Competitors: Zero (premium)
- Sentiment: "Did my 18h fasts actually help?" — valued insight.
- Criticality: Weekly. Effort: Medium.

### 8.13 Integration with Food Log (end fast = first meal)
- Competitors: Cronometer, MacroFactor
- Sentiment: "Why are fasting and logging two separate apps?" Loud complaint — opportunity.
- Criticality: Daily. Effort: Medium.

---

## 9. SHOPPING / PANTRY / GROCERY

### 9.1 Auto-Generated Shopping List from Plan
- Competitors: Plan to Eat, Samsung Food, Paprika, AnyList, Mealime, Eat This Much
- Sentiment: Universal must-have.
- Criticality: Weekly. Effort: Medium.

### 9.2 Aisle / Category Grouping
- Competitors: AnyList (best), Plan to Eat, Paprika, Samsung Food, Mealime
- Sentiment: "Produce, then dairy, then freezer" — beloved.
- Criticality: Weekly. Effort: Cheap.

### 9.3 Custom Aisle Order (reorder for your store)
- Competitors: AnyList (signature), Plan to Eat
- Sentiment: AnyList praised: "rearrange to match my Trader Joe's layout." Deeply loved.
- Criticality: Weekly. Effort: Cheap.

### 9.4 Multiple Stores in One List
- Competitors: AnyList, Listonic
- Sentiment: "I shop Costco and Trader Joe's same trip."
- Criticality: Weekly. Effort: Medium.

### 9.5 Store-Specific Price Tracking
- Competitors: AnyList, Listonic
- Sentiment: Budgeters love. AnyList's running total beloved.
- Criticality: Weekly. Effort: Medium.

### 9.6 Shared List (real-time)
- Competitors: AnyList (flagship), Samsung Food, Plan to Eat, Paprika (sync)
- Sentiment: AnyList: "partner checks off eggs while I'm in the produce aisle" — beloved.
- Criticality: Weekly. Effort: Medium.

### 9.7 Check-Off UI (big tappable)
- Competitors: AnyList, Listonic, Samsung Food
- Sentiment: One-handed shopping matters.
- Criticality: Weekly. Effort: Cheap.

### 9.8 Photos on List Items
- Competitors: AnyList
- Sentiment: "Partner needs to see the exact cheese."
- Criticality: Edge. Effort: Cheap.

### 9.9 Voice-Add to List (Siri)
- Competitors: AnyList, Samsung Food
- Sentiment: "Hands-free while driving" — loved.
- Criticality: Weekly. Effort: Medium.

### 9.10 Barcode to Shopping List (scan empty bottle)
- Competitors: Cooklist, Out of Milk
- Sentiment: Niche but loved.
- Criticality: Edge. Effort: Medium.

### 9.11 Recurring Items (weekly staples)
- Competitors: AnyList, Listonic
- Sentiment: Auto-add milk every Monday. Small delight.
- Criticality: Weekly. Effort: Cheap.

### 9.12 Pantry Inventory
- Competitors: Cooklist, MealBoard, Plan to Eat (partial)
- Sentiment: "Finally I know I have 3 cans of chickpeas."
- Criticality: Weekly. Effort: Heavy.

### 9.13 Pantry Expiry Alerts
- Competitors: Cooklist, MealBoard
- Sentiment: "Yogurt expires tomorrow" — beloved when working.
- Criticality: Weekly. Effort: Medium.

### 9.14 Running Low Alerts
- Competitors: Cooklist, Amazon Dash (deprecated)
- Sentiment: Requested.
- Criticality: Weekly. Effort: Medium.

### 9.15 "Cook With What I Have" (pantry-based recipes)
- Competitors: SuperCook, Cooklist
- Sentiment: SuperCook loved. "Empty fridge → recipe match."
- Criticality: Weekly. Effort: Heavy.

### 9.16 Instacart Integration
- Competitors: Samsung Food, AnyList, Paprika (partial), PlateJoy (was)
- Sentiment: US users love "list → cart in one tap."
- Criticality: Weekly. Effort: Medium.

### 9.17 Amazon Fresh / Whole Foods Integration
- Competitors: PlateJoy (was)
- Sentiment: Limited but requested.
- Criticality: Edge. Effort: Medium.

### 9.18 UK Supermarket Integration (Tesco/Ocado)
- Competitors: Samsung Food (limited)
- Sentiment: UK users wish more.
- Criticality: Weekly (UK). Effort: Heavy.

### 9.19 Quantity Merge (2 recipes both use onion)
- Competitors: AnyList (best), Plan to Eat, Samsung Food
- Sentiment: "Three recipes all use garlic — consolidate to 3 cloves" — loved.
- Criticality: Weekly. Effort: Medium.

### 9.20 Unit Normalization (cups vs grams in same list)
- Competitors: AnyList, Samsung Food (partial)
- Sentiment: Small but surprisingly loud pain point.
- Criticality: Weekly. Effort: Medium.

### 9.21 Favorite / Recurring Brands
- Competitors: AnyList
- Sentiment: "I always buy Fage Greek yogurt." Small delight.
- Criticality: Weekly. Effort: Cheap.

### 9.22 Price History / Best Time to Buy
- Competitors: Flipp (external)
- Sentiment: Nichie but power user love.
- Criticality: Edge. Effort: Heavy.

### 9.23 Shared Budget Limit
- Competitors: Listonic
- Sentiment: Couples love.
- Criticality: Weekly. Effort: Medium.

### 9.24 Meal Cost Estimation
- Competitors: Eat This Much, Plan to Eat (partial)
- Sentiment: "Tell me what this meal costs me."
- Criticality: Weekly. Effort: Medium.

---

## 10. STREAKS, GAMIFICATION, MOTIVATION

### 10.1 Daily Check-In Streak
- Competitors: Lose It!, Zero, Fastic, Yazio
- Sentiment: Loss-aversion powerful. r/fitness mocks empty streak features but dieters love them.
- Criticality: Daily. Effort: Cheap.

### 10.2 Badges / Achievements
- Competitors: Lose It!, FatSecret, Fastic, Zero
- Sentiment: Casual users love; power users ignore.
- Criticality: Daily (casuals). Effort: Cheap.

### 10.3 Streak Freeze / Pause
- Competitors: Duolingo-style; nutrition apps largely lack
- Sentiment: Universally requested. "I'm sick — don't punish me."
- Criticality: Weekly. Effort: Cheap.

### 10.4 Weekly Recap / Summary
- Competitors: MacroFactor (strongest), Cronometer, Lose It!, WW
- Sentiment: MacroFactor's "weekly coaching update" praised. "My favorite part of Sunday."
- Criticality: Weekly. Effort: Medium.

### 10.5 Progress Photos Side-by-Side
- Competitors: MacroFactor, Lose It!, WW
- Sentiment: Motivator. Privacy concerns noted.
- Criticality: Weekly. Effort: Medium.

### 10.6 Weight Loss Milestones (celebrate -5lb, -10lb)
- Competitors: Lose It!, MFP, Yazio
- Sentiment: "5lb badge made me cry" — real emotional wins.
- Criticality: Weekly. Effort: Cheap.

### 10.7 Leaderboards
- Competitors: FatSecret, Fastic
- Sentiment: Divisive. Some love, some hate competition.
- Criticality: Edge. Effort: Medium.

### 10.8 Challenges (30-day)
- Competitors: Fastic, FatSecret, WW
- Sentiment: New-year resolutioners love; lapse quickly.
- Criticality: Weekly. Effort: Medium.

### 10.9 Daily Motivational Message
- Competitors: Noom, WW, Lifesum
- Sentiment: Noom's messaging called "preachy" by many; loved by some.
- Criticality: Daily. Effort: Cheap.

### 10.10 Mood Tracking
- Competitors: Noom, Ultrahuman
- Sentiment: Mindful eaters love.
- Criticality: Daily. Effort: Cheap.

### 10.11 Habit Tracker (non-food)
- Competitors: Noom, WW
- Sentiment: Expands beyond food — loved by holistic users.
- Criticality: Daily. Effort: Medium.

### 10.12 Educational Content / Course
- Competitors: Noom (signature), WW, Fastic
- Sentiment: Noom's curriculum central to value prop; also main churn reason.
- Criticality: Daily. Effort: Heavy.

### 10.13 Coach Chat (AI or human)
- Competitors: Noom, WW, MyNetDiary, Welling
- Sentiment: Noom coaches called "generic" often. WW coaches mixed.
- Criticality: Weekly. Effort: Heavy.

### 10.14 Community Forum
- Competitors: FatSecret, MFP (old forum), Cronometer, Carb Manager
- Sentiment: MFP's was loved before redesign; now mourned. "They killed the community that kept me."
- Criticality: Weekly. Effort: Heavy.

### 10.15 Friends / Follow System
- Competitors: MFP (removed — complaint), FatSecret, Samsung Food
- Sentiment: MFP's newsfeed loss was "the straw that made me leave" — multiple reviews.
- Criticality: Weekly. Effort: Medium.

### 10.16 Non-Shaming Tone (no red numbers)
- Competitors: MacroFactor (explicitly)
- Sentiment: "No red warnings when I go over" — MacroFactor's stance praised by eating-disorder-recovery community.
- Criticality: Daily. Effort: Cheap.

### 10.17 Supportive Framing (vs Diet Shame)
- Competitors: MacroFactor, Cronometer, Foodnoms
- Sentiment: Recovery users actively avoid MFP, Noom for shame-y framing.
- Criticality: Daily. Effort: Cheap.

---

## 11. ONBOARDING

### 11.1 Photo-Based Goal Input (select target body)
- Competitors: Few trackers; common in aesthetic apps
- Sentiment: "A photo of what I want to look like" — emerging ask.
- Criticality: Onboarding. Effort: Medium.

### 11.2 Body Recomp vs Fat Loss vs Muscle Paths
- Competitors: MacroFactor, Carbon, Fitbod
- Sentiment: "Most apps only do weight loss" — complaint.
- Criticality: Onboarding. Effort: Medium.

### 11.3 Diet Preference Selection (keto, vegan, Med)
- Competitors: Mealime, PlateJoy, Samsung Food, Eat This Much, Carb Manager
- Sentiment: Mealime praised.
- Criticality: Onboarding. Effort: Cheap.

### 11.4 Allergen Selection
- Competitors: Mealime, PlateJoy (was), Samsung Food, Eat This Much
- Sentiment: Universal must.
- Criticality: Daily. Effort: Cheap.

### 11.5 Disliked Ingredients
- Competitors: Mealime, Yummly (was), Eat This Much
- Sentiment: Yummly's Taste Profile grieved. "I said I hate cilantro once and Yummly never forgot."
- Criticality: Daily. Effort: Medium.

### 11.6 Culture / Cuisine Preference
- Competitors: Samsung Food, Yazio
- Sentiment: Underserved in US apps; strong in Yazio for EU cuisines.
- Criticality: Weekly. Effort: Medium.

### 11.7 Budget Input
- Competitors: Eat This Much
- Sentiment: Niche but loved.
- Criticality: Onboarding. Effort: Cheap.

### 11.8 Cooking Skill Level
- Competitors: Mealime
- Sentiment: Beginner protection.
- Criticality: Onboarding. Effort: Cheap.

### 11.9 Household Size
- Competitors: Mealime, Plan to Eat, Eat This Much
- Sentiment: Shopping list scaling. Loved.
- Criticality: Onboarding. Effort: Cheap.

### 11.10 Activity Level
- Competitors: All trackers
- Sentiment: Generic; MacroFactor uses wearable data for better accuracy.
- Criticality: Onboarding. Effort: Cheap.

### 11.11 Goal Weight
- Competitors: All
- Sentiment: Standard.
- Criticality: Onboarding. Effort: Cheap.

### 11.12 Deadline / Target Date
- Competitors: Lose It!, MacroFactor
- Sentiment: MacroFactor derives rate of loss from deadline; loved.
- Criticality: Onboarding. Effort: Cheap.

### 11.13 Import from Existing App (MFP → us)
- Competitors: Cronometer (MFP import), Lose It!, MacroFactor
- Sentiment: "I'd switch if I didn't lose 5 years of data." Cronometer's import praised.
- Criticality: Onboarding. Effort: Heavy.

### 11.14 Apple Sign-In / Google Sign-In
- Competitors: Most modern apps
- Sentiment: Table stakes.
- Criticality: Onboarding. Effort: Cheap.

### 11.15 Progressive Disclosure (don't overwhelm)
- Competitors: MacroFactor
- Sentiment: Yazio's onboarding criticized for too many animations.
- Criticality: Onboarding. Effort: Medium.

### 11.16 Hard Paywall During Onboarding
- Competitors: Noom, Fastic, Yazio, WW
- Sentiment: HATED. "Can't even try the app before paying" — universal complaint.
- Criticality: Onboarding. Effort: Cheap.

### 11.17 Free Trial Without Credit Card
- Competitors: Plan to Eat (14 days no card), Paprika
- Sentiment: Plan to Eat: "No card needed" praised.
- Criticality: Onboarding. Effort: Cheap.

---

## 12. NOTIFICATIONS & REMINDERS

### 12.1 Meal Time Reminders
- Competitors: MFP, Lose It!, Yazio
- Sentiment: Useful when customized.
- Criticality: Daily. Effort: Cheap.

### 12.2 Custom Reminder Times (per meal)
- Competitors: MFP, Cronometer, Yazio
- Sentiment: "Let me set lunch at 12:30 not 12" — loved.
- Criticality: Daily. Effort: Cheap.

### 12.3 "Didn't Log Lunch?" Nudge
- Competitors: MFP, Foodnoms
- Sentiment: Gentle reminder praised; aggressive nag hated.
- Criticality: Daily. Effort: Cheap.

### 12.4 Fasting Window Notifications
- Competitors: Zero, Fastic
- Sentiment: Loved.
- Criticality: Daily. Effort: Cheap.

### 12.5 Hydration Reminders
- Competitors: WaterMinder, Waterllama, Lifesum
- Sentiment: Divisive. Some turn off.
- Criticality: Daily. Effort: Cheap.

### 12.6 Weigh-In Reminders
- Competitors: MacroFactor, Happy Scale, Lose It!
- Sentiment: Loved when gentle.
- Criticality: Daily. Effort: Cheap.

### 12.7 Smart Timing (learn when user logs)
- Competitors: MacroFactor
- Sentiment: "It nudges only at usual times" — delight.
- Criticality: Daily. Effort: Medium.

### 12.8 Snooze Reminder
- Competitors: Some via OS; nutrition apps weak
- Sentiment: "Snooze 30 min" requested.
- Criticality: Daily. Effort: Cheap.

### 12.9 Recipe Prep Reminder (marinate 4h ahead)
- Competitors: Paprika (via timers)
- Sentiment: Niche but loved.
- Criticality: Weekly. Effort: Medium.

### 12.10 Grocery Shop Day Reminder
- Competitors: AnyList, Plan to Eat
- Sentiment: Routine users love.
- Criticality: Weekly. Effort: Cheap.

### 12.11 Low Battery Fasting Warning
- Competitors: Zero (partial)
- Sentiment: "My fast lost 2 hours because app died."
- Criticality: Weekly. Effort: Cheap.

### 12.12 Streak Risk Warning ("don't lose your streak")
- Competitors: Zero, Fastic
- Sentiment: Loss-aversion driver.
- Criticality: Daily. Effort: Cheap.

### 12.13 Push Frequency Controls
- Competitors: All
- Sentiment: When missing, users rate 1-star for nagging.
- Criticality: Daily. Effort: Cheap.

### 12.14 Quiet Hours
- Competitors: Most apps (OS-level)
- Sentiment: Expected.
- Criticality: Daily. Effort: Cheap.

---

## 13. DATA / INTEGRATIONS

### 13.1 Apple Health Sync (in + out)
- Competitors: All major trackers
- Sentiment: MFP's sync flakiness widely complained. "Exercises from yesterday don't sync after midnight."
- Criticality: Daily. Effort: Medium.

### 13.2 Google Fit / Health Connect
- Competitors: MFP, MacroFactor, Yazio, Lifesum
- Sentiment: MFP's Google Fit nutrition sync reported broken (forum 10900891).
- Criticality: Daily. Effort: Medium.

### 13.3 Fitbit Integration
- Competitors: MFP (deep), Lose It!, Yazio
- Sentiment: Fitbit-Apple Health loops cause double-counting — complaint.
- Criticality: Daily. Effort: Medium.

### 13.4 Garmin Connect
- Competitors: MFP, Cronometer, MacroFactor
- Sentiment: Endurance athletes critical.
- Criticality: Daily (athletes). Effort: Medium.

### 13.5 Oura Ring
- Competitors: Cronometer, MacroFactor
- Sentiment: Wellness crowd love.
- Criticality: Daily. Effort: Medium.

### 13.6 Whoop
- Competitors: MacroFactor, Cronometer
- Sentiment: Performance crowd love.
- Criticality: Daily. Effort: Medium.

### 13.7 Withings Smart Scale
- Competitors: MFP, Cronometer, MacroFactor
- Sentiment: Auto-weigh loved.
- Criticality: Daily. Effort: Medium.

### 13.8 Samsung Health
- Competitors: Samsung Food, MFP, Yazio
- Sentiment: Korean/Asian market important.
- Criticality: Daily (region). Effort: Medium.

### 13.9 Ultrahuman / Levels CGM
- Competitors: Some emerging
- Sentiment: Wellness tech early adopters.
- Criticality: Daily. Effort: Medium.

### 13.10 MFP Import
- Competitors: Cronometer, MacroFactor, Lose It!
- Sentiment: Liberation feature. Heavily valued.
- Criticality: Onboarding. Effort: Heavy.

### 13.11 CSV Export
- Competitors: Cronometer, MacroFactor
- Sentiment: Data-privacy minded users love.
- Criticality: Edge. Effort: Cheap.

### 13.12 API Access
- Competitors: Cronometer (partial), Fitbit
- Sentiment: Power users love; niche.
- Criticality: Edge. Effort: Medium.

### 13.13 Apple Shortcuts Actions
- Competitors: Lose It!, Foodnoms, MyNetDiary
- Sentiment: Shortcuts power users love. "Log water with a tap from home screen."
- Criticality: Daily. Effort: Medium.

### 13.14 Zapier / IFTTT
- Competitors: Some wellness apps
- Sentiment: Niche but loved.
- Criticality: Edge. Effort: Medium.

### 13.15 Email Digest
- Competitors: MacroFactor (weekly email)
- Sentiment: Nice touch; some unsubscribe.
- Criticality: Weekly. Effort: Cheap.

### 13.16 Web Dashboard (full)
- Competitors: Cronometer, MFP, Plan to Eat, Samsung Food
- Sentiment: MacroFactor had no web for years — loud complaint eventually resolved.
- Criticality: Weekly. Effort: Heavy.

### 13.17 Real-Time Sync Across Devices
- Competitors: All major. Paprika's sync praised.
- Sentiment: Expected.
- Criticality: Daily. Effort: Medium.

### 13.18 Doctor / Dietitian Share Link
- Competitors: Cronometer Pro, MyNetDiary
- Sentiment: Clinical users require.
- Criticality: Weekly. Effort: Medium.

---

## 14. UI / UX SMALL QoL

### 14.1 Dark Mode
- Competitors: All
- Sentiment: Cronometer redesign's dark mode called "dull gray not dark enough" — complaint.
- Criticality: Daily. Effort: Cheap.

### 14.2 True Black (OLED)
- Competitors: Foodnoms
- Sentiment: Power users love.
- Criticality: Daily. Effort: Cheap.

### 14.3 Keep Screen On (recipe view)
- Competitors: Paprika, Samsung Food, NYT Cooking (unreliable)
- Sentiment: "Sticky hands don't want to tap" — Paprika wins.
- Criticality: Weekly. Effort: Cheap.

### 14.4 Haptic Feedback on Logging
- Competitors: Foodnoms, MacroFactor
- Sentiment: Small delight.
- Criticality: Daily. Effort: Cheap.

### 14.5 Sound on Barcode Scan
- Competitors: All
- Sentiment: Expected; complaints when missing.
- Criticality: Daily. Effort: Cheap.

### 14.6 Customizable Dashboard
- Competitors: Cronometer
- Sentiment: Power users love; Cronometer's redesign moving widgets caused backlash.
- Criticality: Daily. Effort: Medium.

### 14.7 Day View Swipe Between Days
- Competitors: All
- Sentiment: Expected gesture.
- Criticality: Daily. Effort: Cheap.

### 14.8 Week Start Day (Sun vs Mon)
- Competitors: MFP removed Monday — infamous complaint
- Sentiment: Mourned on MFP forums. Europe uses Monday by default.
- Criticality: Daily. Effort: Cheap.

### 14.9 Metric / Imperial Toggle
- Competitors: All
- Sentiment: Expected.
- Criticality: Daily. Effort: Cheap.

### 14.10 Mixed Units Per Field (kg for weight, lb for food)
- Competitors: Cronometer
- Sentiment: Mixed-metric users love.
- Criticality: Edge. Effort: Cheap.

### 14.11 Compact vs Expanded View Toggle
- Competitors: Cronometer
- Sentiment: "Redesign made entries too spaced out" — 2024 Cronometer complaint.
- Criticality: Daily. Effort: Cheap.

### 14.12 Stay-Awake on Fasting Screen
- Competitors: Zero
- Sentiment: Expected.
- Criticality: Daily. Effort: Cheap.

### 14.13 Pull to Refresh
- Competitors: All
- Sentiment: Expected gesture.
- Criticality: Daily. Effort: Cheap.

### 14.14 Tap Macros on Dashboard for Detail
- Competitors: Cronometer, MacroFactor
- Sentiment: Expected.
- Criticality: Daily. Effort: Cheap.

### 14.15 Chart Types (line, bar, donut)
- Competitors: Cronometer Gold
- Sentiment: Data nerds love.
- Criticality: Weekly. Effort: Medium.

### 14.16 Zoomable Charts
- Competitors: MacroFactor, Cronometer
- Sentiment: Historical view critical.
- Criticality: Weekly. Effort: Medium.

### 14.17 Show Remaining vs Total
- Competitors: MFP (remaining default), MacroFactor
- Sentiment: "Remaining" preferred for dieters.
- Criticality: Daily. Effort: Cheap.

### 14.18 Calories-Left Color Coding
- Competitors: MFP (red over goal — controversial)
- Sentiment: Recovery community hates red. MacroFactor explicitly avoids.
- Criticality: Daily. Effort: Cheap.

### 14.19 Icons vs Emojis in UI
- Competitors: Yazio uses emojis heavily
- Sentiment: Divisive.
- Criticality: Daily. Effort: Cheap.

### 14.20 Swipe Left to Delete / Right to Edit
- Competitors: All
- Sentiment: iOS standard.
- Criticality: Daily. Effort: Cheap.

### 14.21 Undo Toast
- Competitors: Foodnoms
- Sentiment: Loved.
- Criticality: Daily. Effort: Cheap.

### 14.22 Inline Macro Percentages
- Competitors: Cronometer, MacroFactor
- Sentiment: "Show 40/30/30 not just grams."
- Criticality: Daily. Effort: Cheap.

### 14.23 Accessibility: VoiceOver
- Competitors: Foodnoms (excellent), MFP (weak)
- Sentiment: Accessibility community mentions Foodnoms as standout.
- Criticality: Daily (niche). Effort: Medium.

### 14.24 Font Size Adjustment
- Competitors: iOS default; few customize
- Sentiment: Older users want.
- Criticality: Daily. Effort: Cheap.

### 14.25 Reduce Animations Toggle
- Competitors: iOS default
- Sentiment: Yazio's animations slammed.
- Criticality: Daily. Effort: Cheap.

### 14.26 Quick Edit Profile (weight + goal without full menu)
- Competitors: MacroFactor
- Sentiment: "One tap to update weight" — loved.
- Criticality: Daily. Effort: Cheap.

### 14.27 Tutorial Overlays for New Features
- Competitors: Most
- Sentiment: Unwanted by power users; opt-out.
- Criticality: Edge. Effort: Cheap.

### 14.28 Landscape Mode on Tablet
- Competitors: Paprika (excellent on iPad)
- Sentiment: Kitchen iPad users love.
- Criticality: Weekly. Effort: Medium.

### 14.29 Multi-Window (iPad split)
- Competitors: Paprika
- Sentiment: Niche but loved.
- Criticality: Edge. Effort: Medium.

### 14.30 Offline Recipe View
- Competitors: Paprika, Samsung Food, Plan to Eat
- Sentiment: "Kitchen has no WiFi" — must-have.
- Criticality: Weekly. Effort: Medium.

### 14.31 Favorite Quick Toggle (star at top of search)
- Competitors: MacroFactor
- Sentiment: Small delight.
- Criticality: Daily. Effort: Cheap.

---

## 15. SOCIAL / CREATORS

### 15.1 Follow Other Users
- Competitors: MFP (legacy), FatSecret, Samsung Food
- Sentiment: MFP's removal mourned.
- Criticality: Weekly. Effort: Medium.

### 15.2 Follow Creators / Dietitians
- Competitors: Samsung Food (emerging), Carbon
- Sentiment: Emerging category.
- Criticality: Weekly. Effort: Heavy.

### 15.3 Recipe Collections by Creator
- Competitors: Samsung Food, NYT Cooking
- Sentiment: "I save Melissa Clark's recipes" — NYT loyalty.
- Criticality: Weekly. Effort: Medium.

### 15.4 Share Plan Publicly
- Competitors: Samsung Food
- Sentiment: Early.
- Criticality: Edge. Effort: Medium.

### 15.5 Meal Photos / Food Feed
- Competitors: FatSecret, Samsung Food, Ate
- Sentiment: Photo-journaling loved by mindful eaters.
- Criticality: Weekly. Effort: Medium.

### 15.6 Comments on Recipes
- Competitors: NYT Cooking, AllRecipes, Samsung Food
- Sentiment: "Comments are the recipe" — AllRecipes, NYT signature.
- Criticality: Weekly. Effort: Medium.

### 15.7 Recipe Remix / Fork
- Competitors: Samsung Food (emerging)
- Sentiment: GitHub-style emerging.
- Criticality: Edge. Effort: Medium.

### 15.8 Share to WhatsApp / iMessage
- Competitors: Samsung Food, Paprika, Copy Me That
- Sentiment: Expected.
- Criticality: Weekly. Effort: Cheap.

### 15.9 QR Code for Recipe
- Competitors: Paprika, Samsung Food
- Sentiment: Small delight for print cookbooks/blogs.
- Criticality: Edge. Effort: Cheap.

### 15.10 Family Group
- Competitors: AnyList, Plan to Eat
- Sentiment: Shared household data loved.
- Criticality: Weekly. Effort: Medium.

### 15.11 Public Profile / Username
- Competitors: FatSecret, MFP (legacy), Samsung Food
- Sentiment: Introverts prefer private mode.
- Criticality: Edge. Effort: Medium.

### 15.12 Discussion Groups / Forums
- Competitors: FatSecret, Carb Manager, Fastic (toxic)
- Sentiment: Fastic's "chat room is toxic 90%" — 1-star reviews.
- Criticality: Weekly. Effort: Heavy.

---

## 16. WORKOUT / ACTIVITY LOGGING (cross-app learnings)

### 16.1 Strong-Style Fast Set Logging
- Competitors: Strong, Hevy, Fitbod
- Sentiment: "Get in, log, get out" — universal lifter praise.
- Criticality: Daily. Effort: Medium.

### 16.2 Rest Timer (auto-start after set)
- Competitors: Strong, Fitbod, Hevy
- Sentiment: "It auto-starts rest after tap" — loved.
- Criticality: Daily (lifters). Effort: Cheap.

### 16.3 Plate Math Calculator
- Competitors: Strong, Hevy
- Sentiment: "Tell me which plates = 185lb." Beloved.
- Criticality: Daily (lifters). Effort: Cheap.

### 16.4 PR History
- Competitors: Strong, Hevy, Fitbod
- Sentiment: Motivator.
- Criticality: Weekly. Effort: Cheap.

### 16.5 Equipment Profile (home gym vs full gym)
- Competitors: Fitbod
- Sentiment: "Home/travel profiles" — underrated feature.
- Criticality: Weekly. Effort: Medium.

### 16.6 Mobility / Warmup Integration
- Competitors: Fitbod
- Sentiment: Holistic lifters love.
- Criticality: Daily. Effort: Medium.

### 16.7 Recovery Heatmap (which muscles fresh)
- Competitors: Fitbod
- Sentiment: Data-driven training delight.
- Criticality: Daily. Effort: Medium.

### 16.8 Sleep Integration to Workouts
- Competitors: Whoop, Ultrahuman
- Sentiment: "Poor sleep → lighter workout recommended."
- Criticality: Daily. Effort: Medium.

---

## 17. PRIVACY / SAFETY / DATA

### 17.1 Private by Default
- Competitors: Cronometer, MacroFactor
- Sentiment: Eating-disorder-recovery community explicitly requires.
- Criticality: Daily. Effort: Cheap.

### 17.2 No Ads (Premium)
- Competitors: MFP Premium (but users report ads still appear!)
- Sentiment: Forum 10906338: "Pay for premium but seeing ads??" — class-action tier complaint.
- Criticality: Daily. Effort: Cheap.

### 17.3 Hide Calories (body-image protection)
- Competitors: Foodnoms, MacroFactor, Noom
- Sentiment: ED-recovery community wants "hide number" mode.
- Criticality: Daily. Effort: Cheap.

### 17.4 Delete Account / GDPR Export
- Competitors: Most
- Sentiment: Noom's "roach motel" lawsuits — cancellation friction.
- Criticality: Edge. Effort: Cheap.

### 17.5 Local-First Storage Option
- Competitors: Paprika (offline-first)
- Sentiment: Privacy crowd loves.
- Criticality: Edge. Effort: Heavy.

### 17.6 HealthKit Permissions Granularity
- Competitors: Apple-native
- Sentiment: "Only read weight, not heart rate" — iOS users expect.
- Criticality: Onboarding. Effort: Cheap.

### 17.7 Transparent Subscription Terms
- Competitors: Paprika (one-time buy praised)
- Sentiment: Noom lawsuit, Fastic, Yazio called out for dark patterns.
- Criticality: Onboarding. Effort: Cheap.

### 17.8 Cancel Without Friction
- Competitors: Paprika, Plan to Eat
- Sentiment: WW, Noom, Fastic get BBB complaints. Paprika's one-time fee bypasses.
- Criticality: Edge. Effort: Cheap.

### 17.9 Two-Factor Auth
- Competitors: Some; rare in nutrition
- Sentiment: Emerging ask post-MFP data breach (2018).
- Criticality: Edge. Effort: Medium.

---

## 18. MONETIZATION / PRICING COMPLAINTS (category-wide)

### 18.1 Free Tier Usefulness
- Competitors: Cronometer (best free), MacroFactor (none)
- Sentiment: "MFP free is now useless" — repeated. MacroFactor's no-free-tier criticized but understood.
- Criticality: Daily. Effort: N/A.

### 18.2 Annual vs Monthly
- Competitors: All offer both; MFP $19.99/mo or $79.99/yr
- Sentiment: "$79/yr is too much for what I get."
- Criticality: Weekly. Effort: N/A.

### 18.3 Family Plan
- Competitors: AnyList ($15 family), Plan to Eat
- Sentiment: Loved. Missing in MFP, MacroFactor.
- Criticality: Weekly. Effort: Cheap.

### 18.4 Lifetime / One-Time Buy
- Competitors: Paprika (per device)
- Sentiment: Paprika's model polarizing — some love no-subscription, others hate per-device pricing.
- Criticality: Onboarding. Effort: Cheap.

### 18.5 Student / Senior Discount
- Competitors: Few
- Sentiment: Emerging ask.
- Criticality: Edge. Effort: Cheap.

### 18.6 Trial Length
- Competitors: 7-day vs 14-day vs 30-day
- Sentiment: "7 days isn't enough to form a habit" — complaint.
- Criticality: Onboarding. Effort: Cheap.

### 18.7 Refund Policy
- Competitors: Cronometer "no refund via Apple" — 1-star source.
- Sentiment: Users blame app even if Apple policy.
- Criticality: Edge. Effort: Cheap.

### 18.8 Price Transparency on Upgrade
- Competitors: Yazio called out — hidden extras.
- Sentiment: "Surprise $99 charge" — legal risk.
- Criticality: Onboarding. Effort: Cheap.

---

## 19. METABOLIC / WEARABLE (Lumen, Ultrahuman)

### 19.1 Breath-Based Metabolic Reading
- Competitors: Lumen
- Sentiment: "Too sensitive to breathing technique" — users retake repeatedly.
- Criticality: Daily. Effort: Heavy (hardware).

### 19.2 Daily Carb/Fat Recommendation
- Competitors: Lumen
- Sentiment: "Morning reading tells me my day" — loved.
- Criticality: Daily. Effort: Medium.

### 19.3 Metabolic Score (0-100)
- Competitors: Ultrahuman, Lumen
- Sentiment: Simplified number; data nerds skeptical.
- Criticality: Daily. Effort: Medium.

### 19.4 CGM Integration + Food Tagging
- Competitors: Ultrahuman, Levels
- Sentiment: "See glucose spike from specific meal" — loved.
- Criticality: Daily. Effort: Heavy.

### 19.5 Heart Rate Variability Trend
- Competitors: Oura, Whoop, Ultrahuman
- Sentiment: Recovery crowd love.
- Criticality: Daily. Effort: Medium.

---

## 20. EMOTIONAL / HOLISTIC FEATURES

### 20.1 Mindful Eating Mode (slow down)
- Competitors: Noom, Ate app
- Sentiment: "Not everyone wants numbers" — Noom's distinctiveness.
- Criticality: Daily. Effort: Cheap.

### 20.2 Hunger / Fullness Scale Logging
- Competitors: Noom, Ate
- Sentiment: Intuitive eaters love.
- Criticality: Daily. Effort: Cheap.

### 20.3 Emotion-Pre-Meal Logging
- Competitors: Noom
- Sentiment: "Am I hungry or bored?" — useful.
- Criticality: Daily. Effort: Cheap.

### 20.4 Non-Calorie Goals (eat more veg)
- Competitors: WW Zero Points, Lifesum Life Score
- Sentiment: Shifts from numbers to behaviors.
- Criticality: Daily. Effort: Medium.

### 20.5 Positive Reinforcement Copy
- Competitors: MacroFactor (explicit), Foodnoms
- Sentiment: "No shame" praised; MFP's red numbers criticized.
- Criticality: Daily. Effort: Cheap.

---

## CROSS-CATEGORY MIGRATION PATTERNS

1. **MFP exodus 2022-2026** → Cronometer (accuracy), MacroFactor (adaptive coaching), Foodnoms (iOS-native polish). Trigger: barcode paywall (Oct 2022), then removal of Monday week start, ads in premium, removal of social features.
2. **Yummly shutdown (Dec 2024)** → Peel, Deglaze, Flavorish, Samsung Food, Paprika. Pain: no bulk export available pre-shutdown, users lost years of recipes. Opportunity: "Yummly importer" onboarding flow.
3. **PlateJoy shutdown (2025)** → Eat This Much, Mealime, Samsung Food. Pain: lost family meal plans.
4. **WW app redesign complaints** → Noom (same ballpark), Lose It!, Healthi (WW clone).
5. **Cronometer redesign backlash (2024)** → partial churn to MacroFactor, Foodnoms. Dark mode "dull gray," spacing too large, energy chart moved — users explicitly name these.
6. **Noom cancellation disputes** → WW, Healthi, Lose It!. BBB has 2300+ complaints about Noom subscription practices.
7. **Fastic chat toxicity** → Zero, Lifesum Fasting, DoFasting.
8. **Paprika per-device pricing resistance** → Samsung Food, Plan to Eat (both all-platform one price).

---

## TOP CROSS-APP "I WISH [APP] HAD X" REQUESTS (by frequency)

1. Copy meal to multiple days / entire week (universal)
2. Meal-level macro targets (very common)
3. Custom calorie goal without paying (MFP-specific but consistent)
4. Barcode scanning without paying (MFP-specific, resolved by switching)
5. Recipe URL import with accurate parsing (recipe manager gap + tracker gap)
6. Shopping list auto-merged from plan (cross-app)
7. Weekly macro average instead of daily (MacroFactor added after sustained user demand)
8. Fiber tracking visible on free tier (MFP complaint)
9. Voice / Siri entry (universal ask)
10. Apple Watch full logging (not just view)
11. Lock screen widget with remaining calories
12. Auto-detect fast start from last meal (fasting ↔ tracking integration)
13. Single app that does plan + track + shop (competitor intel conclusion)
14. "Hide calorie numbers" mode for recovery users
15. Home screen widget quick-add
16. Bulk export / portable data
17. Streak freeze for sick/holiday days
18. Pantry-aware recipe suggestions
19. Ingredient substitution suggestions
20. Meal reminders at custom (not fixed) times

---

## DIRECT QUOTE BANK (source-attributed)

- MFP paywall: "features that were previously free being moved behind subscriptions… MyFitnessPal's 2022 paywall changes are still regularly referenced as a cautionary example" (Hoot Fitness, 2025).
- MFP redesign: "frustrated users on Reddit call MyFitnessPal 'outdated,' 'ad-choked,' and 'paywalled to death'" (Hoot Fitness).
- MFP ads: "REMOVE ADS THAT HAVE SOUND… it's so annoying I'm looking for a different app" (MFP community forum 10872193).
- MFP premium + ads: "Pay for premium but seeing ads??" (forum 10911270).
- MFP copy removal: "Copy Previous Day's meals has disappeared from the Android app" (forum 10914258).
- Cronometer accuracy: "the most accurate database because it relies on verified sources like the USDA National Nutrient Database" (Cal AI comparison — Cal AI acquired by MyFitnessPal, Mar 2026).
- Cronometer 1-star: "manual text search takes 45+ seconds per meal" (App Store 1-star).
- Cronometer redesign: "dark mode not being dark enough (appearing as dull gray)… list spacing is way bigger so they end up scrolling forever" (App Store 2024).
- MacroFactor supportive framing: "you'll never see warnings, red numbers, or shaming when you go over your calorie or macro targets" (MacroFactor marketing, echoed in r/loseit reviews).
- MacroFactor adaptive: "MacroFactor starts with a population-based estimate, then recalculates weekly based on your logged calories and actual body weight changes" (efxsports.com review).
- Paprika: "The scaling feature has been surprisingly useful — easily scaling a dough recipe by 125% to make a larger pizza" (Paprika review).
- Paprika timers: "Timers are automatically detected in your directions: simply tap on one to start."
- Copy Me That: "Copy Me That takes all the garbage out and makes it fast and easy to read from busy websites."
- Copy Me That loyalty: "I love this app & used it daily for about 10 yrs" (App Store 2026).
- NYT Cooking: "Saving a recipe, then trying to move that recipe to a folder while in the recipe box tab unsaves the recipe" (UX critique).
- NYT Cooking: "the app refreshes back to the main landing page when the phone screen goes into rest mode."
- Yummly grief: "Yummly was different because of its Taste Profile… over time it got better at suggesting recipes users would actually cook" (MealThinker, 2025).
- Noom dark patterns: "multiple deceptive design practices… 'roach motel' where it's easy to sign up but almost impossible to leave" (BBB, 2300+ complaints).
- Fastic: "The chat room is toxic 90% of the time with no moderation."
- Fastic: "The app keeps making users set their goals over and over again if they haven't opened it in a few days."
- Yazio: "the app only allows for 4 meals" (Trustpilot).
- Yazio: "unnecessary animations that pop up when adding meals, making the app inconvenient."
- WW redesign: "everything takes more clicks than before, features are harder to find, and each update results in less ability to customize."
- AnyList: "changes made to a shared list show up instantly to everyone sharing the list."
- AnyList: "you can re-arrange categories to match your store's layout."
- Zero: "some premium subscribers note that the app removed coaching features that were the reason they purchased the premium subscription."
- Lumen: "the app is not set up to allow extended fasting, as it doesn't allow starting an overnight fast before 6 pm."
- Plan to Eat loyalty: "used the app for at least four years and it is the only thing they use to cook from anymore."
- Eat This Much: "getting the same meals multiple times per week even with variety settings maxed out."
- Eat This Much: "some days the sodium intake in meals recommended by Eat This Much could reach 9,800 mg, which exceeds the recommended sodium intake by more than four times."
- Fitbod: "one of the most underrated features is the ability to build multiple equipment profiles — for example, one for a home gym, one for a full setup, and one for hotel stays."

---

## SUPPR OPPORTUNITIES (synthesized)

1. **Single-app loop (plan → shop → log)** — competitor intel already identifies this as the category's great unmet need. No competitor ships all three at production quality.
2. **Recipe URL import with verified re-parsed nutrition** (not blog-provided) — distinctive vs Samsung Food, Paprika.
3. **Free barcode scanning + verified database** — direct MFP refugee opportunity.
4. **Monday week start and other small QoL MFP removed** — rebuild lost trust.
5. **Copy meal to multi-day and entire-week templates** — top recurring ask, cheap to build.
6. **Meal-level macro targets on free tier** — lifter-friendly, MFP paywalls this.
7. **Supportive tone (no red numbers, no shame)** — MacroFactor's angle, widen it.
8. **Add ingredient to imported recipe (post-import editing)** — table stakes we must do well.
9. **Auto-detect fast start from last logged meal** — bridge fasting ↔ tracking that nobody has smooth.
10. **Lock screen widget with remaining calories + fasting timer**.
11. **"Duplicate yesterday" + "Eat again" one-tap**.
12. **Shopping list with custom aisle order (steal AnyList)**.
13. **Pantry-aware recipe suggestions (steal SuperCook)**.
14. **Yummly refugee import flow** (export files, screenshots, photos).
15. **Apple Shortcuts first-class actions** (log water, log meal, start fast).
16. **Nutrient Oracle clone** (Cronometer Gold) on free tier for marketing.
17. **Streak freeze** for fasting / logging — simple, beloved.
18. **Non-shaming hide-numbers mode** — recovery community is vocal and loyal.
19. **Substitution suggestions with pantry awareness**.
20. **Verified food tier with green-check badge**.

---

## SUPPR RISKS (areas where users complain about competitors — we must not replicate)

1. Paywalling core tracking features (barcode, macros, week start).
2. Ads in paid tier.
3. Full-screen video ads with audio.
4. Loud animations in onboarding (Yazio pattern).
5. Hidden subscription renewal / hard cancellation (Noom lawsuit territory).
6. Forcing daily-only view when users prefer weekly average.
7. Inaccurate crowd-sourced database without verification tier.
8. Dark-mode that's "dull gray" not true dark (Cronometer 2024 mistake).
9. Removing beloved features in redesigns without migration path (MFP, Cronometer, WW).
10. Toxic unmoderated community chat (Fastic).
11. Per-device pricing (Paprika backlash).
12. Red numbers / shame copy when over calories.
13. 4-meal-slot limits (Yazio).
14. 7-day trials that are too short to build habit.
15. Data lock-in with no export.
16. Missing Monday start option.
17. App refreshing mid-recipe when phone screen rests (NYT Cooking pain).
18. Recipe box UX where saves unsave during folder moves (NYT pain).
19. Siri / Shortcuts absent (MFP pain).
20. Sync issues with Apple Health and Google Fit (MFP known issues).

---

## Sources

- [Why Users Are Switching from MyFitnessPal — Hoot Fitness](https://www.hootfitness.com/blog/why-users-are-switching-from-myfitnesspal-and-what-they-re-choosing-instead)
- [MyFitnessPal Barcode Scanner Paywall — Pocket-lint](https://www.pocket-lint.com/apps/news/162386-wow-myfitnesspal-put-its-popular-barcode-scanner-feature-behind-a-paywall/)
- [MFP Community: Copy Previous Day missing](https://community.myfitnesspal.com/en/discussion/10914258/copy-previous-days-meals-has-disappeared-from-the-android-app)
- [MFP Community: Copy and Save missing](https://community.myfitnesspal.com/en/discussion/10952472/copy-and-save-meals-feature-are-missing)
- [MFP Community: Ads with sound](https://community.myfitnesspal.com/en/discussion/10872193/remove-ads-that-have-sound)
- [MFP Community: Premium ads](https://community.myfitnesspal.com/en/discussion/10911270/pay-for-premium-but-seeing-ads)
- [MFP Community: Siri Shortcuts request](https://community.myfitnesspal.com/en/discussion/10892050/siri-shortcuts-integration-for-easy-food-entry-in-myfitnesspal)
- [MacroFactor vs MFP vs Cronometer — Cal AI](https://www.calai.app/blog/macrofactor-vs-cronometer) *(Cal AI acquired by MyFitnessPal, Mar 2026)*
- [MacroFactor v3 Expenditure Algorithm](https://macrofactor.com/expenditure-v3/)
- [MacroFactor help: Carb cycling stance](https://help.macrofactorapp.com/en/articles/30-does-macrofactor-support-refeeds-diet-breaks-or-carb-cycling)
- [Cronometer Reviews — Calorie-Trackers](https://calorie-trackers.com/reviews/cronometer/)
- [Cronometer App Store Reviews](https://apps.apple.com/us/app/cronometer-calorie-counter/id1145935738?see-all=reviews)
- [Cronometer Quick Add forum](https://forums.cronometer.com/discussion/5534/quickly-add-just-a-calorie-count-to-diary)
- [Paprika Review — Plan to Eat](https://www.plantoeat.com/blog/2023/07/paprika-app-review-pros-and-cons/)
- [Plan to Eat App](https://www.plantoeat.com/)
- [Copy Me That](https://www.copymethat.com/)
- [Samsung Food Review — Plan to Eat](https://www.plantoeat.com/blog/2026/01/samsung-food-review-pros-and-cons/)
- [NYT Cooking Design Critique — Pratt](https://ixd.prattsi.org/2025/02/design-critique-nyt-cooking-mobile-app/)
- [Yummly Alternatives — MealThinker](https://mealthinker.com/blog/yummly-alternative)
- [Yummly Shutdown — Plan to Eat](https://www.plantoeat.com/blog/2024/12/yummly-is-closing-discover-the-best-meal-planning-alternative/)
- [Mealime Review — Plan to Eat](https://www.plantoeat.com/blog/2023/04/mealime-app-review-pros-and-cons/)
- [Eat This Much Review — Plan to Eat](https://www.plantoeat.com/blog/2023/10/eat-this-much-app-review-pros-and-cons/)
- [Lose It vs MFP — SnapCalorie](https://www.snapcalorie.com/blog/lose-it-vs-myfitnesspal-which-app-is-right-for-you.html)
- [Yazio Trustpilot](https://www.trustpilot.com/review/yazio.com)
- [Yazio Kimola Insights](https://kimola.com/reports/unlock-insights-yazio-app-customer-feedback-report-google-play-151936)
- [Lifesum Trustpilot](https://www.trustpilot.com/review/lifesum.com)
- [Lifesum Review — FeastGood](https://feastgood.com/lifesum-review/)
- [FatSecret Review — Invastor](https://www.invastor.com/blog/41671-fatsecret-review-the-most-underrated-diet-app/)
- [Carb Manager Features](https://www.carbmanager.com/feature-summary/)
- [Carb Manager App Store Reviews](https://apps.apple.com/us/app/carb-manager-keto-diet-tracker/id410089731)
- [Noom Dark Psychology — Untrapped](https://untrapped.com.au/a-psychologist-reviews-the-dark-psychology-of-noom-part-1/)
- [Noom Consumer Affairs](https://www.consumeraffairs.com/health/noom.html)
- [WW App Review — Consumer Affairs](https://www.consumeraffairs.com/nutrition/weight_watchers.html)
- [Zero App Review — Fastingapps](https://fastingapps.com/zero-fasting-review/)
- [Fastic Trustpilot](https://www.trustpilot.com/review/fastic.com)
- [Lumen Review — Innerbody](https://www.innerbody.com/lumen-review)
- [Lumen Tom's Guide](https://www.tomsguide.com/reviews/lumen)
- [Ultrahuman Ring Review — TechCrunch](https://techcrunch.com/2023/08/10/ultrahuman-ring-air-review/)
- [Fitbod 5 Underrated Features](https://fitbod.me/blog/5-fitbod-features-most-reviews-overlook-but-real-users-love/)
- [Strong App Testimonials](https://www.strong.app/love)
- [AnyList Features](https://www.anylist.com/features)
- [PlateJoy Healthline Review](https://www.healthline.com/nutrition/platejoy)
- [AllRecipes Sitejabber Reviews](https://www.sitejabber.com/reviews/allrecipes.com)
- [BBC Good Food Trustpilot](https://www.trustpilot.com/review/www.bbcgoodfood.com)
- [Cronometer Gold Features](https://cronometer.com/gold/index.html)
- [Cooklist on App Store](https://apps.apple.com/us/app/cooklist-pantry-meals-recipes/id1352600944)

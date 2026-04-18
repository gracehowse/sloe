# Competitor Feature Catalog — Feature Scout

Date: 2026-04-17
Scope: Exhaustive atomic-feature enumeration across ~30 competitors (tracking, recipe, creator, fasting, metabolic, adjacent UX), calibrated against the current Suppr codebase (`apps/web`, `apps/mobile`). Ranked for inclusion.

**Calibration basis (Suppr current state, from repo scan):**
- Mobile tabs: Today / Discover / Plan / Progress / Profile (+ hidden Library, Search, Barcode, Notifications, Settings)
- Mobile screens present: `fasting.tsx`, `weight-tracker.tsx`, `health-sync.tsx`, `cook.tsx`, `paywall.tsx`, `onboarding.tsx`, `import-shared.tsx`, `macro-detail.tsx`, `burn-detail.tsx`, `meal-nutrition.tsx`, `nutrition-sources.tsx`, `progress-metric.tsx`, `create-recipe.tsx`, `recipe/[id]`, `recipe/verify`, `notifications-prompt`
- Web: App Router with `/recipe/[id]`, `/pricing`, `/onboarding`, `/fasting`, `/roadmap`, plus in-app `NutritionTracker`, `MealPlanner`, `ShoppingList`, `RecipeDetail`, `RecipeUpload`, `FoodSearch`, `CookMode`, `DiscoverFeed`, `FastingTimer`, `HouseholdPanel`, `TodayAtAGlance`, `FirstRunChecklist`, `NotificationsCenter`
- Already built: barcode scanner, recipe URL import, cook mode, meal plan algo (P/C/F bands, 0.5x–2x portions, swap), shopping list, CSV export (`exportNutritionCsv.ts`), logging streak (`computeLoggingStreak`), fiber+water goals in profile, Apple Health sync (`healthSync.ts`, `exportDayToHealth`), weight projection, adaptive TDEE foundation (`refreshAdaptiveTdeeForUser`, `/api/nutrition/adaptive-tdee`), fasting timer, household panel, week summary modes, journal date picker, food search modal, meal nutrition detail, import-shared (TikTok/IG), Apple Sign-In, Stripe/IAP paywall UI, dark mode, notifications prefs.
- Not yet built / partial: meal templates/"saved meals", copy-meal-to-day, duplicate day, partial recipe log (1/3), photo AI log (research only), voice log (hinted), widget, Siri/Shortcuts, Apple Watch app, pantry, progress photos, body measurements beyond weight, custom foods with multiple serving sizes, drag-drop planner, weekly recap card, carb/protein/fat cycling, refeed days, caffeine/alcohol trackers, notes per logged meal, photo on log entry, ingredient swap in plan, recipe rating/notes, pending meal queue.

**Legend**
- Status: HAVE / PARTIAL / MISSING / N-A (not applicable)
- Effort: S (<1w) / M (1–4w) / L (>4w)
- Rec: INCLUDE NOW / INCLUDE LATER / SKIP
- Priority: 1 (low) – 5 (urgent)

---

## 1. LOGGING

| # | Feature | Competitors | User problem | Frequency | Status | Effort | Rec | Priority |
|---|---|---|---|---|---|---|---|---|
| L1 | Barcode scan (camera) | MFP(paid), LoseIt, Crono, MacroF, FatSecret, Yazio, CarbM | Fast packaged-food entry | Daily | HAVE | — | — | — |
| L2 | Barcode scan via watch | LoseIt | Hands-free scan | Weekly | MISSING | L | LATER | 2 |
| L3 | Manual food search (text) | All | Core entry path | Daily | HAVE | — | — | — |
| L4 | Branded/restaurant search | MFP, LoseIt, FatSecret | Eating out | Weekly | PARTIAL | M | NOW | 4 |
| L5 | AI photo logging (single food) | MFP, LoseIt, Crono, MacroF, Yazio, Cal AI, PlateLens, SnapCalorie | "Just snap it" | Daily | MISSING | L | NOW (Pro) | 5 |
| L6 | AI photo logging (multi-item plate) | Cal AI, PlateLens, MacroF | Full plate snap | Daily | MISSING | L | LATER | 4 |
| L7 | Voice logging (natural language) | MFP, LoseIt, FatSecret, FoodNoms | "200g chicken and rice" | Daily | PARTIAL (hint) | M | NOW | 5 |
| L8 | Quick-add calories only | MFP, LoseIt, Crono | Log without searching | Weekly | PARTIAL | S | NOW | 4 |
| L9 | Quick-add macros only (no food) | MFP, MacroF | Post-hoc adjust | Weekly | MISSING | S | NOW | 4 |
| L10 | "Eat again" from recent history | MacroF, LoseIt | Re-log breakfast fast | Daily | PARTIAL | S | NOW | 5 |
| L11 | Frequent foods shortcut | MFP, MacroF, Crono | Top-N most logged | Daily | MISSING | S | NOW | 5 |
| L12 | Favorites / starred foods | All majors | Curated quick list | Daily | MISSING | S | NOW | 4 |
| L13 | Copy meal slot to another day | MFP, LoseIt, Crono, Yazio | "Same breakfast tomorrow" | Weekly | MISSING | S | NOW | 5 |
| L14 | Copy meal slot to another meal (lunch→dinner) | Crono, LoseIt | Leftovers | Weekly | MISSING | S | NOW | 4 |
| L15 | Duplicate entire day to another date | LoseIt, Crono, Yazio | Meal-prep weeks | Weekly | MISSING | S | NOW | 5 |
| L16 | Copy across multiple dates at once | Crono, PlanToEat | Meal-prep 5x same lunch | Weekly | MISSING | S | NOW | 4 |
| L17 | Paste same food into N upcoming days | PlanToEat | Batch plan | Weekly | MISSING | S | LATER | 3 |
| L18 | Partial serving slider (0.25 / 0.5 / 1.5) | MFP, Crono, MacroF | "Half a sandwich" | Daily | PARTIAL (0.5–2x in planner) | S | NOW | 5 |
| L19 | Numeric portion input (e.g., 1.37 servings) | Crono, MacroF | Precise macro trackers | Weekly | PARTIAL | S | NOW | 4 |
| L20 | Gram-based portion entry | All | Weighed cooking | Daily | HAVE | — | — | — |
| L21 | Household unit entry (cup, tbsp, slice) | MFP, Crono | "2 slices bread" | Daily | PARTIAL | M | NOW | 4 |
| L22 | Log partial recipe (1/3 of pot) | Crono, MacroF | Large-batch cooking | Weekly | MISSING | S | NOW | 5 |
| L23 | Log recipe "as cooked" (cooked weight) | Crono | Rice-cooks-down math | Weekly | MISSING | M | LATER | 3 |
| L24 | Notes per logged meal | Crono, MacroF | "Too salty" memory | Weekly | MISSING | S | NOW | 3 |
| L25 | Photo attached to logged meal | MFP, LoseIt Snap It, Noom | Visual journal | Weekly | MISSING | M | LATER | 3 |
| L26 | Meal timestamp (time of day) | MFP, Crono, Yazio, Zero | Fasting window, habits | Daily | HAVE (setting) | — | — | — |
| L27 | Location attached to meal | MFP (old) | Restaurant memory | Monthly | MISSING | M | SKIP | 1 |
| L28 | Mood/hunger rating per meal | Noom, Lifesum | Emotional eating | Daily | MISSING | S | LATER | 2 |
| L29 | "I ate out" flag | LoseIt, Noom | Accuracy self-disclosure | Weekly | MISSING | S | LATER | 2 |
| L30 | Custom meal slots (5th, 6th) | MFP, Crono, MacroF | 5+ meals/day | Daily | HAVE | — | — | — |
| L31 | Rename meal slots ("Pre-workout") | Crono, MacroF | Personalisation | Once | HAVE (toggle) | — | — | — |
| L32 | Drag meal item between slots | LoseIt, Yazio | Fix mis-slot | Weekly | MISSING | M | NOW | 4 |
| L33 | Reorder meal items within a slot | Crono | Narrative order | Weekly | MISSING | S | LATER | 2 |
| L34 | Swipe to delete log item | MFP, LoseIt | Fast cleanup | Daily | HAVE | — | — | — |
| L35 | Undo delete (toast) | LoseIt, MacroF | Fat-finger recovery | Weekly | MISSING | S | NOW | 4 |
| L36 | Bulk delete multiple items | Crono | Clean bad day | Monthly | MISSING | S | LATER | 2 |
| L37 | "Clear today" nuclear button | MacroF | Fresh-start trackers | Monthly | MISSING | S | LATER | 2 |
| L38 | Cross-day drag (move to yesterday) | Yazio | Mis-dated entry fix | Weekly | MISSING | M | LATER | 3 |
| L39 | Edit past-day entries | All | "Forgot to log lunch" | Daily | HAVE | — | — | — |
| L40 | Backdate log to historical date | MFP, Crono | Catch up week | Weekly | HAVE | — | — | — |
| L41 | "Scan receipt" for grocery/restaurant | FoodNoms | Bulk post-shop log | Monthly | MISSING | L | SKIP | 1 |
| L42 | Restaurant menu scan/OCR | None mainstream | Menu-board OCR | Rare | MISSING | L | SKIP | 1 |
| L43 | Paste label text → macros | MacroF | Nutrition label OCR | Weekly | MISSING | M | LATER | 3 |
| L44 | Nutrition label photo OCR | Cal AI, SnapCalorie | Packaged no-barcode | Weekly | MISSING | L | LATER | 3 |
| L45 | Pending meal queue (log later) | LoseIt "save for later" | Log mid-meal guilt | Weekly | MISSING | S | LATER | 2 |
| L46 | Offline log with auto-sync | MFP, MacroF | Gym basement, plane | Daily | PARTIAL | M | NOW | 4 |
| L47 | Search autocomplete with recent bias | MFP, Crono | Faster repeat search | Daily | PARTIAL | S | NOW | 4 |
| L48 | "Similar foods" suggestions on log | MacroF | Swap to hit macro | Weekly | MISSING | M | LATER | 3 |
| L49 | Log by typing into a single text field (parser) | MacroF | Power-user fast entry | Daily | MISSING | M | LATER | 3 |
| L50 | Double-tap repeat previous entry | Notion-inspired | Muscle-memory speed | Daily | MISSING | S | NOW | 3 |

## 2. RECIPES

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| R1 | Import from URL (JSON-LD) | Crono, Paprika, Plan2Eat, Whisk | Save blog recipes | Weekly | HAVE | — | — | — |
| R2 | Import from Instagram caption | Whisk, (none mainstream) | Creator feed | Weekly | HAVE | — | — | — |
| R3 | Import from TikTok caption | None | Viral recipes | Weekly | HAVE | — | — | — |
| R4 | Import from Pinterest | Paprika, Plan2Eat | Pin migration | Weekly | PARTIAL | M | LATER | 3 |
| R5 | Import from YouTube description | None | Cooking channels | Weekly | MISSING | M | LATER | 2 |
| R6 | Browser extension / share sheet clipper | Paprika, Whisk, Plan2Eat, Crono | One-click from any site | Daily | PARTIAL (share) | M | NOW | 5 |
| R7 | Email-a-recipe to inbox address | Plan2Eat, Paprika | Forward newsletters | Weekly | MISSING | M | LATER | 2 |
| R8 | Manual recipe creation | All | Grandma's recipe | Weekly | HAVE | — | — | — |
| R9 | Recipe scaling (servings N→M) | Paprika, Crono, MFP | Cook for 2 vs 4 | Weekly | HAVE (portion multiplier) | — | — | — |
| R10 | Unit-aware scaling (1 egg stays 1 egg) | Paprika | Smart scaling | Weekly | PARTIAL | M | LATER | 3 |
| R11 | Unit conversion (cups↔g) | Paprika, Crono | Cross-cultural | Weekly | PARTIAL | M | NOW | 4 |
| R12 | Per-ingredient nutrition display | Crono, MacroF | "Is olive oil the problem?" | Weekly | HAVE | — | — | — |
| R13 | Ingredient swap in recipe | MacroF, Mealime | "No cilantro" | Weekly | MISSING | M | NOW | 4 |
| R14 | Add extra ingredient to imported recipe | Paprika, Plan2Eat | "I also added cheese" | Weekly | PARTIAL | S | NOW | 5 |
| R15 | Remove ingredient from imported recipe | Paprika, Crono | Skip olives | Weekly | PARTIAL | S | NOW | 4 |
| R16 | Per-ingredient quantity override | Crono | Used half the onion | Weekly | PARTIAL | S | NOW | 4 |
| R17 | Multiple serving sizes for same recipe | Crono | "Small bowl vs big" | Weekly | MISSING | M | NOW | 4 |
| R18 | Recipe yield vs serving distinction | Crono, Paprika | Meal-prep accuracy | Weekly | PARTIAL | S | NOW | 3 |
| R19 | "As cooked" weight entry | Crono | Evaporation loss | Monthly | MISSING | M | LATER | 2 |
| R20 | Step-by-step cook mode | Mealime, NYTCooking, Paprika | Screen-on cooking | Daily | HAVE | — | — | — |
| R21 | Voice-controlled cook mode | NYTCooking, Kitchen Stories | Greasy hands | Daily | MISSING | M | LATER | 3 |
| R22 | Hands-free scroll (tilt/wave) | Kitchen Stories | Messy hands | Daily | MISSING | L | SKIP | 1 |
| R23 | Recipe timer (inline step) | Paprika, Mealime, NYTCooking | Multi-timer cooking | Daily | MISSING | S | NOW | 4 |
| R24 | Multiple simultaneous timers | NYTCooking | Braising + roasting | Weekly | MISSING | M | LATER | 3 |
| R25 | Screen-stays-awake in cook mode | Mealime, Paprika | Screen-off annoyance | Daily | PARTIAL | S | NOW | 4 |
| R26 | Ingredient checklist during cook | Paprika | "Did I add salt?" | Weekly | MISSING | S | NOW | 3 |
| R27 | Recipe rating (stars) | Paprika, Plan2Eat, AllRecipes | Sort by best | Monthly | MISSING | S | NOW | 4 |
| R28 | Recipe notes (personal) | Paprika, Plan2Eat, Crono | "Less salt next time" | Weekly | MISSING | S | NOW | 5 |
| R29 | Cooked-on date history | Paprika, Plan2Eat | "When did I last make this?" | Monthly | MISSING | S | LATER | 3 |
| R30 | "Made it" button (tracks count) | AllRecipes, Plan2Eat | Favorites by use | Monthly | MISSING | S | LATER | 3 |
| R31 | Recipe tags (custom) | Paprika, Plan2Eat | Personal taxonomy | Monthly | PARTIAL | S | NOW | 3 |
| R32 | Recipe categories (preset) | All | Breakfast/dinner | Daily | HAVE | — | — | — |
| R33 | Recipe difficulty label | Mealime, BBC Good Food | Beginner filter | Weekly | MISSING | S | LATER | 2 |
| R34 | Total time + active time split | NYTCooking, Mealime | "Pure hands-on" | Weekly | PARTIAL | S | LATER | 3 |
| R35 | Equipment list | NYTCooking | "Need a food processor?" | Weekly | MISSING | S | LATER | 2 |
| R36 | Photo gallery per recipe | Paprika | Multi-angle | Weekly | PARTIAL | S | LATER | 2 |
| R37 | User photo upload to their copy | AllRecipes, NYT | "My version" | Monthly | MISSING | M | LATER | 2 |
| R38 | Recipe PDF / print view | Paprika, Plan2Eat | Old-school kitchen | Monthly | MISSING | S | LATER | 2 |
| R39 | Offline recipe access | Paprika | No-wifi cooking | Daily | PARTIAL | M | NOW | 4 |
| R40 | Recipe folders/collections | Paprika, Plan2Eat, Whisk | Organise library | Weekly | PARTIAL | M | NOW | 4 |
| R41 | Nested folders | Paprika (windows) | Power cooks | Monthly | MISSING | M | LATER | 2 |
| R42 | Recipe search within library | Paprika, Plan2Eat | "Chicken recipes I saved" | Weekly | PARTIAL | S | NOW | 4 |
| R43 | Ingredient-based search | Paprika | "What uses leek?" | Weekly | MISSING | M | NOW | 4 |
| R44 | Dietary tag filter (vegan/gf/etc) | Yummly, Mealime, BBC Good Food | Constraint cooks | Weekly | PARTIAL (roadmap) | M | NOW | 5 |
| R45 | Allergen warnings on recipe | Yummly, Mealime, Yazio | Safety | Weekly | PARTIAL | M | NOW | 5 |
| R46 | Nutrition per serving header | Crono, MFP, Yazio | Scan at glance | Daily | HAVE | — | — | — |
| R47 | Nutrition density badge (cal/g) | Crono | Volume eaters | Weekly | MISSING | S | LATER | 2 |
| R48 | Protein-per-$ calculation | None | Budget lifters | Weekly | MISSING | L | SKIP | 1 |
| R49 | Recipe variations / alternate versions | None well | "Dairy-free version" | Monthly | MISSING | M | LATER | 2 |
| R50 | Fork / remix recipe | None mainstream | Creator loop | Monthly | MISSING | M | LATER | 3 |
| R51 | Share recipe via link | Paprika, Whisk, NYT | Send to friend | Weekly | PARTIAL | S | NOW | 4 |
| R52 | Import someone else's shared recipe | Paprika, Plan2Eat | Friend loop | Weekly | PARTIAL | S | NOW | 3 |
| R53 | "Made from this" recipe provenance | None | Chain of forks | Rare | MISSING | M | SKIP | 1 |
| R54 | Cross-link similar recipes | Yummly | Discovery | Monthly | MISSING | M | LATER | 2 |
| R55 | Nutrition per 100g view | Crono, Yazio | EU labels | Weekly | MISSING | S | NOW | 3 |
| R56 | Per-macro ingredient contribution bar | Crono | "What drove protein?" | Weekly | PARTIAL | S | NOW | 3 |
| R57 | Recipe confidence / verification badge | Suppr (unique) | Trust | Daily | HAVE | — | — | — |
| R58 | Ingredient source badge (USDA/OFF) | Crono | Credibility | Daily | HAVE | — | — | — |
| R59 | Re-verify ingredients on demand | Suppr unique | Updated DB | Monthly | HAVE | — | — | — |
| R60 | Cooking video embed | NYT, Tasty, Kitchen Stories | Visual learners | Weekly | MISSING | M | LATER | 3 |

## 3. MEAL PLANNING

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| MP1 | Auto-generate daily plan | EatThisMuch, MFP+, Yazio | Decision fatigue | Daily | HAVE | — | — | — |
| MP2 | Auto-generate weekly plan | EatThisMuch, PlateJoy, Mealime | Meal prep | Weekly | HAVE | — | — | — |
| MP3 | Macro-aware generation | EatThisMuch, Yazio | Hit targets | Daily | HAVE | — | — | — |
| MP4 | Slot toggle (no-breakfast etc.) | EatThisMuch, Yazio | Skip meals | Once | HAVE | — | — | — |
| MP5 | Portion scale 0.5x–2x in plan | Yazio | Fit targets | Daily | HAVE | — | — | — |
| MP6 | Swap single meal (regenerate one) | EatThisMuch, Yazio, Mealime | Don't like Monday dinner | Daily | HAVE | — | — | — |
| MP7 | Lock/pin a planned meal | EatThisMuch, PlanToEat | "Keep Sunday roast" | Weekly | MISSING | S | NOW | 4 |
| MP8 | Drag-drop meal across days | PlanToEat, Notion-style | Flexible planning | Weekly | MISSING | M | NOW | 5 |
| MP9 | Copy plan week to next week | PlanToEat | Meal-prep routine | Weekly | MISSING | S | NOW | 5 |
| MP10 | Rotate / shuffle saved plans | PlanToEat | 4-week rotation | Weekly | MISSING | M | LATER | 3 |
| MP11 | Save plan as template | PlanToEat | Reusable week | Weekly | MISSING | M | NOW | 4 |
| MP12 | Named plan templates ("Bulk week") | PlanToEat | Season switch | Monthly | MISSING | M | LATER | 3 |
| MP13 | Plan calendar view (month) | PlanToEat, Paprika | Holiday view | Weekly | PARTIAL | M | LATER | 3 |
| MP14 | List view of week | PlanToEat | Text-first | Weekly | HAVE | — | — | — |
| MP15 | Leftovers logic (plan yields 2 days) | EatThisMuch, PlanToEat | Cook once eat twice | Weekly | MISSING | M | NOW | 5 |
| MP16 | Pantry-aware plan (use what you have) | EatThisMuch, Paprika | Reduce waste | Weekly | MISSING | L | LATER | 3 |
| MP17 | Budget-constrained plan | None mainstream | Students | Weekly | MISSING | L | SKIP | 1 |
| MP18 | Time-constrained plan ("<30min") | Mealime, EatThisMuch | Busy weeknights | Weekly | MISSING | M | LATER | 3 |
| MP19 | Diet-specific plan (keto, vegan) | EatThisMuch, PlateJoy, Mealime | Dietary rules | Monthly | PARTIAL | M | NOW | 4 |
| MP20 | Allergen-safe plan | PlateJoy, Mealime | Allergies | Monthly | PARTIAL (roadmap) | M | NOW | 5 |
| MP21 | Meal-prep mode (batch same lunch) | PlanToEat, MFP+ | Sunday prep | Weekly | MISSING | M | NOW | 4 |
| MP22 | Plan from saved library only | Suppr unique | Personal rotation | Weekly | HAVE | — | — | — |
| MP23 | Plan from discover+library mix | EatThisMuch | Expand variety | Weekly | HAVE (partial) | — | — | — |
| MP24 | "Plan my dinners only" slice | PlanToEat | Partial planning | Weekly | MISSING | S | NOW | 4 |
| MP25 | Shared household plan | PlateJoy (partner) | Couple cooking | Weekly | PARTIAL (Household panel) | L | LATER | 4 |
| MP26 | Partner sync (your/their slots) | None well | Multi-macro household | Weekly | MISSING | L | LATER | 3 |
| MP27 | Log planned meal with one tap | Yazio, EatThisMuch | Close the loop | Daily | HAVE | — | — | — |
| MP28 | Mark planned meal as skipped | PlanToEat | Didn't cook | Weekly | MISSING | S | NOW | 3 |
| MP29 | "I ate something else" swap-on-log | Yazio | Reality-plan divergence | Daily | MISSING | S | NOW | 4 |
| MP30 | Remaining-macros after planned meals | MacroF, Carbon | Room-for-snack math | Daily | MISSING | S | NOW | 5 |
| MP31 | Plan vs actual day overlay | MacroF | Adherence view | Daily | MISSING | M | LATER | 3 |
| MP32 | Per-day macro target override | MacroF weekly cycling | High/low days | Weekly | MISSING | M | LATER | 3 |
| MP33 | Weekly calorie bank (zigzag) | LoseIt+, MacroF | Flexible week | Weekly | MISSING | M | LATER | 3 |
| MP34 | Refeed day insertion | MacroF | Diet breaks | Monthly | MISSING | M | SKIP | 1 |
| MP35 | Holiday "maintenance mode" | None well | Thanksgiving | Rare | MISSING | M | LATER | 2 |
| MP36 | Plan history / archive | PlanToEat | Review past weeks | Monthly | MISSING | S | LATER | 2 |
| MP37 | Duplicate single day | LoseIt | Monday=Tuesday | Weekly | MISSING | S | NOW | 5 |
| MP38 | Plan-by-constraints ("high-protein") | EatThisMuch | Goal-centric | Monthly | PARTIAL | S | NOW | 3 |
| MP39 | Exclude recipe from auto-gen | EatThisMuch | "Never suggest tofu" | Monthly | MISSING | S | NOW | 3 |
| MP40 | Exclude ingredient globally | EatThisMuch, Yazio | Dislikes | Once | PARTIAL | S | NOW | 4 |
| MP41 | Seasonality preference | None well | Summer vs winter | Monthly | MISSING | L | SKIP | 1 |
| MP42 | Plan printed/exportable | PlanToEat, Paprika | Fridge printout | Monthly | MISSING | S | LATER | 2 |
| MP43 | Plan share to partner via link | PlanToEat | Collab | Weekly | MISSING | M | LATER | 3 |
| MP44 | Plan notes (e.g., "thaw chicken Sun") | PlanToEat | Prep reminders | Weekly | MISSING | S | LATER | 3 |
| MP45 | Meal prep checklist | EatThisMuch, PlanToEat | Batch workflow | Weekly | MISSING | M | LATER | 3 |

## 4. SHOPPING / PANTRY

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| S1 | Auto-list from plan | EatThisMuch, Mealime, Paprika | Close loop | Weekly | HAVE | — | — | — |
| S2 | Aisle / category grouping | Mealime, Paprika, MFP+ | Store flow | Weekly | HAVE | — | — | — |
| S3 | Custom category/aisle rename | Paprika | Local stores | Monthly | MISSING | S | LATER | 2 |
| S4 | Per-store layout profiles | Plan2Eat pro | Regular stores | Weekly | MISSING | L | SKIP | 1 |
| S5 | Duplicate-item consolidation | Paprika, Mealime | "1c + 0.5c = 1.5c" | Weekly | PARTIAL | M | NOW | 5 |
| S6 | Unit normalisation in list | Paprika | g+kg reconcile | Weekly | PARTIAL | M | NOW | 4 |
| S7 | Check-off with strike-through | All | In-store UX | Weekly | HAVE | — | — | — |
| S8 | "Already have" pantry toggle | Paprika, Plan2Eat | Skip if stocked | Weekly | MISSING | M | NOW | 4 |
| S9 | Persistent pantry inventory | Paprika, Plan2Eat, EatThisMuch | Avoid rebuys | Weekly | MISSING | L | LATER | 3 |
| S10 | Pantry quantity + expiry | Paprika | Waste prevention | Weekly | MISSING | L | LATER | 3 |
| S11 | "Running low" alerts | None well (Paprika lite) | Pre-shop reminder | Weekly | MISSING | L | LATER | 2 |
| S12 | Low-stock auto-add to list | None mainstream | Automation | Weekly | MISSING | L | LATER | 2 |
| S13 | Add manual item to list | All | Non-recipe items | Weekly | HAVE | — | — | — |
| S14 | Barcode to pantry | None well | Rapid inventory | Weekly | MISSING | M | LATER | 2 |
| S15 | Share list with partner | Mealime, AnyList, Paprika | Couples | Weekly | PARTIAL (share sheet) | M | NOW | 4 |
| S16 | Live collaborative list | AnyList (not nutrition apps) | Real-time updates | Weekly | MISSING | L | LATER | 2 |
| S17 | Send to Apple Reminders | Mealime | iOS integration | Weekly | HAVE | — | — | — |
| S18 | Send to Alexa | Whisk | Voice shop | Weekly | MISSING | M | SKIP | 1 |
| S19 | Send to Google Home | Whisk | Voice shop | Weekly | MISSING | M | SKIP | 1 |
| S20 | Instacart deep link | EatThisMuch, Whisk | Delivery | Weekly | MISSING | M | LATER | 2 |
| S21 | AmazonFresh deep link | EatThisMuch | Delivery | Weekly | MISSING | M | SKIP | 1 |
| S22 | UK retailer links (Tesco/Sainsbury/Ocado) | Whisk/SamsungFood | UK coverage | Weekly | MISSING | M | LATER | 2 |
| S23 | Clear checked items | Paprika, Mealime | Post-shop reset | Weekly | HAVE | — | — | — |
| S24 | Clear full list | All | Fresh start | Monthly | HAVE | — | — | — |
| S25 | Multiple lists (e.g., Costco vs local) | Paprika | Split shops | Weekly | MISSING | M | LATER | 2 |
| S26 | List by recipe (ingredient grouped) | Paprika | "Which recipe needed this?" | Weekly | MISSING | S | LATER | 2 |
| S27 | Price tracking per item | None mainstream | Budget | Weekly | MISSING | L | SKIP | 1 |
| S28 | Cost estimate for plan | EatThisMuch pro | Budget weekly | Weekly | MISSING | L | SKIP | 1 |
| S29 | Couponing integration | Fetch, Ibotta (separate) | Savings | Weekly | MISSING | L | SKIP | 1 |
| S30 | Voice-add item | AnyList | Hands-busy | Weekly | MISSING | M | LATER | 2 |
| S31 | Text-to-list parser ("milk eggs bread") | AnyList | Fast bulk add | Weekly | MISSING | S | LATER | 3 |
| S32 | Favorites / always-buy | AnyList | Staples | Weekly | MISSING | S | LATER | 3 |
| S33 | Category icons / colour chips | Mealime | Scanability | Weekly | PARTIAL | S | LATER | 2 |
| S34 | Re-add checked items (undo shop) | Paprika | Forgotten items | Weekly | MISSING | S | LATER | 2 |
| S35 | Shopping history | Plan2Eat | Spend review | Monthly | MISSING | M | SKIP | 1 |
| S36 | Generate list from single recipe | All | Ad-hoc shop | Weekly | HAVE | — | — | — |
| S37 | Scale list by serving multiplier | Paprika, Mealime | Guest count | Weekly | PARTIAL | S | NOW | 3 |
| S38 | Metric/imperial list toggle | All | Cultural prefs | Once | HAVE | — | — | — |

## 5. MACROS / GOALS

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| M1 | Calorie target | All | Core goal | Daily | HAVE | — | — | — |
| M2 | Protein target (g) | All | Lifter essentials | Daily | HAVE | — | — | — |
| M3 | Carb target (g or %) | All | Macro splits | Daily | HAVE | — | — | — |
| M4 | Fat target (g or %) | All | Macro splits | Daily | HAVE | — | — | — |
| M5 | Fiber target | Crono, Yazio | Digestive | Daily | HAVE | — | — | — |
| M6 | Sugar target | Crono, Carb Manager | Limit sugar | Daily | PARTIAL | S | NOW | 3 |
| M7 | Sodium target | Crono, Lifesum | BP | Daily | PARTIAL | S | NOW | 3 |
| M8 | Saturated fat target | Crono | Heart | Daily | MISSING | S | LATER | 2 |
| M9 | Cholesterol target | Crono | Medical | Weekly | MISSING | S | LATER | 2 |
| M10 | Water target | Yazio, MFP+, Suppr | Hydration | Daily | HAVE | — | — | — |
| M11 | Net carbs (keto) | CarbManager | Keto | Daily | MISSING | S | NOW | 4 |
| M12 | Protein floor (not-a-cap) | MacroF | Floor logic | Daily | PARTIAL | S | NOW | 4 |
| M13 | Macro %-of-calories view | MFP | % trackers | Daily | PARTIAL | S | NOW | 3 |
| M14 | Macro grams/kg bodyweight view | MacroF | Lifter math | Monthly | MISSING | S | LATER | 3 |
| M15 | Preset strategies (balanced/low-C/keto) | MacroF, Carbon | No math | Once | HAVE (onboarding) | — | — | — |
| M16 | Adaptive TDEE recalibration | MacroF, Carbon | Real metabolism | Weekly | PARTIAL (endpoint + scaffolding) | M | NOW | 5 |
| M17 | Weekly macro cycle (high/low days) | LoseIt+, MacroF | Zigzag | Weekly | MISSING | M | LATER | 3 |
| M18 | Training vs rest day targets | MacroF | Periodisation | Daily | MISSING | M | LATER | 3 |
| M19 | Diet-phase switch (cut/bulk/maintain) | MacroF, Carbon | Seasonal goals | Monthly | PARTIAL | S | NOW | 4 |
| M20 | Goal pace slider (0.25–1 kg/wk) | MacroF, LoseIt | Aggressiveness | Once | PARTIAL | S | NOW | 4 |
| M21 | Goal weight entry | All | Motivation | Once | HAVE | — | — | — |
| M22 | Goal date estimate | LoseIt | "By June 1" | Weekly | PARTIAL (projectWeight) | S | NOW | 4 |
| M23 | Target auto-update on plateau | MacroF, Carbon | Stall recovery | Monthly | PARTIAL | M | NOW | 4 |
| M24 | Diet break / maintenance prompt | MacroF | Psychology | Monthly | MISSING | M | LATER | 3 |
| M25 | Reverse diet mode | Carbon, MacroF | Post-cut | Monthly | MISSING | M | LATER | 2 |
| M26 | Show remaining P/C/F prominently | MacroF, Carbon | End-of-day math | Daily | PARTIAL | S | NOW | 5 |
| M27 | "Fit-this-in" macro budget calculator | MacroF | Snack planning | Daily | MISSING | M | NOW | 4 |
| M28 | Over-target warning (soft) | Crono | Awareness | Daily | PARTIAL | S | NOW | 3 |
| M29 | Over-target flagged colour | LoseIt, Yazio | Visual cue | Daily | HAVE | — | — | — |
| M30 | Calorie bank (carry-over) | LoseIt+ | Bad-day recovery | Weekly | MISSING | M | LATER | 2 |
| M31 | Negative calorie day handling | Any | Extreme cut | Rare | MISSING | S | LATER | 1 |
| M32 | Activity-adjusted calories | LoseIt, MFP, MacroF | Net intake | Daily | PARTIAL | M | NOW | 5 |
| M33 | Manual activity entry | MFP, LoseIt | No wearable | Daily | PARTIAL | S | NOW | 4 |
| M34 | BMR/RMR display | Crono, MacroF | Trust math | Once | PARTIAL | S | NOW | 3 |
| M35 | TDEE transparency panel | MacroF, Carbon | "Show the formula" | Once | PARTIAL | S | NOW | 4 |
| M36 | Macro-goal history / change log | MacroF | "Why changed?" | Monthly | MISSING | M | LATER | 3 |
| M37 | Locked vs adaptive macros toggle | MacroF | Power users | Monthly | MISSING | S | LATER | 3 |
| M38 | Protein per meal floor | MacroF | Anabolic spread | Daily | MISSING | M | LATER | 3 |
| M39 | Calorie banding (display range not point) | MacroF | Realism | Daily | MISSING | S | LATER | 3 |
| M40 | Coach recommendation (weekly nudge) | MacroF, Carbon | Adaptive messaging | Weekly | PARTIAL | M | LATER | 3 |

## 6. NUTRITION DETAIL

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| N1 | Verified DB (USDA) | Crono, MacroF, Suppr | Accuracy | Daily | HAVE | — | — | — |
| N2 | Open Food Facts fallback | Crono | Coverage | Daily | HAVE | — | — | — |
| N3 | FatSecret fallback | Suppr unique stack | Redundancy | Daily | HAVE | — | — | — |
| N4 | Confidence score per food | Suppr unique | Trust UX | Daily | HAVE | — | — | — |
| N5 | Source badge per food | Crono, Suppr | Provenance | Daily | HAVE | — | — | — |
| N6 | 80+ micronutrients | Crono | Clinical | Daily | PARTIAL | L | LATER | 3 |
| N7 | Vitamin tracking (A/B/C/D/E/K) | Crono, Lifesum | Deficiencies | Daily | PARTIAL | M | LATER | 3 |
| N8 | Mineral tracking (Fe/Ca/K/Mg/Zn) | Crono | Deficiencies | Daily | PARTIAL | M | LATER | 3 |
| N9 | Omega-3 / omega-6 | Crono | Advanced | Weekly | MISSING | M | LATER | 2 |
| N10 | Amino acid profile | Crono | Hardcore | Monthly | MISSING | L | SKIP | 1 |
| N11 | Glycemic index per food | CarbManager | Metabolic | Weekly | MISSING | M | LATER | 2 |
| N12 | Glycemic load per serving | CarbManager, Levels | Metabolic | Weekly | MISSING | M | LATER | 2 |
| N13 | Caffeine tracker | Apple Health, Streaks | Sleep impact | Daily | MISSING | S | NOW | 4 |
| N14 | Alcohol tracker | MFP+, Noom, AppleHealth | Dry-Jan | Daily | MISSING | S | NOW | 4 |
| N15 | Hydration log (ml/oz/cups) | Yazio, MFP+, LoseIt+ | Hydration | Daily | PARTIAL (goal only) | S | NOW | 5 |
| N16 | Hydration quick-add buttons | Yazio, MFP+ | +250ml tap | Daily | MISSING | S | NOW | 5 |
| N17 | Cup-size preset (mug/bottle) | Yazio | Personalisation | Daily | MISSING | S | NOW | 4 |
| N18 | Hydration reminders | Yazio | Streak nudging | Daily | MISSING | S | NOW | 4 |
| N19 | Fiber bar on dashboard | Crono, Suppr | Fiber focus | Daily | HAVE | — | — | — |
| N20 | Nutrient-gap suggestions | Crono Oracle | Deficiency fill | Weekly | MISSING | L | LATER | 3 |
| N21 | "You're low on X" insight | Crono | Nudge | Weekly | MISSING | M | LATER | 3 |
| N22 | Blood glucose sync (CGM) | Levels, Ultrahuman | Metabolic users | Daily | MISSING | L | LATER | 2 |
| N23 | Glucose response per meal | Levels, Lumen | Food grading | Daily | MISSING | L | SKIP | 1 |
| N24 | Noom green/yellow/red food colouring | Noom | Behavioural | Daily | MISSING | S | SKIP | 1 |
| N25 | Ingredient-level macro breakdown | Crono, Suppr | Analysis | Weekly | HAVE | — | — | — |
| N26 | Daily micro-summary card | Crono | Awareness | Daily | PARTIAL | S | LATER | 3 |
| N27 | Per-meal macro breakdown | All | Spread view | Daily | HAVE | — | — | — |
| N28 | Nutrient adequacy bar (RDA %) | Crono | Clinical | Daily | MISSING | M | LATER | 3 |
| N29 | Daily calorie-from-macros pie | MFP | % view | Daily | PARTIAL | S | LATER | 2 |
| N30 | Fiber from plant variety (bonus) | ZOE | Gut-health angle | Weekly | MISSING | M | SKIP | 1 |

## 7. FASTING

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| F1 | Fasting timer (16:8, 18:6, 20:4) | Zero, Fastic, Yazio | IF tracking | Daily | HAVE | — | — | — |
| F2 | Custom window | Zero, Fastic | Flex IF | Daily | PARTIAL | S | NOW | 3 |
| F3 | 5:2 mode | Zero, Fastic | Alt protocol | Weekly | MISSING | M | LATER | 2 |
| F4 | OMAD mode | Zero | Niche | Weekly | PARTIAL | S | LATER | 2 |
| F5 | Fast history / log | Zero, Fastic | Retro view | Weekly | PARTIAL | S | NOW | 3 |
| F6 | Fasting ring/progress UI | Zero | At-a-glance | Daily | HAVE | — | — | — |
| F7 | Fast-phase labels (autophagy, ketosis) | Zero, DoFasting | Education | Daily | MISSING | M | LATER | 2 |
| F8 | Eating-window opens-closes notification | Zero, Fastic | Discipline | Daily | MISSING | S | NOW | 4 |
| F9 | Fast scheduling (plan tomorrow's fast) | Zero | Prep mindset | Daily | MISSING | S | LATER | 3 |
| F10 | Fasting correlated with weight | Zero+Crono+MacroF mix | Adherence ROI | Weekly | MISSING | M | LATER | 3 |
| F11 | Fasting correlated with macros | None | Unique angle | Weekly | MISSING | M | LATER | 3 |
| F12 | Pause/resume fast | Fastic | Interruptions | Weekly | MISSING | S | NOW | 3 |
| F13 | Backdated fast entry | Zero | Forgot to start | Weekly | MISSING | S | NOW | 3 |
| F14 | Weight weigh-in prompt on fast end | Zero | Data hygiene | Daily | MISSING | S | LATER | 2 |
| F15 | Mood prompt at fast end | Fastic | Adherence sentiment | Daily | MISSING | S | LATER | 2 |
| F16 | Fasting streak | Zero, Fastic | Gamification | Daily | MISSING | S | LATER | 3 |
| F17 | Fasting widget (lock screen) | Zero iOS | Passive view | Daily | MISSING | M | LATER | 4 |
| F18 | Fasting Apple Watch complication | Zero | At-a-glance | Daily | MISSING | L | LATER | 3 |
| F19 | Fasting Live Activity / Dynamic Island | Zero, MacroF (upcoming) | Live countdown | Daily | MISSING | L | LATER | 3 |
| F20 | Fasting-specific content cards | DoFasting, Fastic | Education | Weekly | MISSING | M | SKIP | 1 |
| F21 | "Broken fast" auto-detect from log | None | Integration | Daily | MISSING | M | LATER | 2 |
| F22 | Fast end → auto-open food log | None | Seamless handoff | Daily | MISSING | S | NOW | 3 |
| F23 | Water/zero-cal allowed during fast | Zero | Technical rule | Daily | MISSING | S | LATER | 2 |

## 8. SOCIAL / CREATOR / DISCOVER

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| SC1 | Discover feed (scroll) | Yummly, Tasty, Whisk, Suppr | Recipe inspo | Daily | HAVE | — | — | — |
| SC2 | Creator profile page | AllRecipes, Whisk | Attribution | Weekly | PARTIAL | M | LATER | 3 |
| SC3 | Follow a creator | AllRecipes, Whisk, NYT | Loyalty | Weekly | MISSING | M | LATER | 3 |
| SC4 | New-recipe notifications from followed | Whisk | Retention | Weekly | MISSING | M | LATER | 3 |
| SC5 | Save from discover to library | Whisk, Yummly, Suppr | Collect | Daily | HAVE | — | — | — |
| SC6 | Like / heart recipe | Yummly | Social signal | Daily | PARTIAL | S | LATER | 3 |
| SC7 | Comment on recipe | AllRecipes, NYT | Substitutions crowd | Weekly | MISSING | L | SKIP | 1 |
| SC8 | User reviews per recipe | AllRecipes, NYT, BBC Good Food | Quality filter | Weekly | MISSING | M | LATER | 2 |
| SC9 | "Made it" photo upload | AllRecipes | Community | Weekly | MISSING | M | LATER | 2 |
| SC10 | Share recipe to socials | All | Virality | Weekly | PARTIAL | S | NOW | 3 |
| SC11 | Deep-link to open in app | All | Cross-app | Weekly | PARTIAL | S | NOW | 3 |
| SC12 | Trending recipes card | Tasty, Yummly | Discovery | Daily | MISSING | M | LATER | 3 |
| SC13 | Seasonal collections | BBC Good Food, NYT | Timely | Weekly | MISSING | S | LATER | 3 |
| SC14 | Staff picks / curated | NYT Cooking | Trust | Weekly | MISSING | S | LATER | 2 |
| SC15 | Groups / clubs (interest-based) | Whisk (29 groups) | Community | Weekly | MISSING | L | SKIP | 1 |
| SC16 | Friends list / connections | MFP, Noom | Accountability | Weekly | MISSING | L | LATER | 2 |
| SC17 | Leaderboards | LoseIt | Gamification | Weekly | MISSING | M | SKIP | 1 |
| SC18 | Group challenges | LoseIt, Noom | Engagement | Weekly | MISSING | L | SKIP | 1 |
| SC19 | Share day summary to IG | Strava-style | Social proof | Weekly | MISSING | M | LATER | 3 |
| SC20 | Creator publishing flow | Whisk, Suppr roadmap | Creator pipeline | Weekly | PARTIAL | L | LATER | 3 |
| SC21 | Creator analytics (saves, plans) | Substack-style | Creator retention | Weekly | MISSING | L | LATER | 2 |
| SC22 | Multi-format creator posts (video+recipe) | Suppr roadmap (LTK-style) | Native feel | Weekly | MISSING | L | LATER | 2 |
| SC23 | Affiliate / commerce tagging | Whisk, LTK | Creator monetisation | Weekly | MISSING | L | LATER | 2 |

## 9. ONBOARDING

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| O1 | TDEE quiz | All | Personalisation | Once | HAVE | — | — | — |
| O2 | Goal selection (cut/maintain/bulk) | All | Direction | Once | HAVE | — | — | — |
| O3 | Pace selection (kg/wk) | LoseIt, MacroF | Aggressiveness | Once | PARTIAL | S | NOW | 4 |
| O4 | Projected goal date headline | LoseIt | Motivation | Once | PARTIAL | S | NOW | 4 |
| O5 | Dietary preference capture | Yazio, EatThisMuch | Plan basis | Once | PARTIAL | S | NOW | 4 |
| O6 | Allergen capture | Yazio | Safety | Once | PARTIAL | S | NOW | 5 |
| O7 | Macro strategy pick | MacroF, Carbon | Nuance | Once | HAVE | — | — | — |
| O8 | Measurement system (metric/imperial) | All | Locale | Once | HAVE | — | — | — |
| O9 | Week start day (Sun/Mon) | Yazio, MacroF | Intl users | Once | MISSING | S | NOW | 5 |
| O10 | Apple Sign-In | Most iOS | Friction | Once | HAVE | — | — | — |
| O11 | Google Sign-In | Most | Friction | Once | PARTIAL | S | NOW | 4 |
| O12 | Email magic link | Many | Passwordless | Once | HAVE | — | — | — |
| O13 | Phone/SMS auth | Simple | Regional | Once | MISSING | M | SKIP | 1 |
| O14 | Import data from MFP | LoseIt, Crono migrate | Switcher friction | Once | MISSING | L | LATER | 3 |
| O15 | Import weight history CSV | Crono | Switcher | Once | MISSING | S | LATER | 3 |
| O16 | Import recipe library URL list | Paprika | Switcher | Once | MISSING | M | LATER | 3 |
| O17 | Onboarding checklist post-signup | Duolingo-style, Suppr | First-run | Once | HAVE (FirstRunChecklist) | — | — | — |
| O18 | Sample day preview | MacroF | "What will it look like?" | Once | MISSING | S | LATER | 3 |
| O19 | Activity level self-select | All | TDEE input | Once | HAVE | — | — | — |
| O20 | Activity level validation vs wearable | MacroF | Accuracy | Once | MISSING | M | LATER | 3 |
| O21 | Health-sync permission during flow | LoseIt | Data seeding | Once | PARTIAL | S | NOW | 4 |
| O22 | Skip-onboarding power path | Nibby | No-account start | Once | MISSING | M | LATER | 3 |
| O23 | Preset macro templates | MacroF | Fast setup | Once | HAVE | — | — | — |
| O24 | Custom macro override in flow | Crono | Power | Once | HAVE | — | — | — |
| O25 | Free-trial day mapping preview | MacroF, Carbon | Trust | Once | PARTIAL | S | LATER | 3 |
| O26 | Calorie target explainer panel | MacroF | Transparency | Once | PARTIAL | S | NOW | 3 |

## 10. NOTIFICATIONS

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| NT1 | Meal reminder (time-of-day) | MFP, LoseIt | Habit | Daily | PARTIAL | S | NOW | 4 |
| NT2 | Weigh-in reminder | LoseIt, MacroF | Data hygiene | Weekly | PARTIAL | S | NOW | 4 |
| NT3 | Hydration reminder (interval) | Yazio, MFP+ | Habit | Daily | MISSING | S | NOW | 4 |
| NT4 | End-of-day "don't forget to log" | MFP, LoseIt | Adherence | Daily | MISSING | S | NOW | 4 |
| NT5 | Streak-at-risk ping | LoseIt | Retention | Daily | MISSING | S | LATER | 3 |
| NT6 | Weekly recap push | MacroF | Reflection | Weekly | MISSING | M | NOW | 5 |
| NT7 | Weight plateau notification | MacroF | Adaptive prompt | Weekly | MISSING | M | LATER | 3 |
| NT8 | Macro recalibration push | MacroF | Algo update | Weekly | MISSING | M | LATER | 3 |
| NT9 | Shopping list reminder (shop day) | Paprika, PlanToEat | Flow | Weekly | MISSING | S | LATER | 3 |
| NT10 | Meal plan ready notification | EatThisMuch, Mealime | Consumption | Weekly | MISSING | S | LATER | 3 |
| NT11 | Creator posted notification | Whisk | Feed | Weekly | MISSING | M | LATER | 2 |
| NT12 | "Try this recipe" nudge | Yummly | Discovery | Weekly | MISSING | M | SKIP | 1 |
| NT13 | Fasting start/end ping | Zero, Fastic | Discipline | Daily | MISSING | S | NOW | 4 |
| NT14 | Sunday plan-week reminder | PlanToEat | Routine | Weekly | MISSING | S | NOW | 3 |
| NT15 | Per-channel mute | MacroF | Noise control | Once | PARTIAL | S | NOW | 4 |
| NT16 | Quiet hours | Many | Sleep | Once | MISSING | S | LATER | 3 |
| NT17 | Push permission prompt UX | All | Acceptance rate | Once | HAVE (notifications-prompt) | — | — | — |
| NT18 | In-app notifications centre | Suppr, MFP | History | Weekly | HAVE (NotificationsCenter) | — | — | — |
| NT19 | Email digest opt-in | MacroF | Off-app users | Weekly | MISSING | M | LATER | 3 |
| NT20 | Re-engagement email sequence | Noom | Churn reduction | Weekly | MISSING | M | LATER | 3 |

## 11. DATA / INTEGRATIONS

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| D1 | Apple Health read (weight) | All | Source of truth | Daily | HAVE | — | — | — |
| D2 | Apple Health read (activity energy) | MFP, LoseIt, MacroF | Activity adjust | Daily | HAVE | — | — | — |
| D3 | Apple Health read (steps) | All | Activity adjust | Daily | HAVE | — | — | — |
| D4 | Apple Health read (dietary energy in) | MacroF (written from other apps) | Cross-app | Daily | PARTIAL | M | LATER | 3 |
| D5 | Apple Health write (calories) | MFP, Crono, LoseIt | Feed HealthKit | Daily | HAVE (exportDayToHealth) | — | — | — |
| D6 | Apple Health write (macros breakdown) | Crono | Deep interop | Daily | PARTIAL | S | NOW | 3 |
| D7 | Apple Health write (water) | Yazio | Hydration unified | Daily | PARTIAL | S | NOW | 3 |
| D8 | Apple Health write (caffeine) | Apple | Caffeine entries | Daily | MISSING | S | LATER | 2 |
| D9 | Google Fit integration | All except LoseIt/MacroF (no MacroF) | Android parity | Daily | MISSING | M | NOW | 4 |
| D10 | Health Connect (Android) | Emerging | Android future | Daily | MISSING | M | NOW | 4 |
| D11 | Fitbit integration | MFP, LoseIt, Yazio | Wearable users | Daily | MISSING | L | LATER | 3 |
| D12 | Garmin Connect | MFP, Lumen | Endurance athletes | Daily | MISSING | L | LATER | 2 |
| D13 | Whoop | None mainstream | Recovery | Daily | MISSING | L | SKIP | 1 |
| D14 | Oura | Ultrahuman | Sleep | Daily | MISSING | L | SKIP | 1 |
| D15 | Strava (import activity) | MFP | Runners | Daily | MISSING | L | LATER | 2 |
| D16 | Polar | MFP | HR athletes | Weekly | MISSING | L | SKIP | 1 |
| D17 | Withings / smart scale | MFP, LoseIt | Auto-weigh | Daily | MISSING | L | LATER | 3 |
| D18 | Renpho scale | MFP | Cheap scale | Daily | MISSING | L | LATER | 2 |
| D19 | Libre / Dexcom CGM | Levels, Ultrahuman | Metabolic | Daily | MISSING | L | SKIP | 1 |
| D20 | Web API / public API | None nutrition-app-native | Power users | Rare | MISSING | L | LATER | 2 |
| D21 | Export CSV (day) | Crono+ | Data ownership | Monthly | HAVE | — | — | — |
| D22 | Export CSV (week/month) | Crono+ | Bulk export | Monthly | PARTIAL | S | NOW | 3 |
| D23 | Export JSON all-data | MacroF | GDPR | Rare | MISSING | M | NOW | 3 |
| D24 | Delete account + data | GDPR req | Compliance | Rare | PARTIAL | S | NOW | 4 |
| D25 | iCloud sync | Paprika | Native feel | Daily | MISSING | L | SKIP | 1 |
| D26 | Web login with same account | MFP, Crono, Suppr | Cross-platform | Daily | HAVE | — | — | — |
| D27 | Partner/dietitian data share | Crono Pro | Clinical | Monthly | MISSING | L | LATER | 2 |
| D28 | Third-party OAuth | MFP (dev ecosystem) | Platform play | Rare | MISSING | L | SKIP | 1 |

## 12. WIDGETS / PLATFORM

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| W1 | iOS home-screen widget (day ring) | MacroF, Crono, LoseIt | Passive glance | Daily | MISSING | M | NOW | 5 |
| W2 | iOS home-screen widget (remaining) | MacroF, LoseIt | Decision support | Daily | MISSING | M | NOW | 5 |
| W3 | iOS lock-screen widget | Zero, MacroF, FoodNoms | Passive | Daily | MISSING | M | LATER | 4 |
| W4 | iOS StandBy widget | FoodNoms | Night-stand | Daily | MISSING | M | LATER | 2 |
| W5 | iOS Live Activity (log in progress) | MacroF (roadmap) | Active feedback | Daily | MISSING | L | LATER | 3 |
| W6 | iOS Dynamic Island (fast timer) | MacroF, Zero | Visibility | Daily | MISSING | L | LATER | 3 |
| W7 | Android widget | MFP | Android glance | Daily | MISSING | M | LATER | 3 |
| W8 | Apple Watch complication | Zero, MFP | Glance | Daily | MISSING | L | LATER | 3 |
| W9 | Apple Watch quick log app | MFP, LoseIt | Log from wrist | Daily | MISSING | L | LATER | 3 |
| W10 | Apple Watch water tap | MFP | Water log | Daily | MISSING | M | LATER | 3 |
| W11 | Siri Shortcuts (log meal) | Zero, FoodNoms | Voice-first | Daily | MISSING | M | NOW | 4 |
| W12 | Siri Shortcuts (start fast) | Zero | Routine | Daily | MISSING | S | NOW | 3 |
| W13 | iOS Shortcuts actions | FoodNoms | Power-user automation | Weekly | MISSING | M | LATER | 3 |
| W14 | Share sheet extension (recipe URL) | Paprika, Crono | One-tap import | Weekly | PARTIAL | S | NOW | 5 |
| W15 | Android share-intent | Whisk, Suppr | Android import | Weekly | PARTIAL | S | NOW | 5 |
| W16 | App Clips (iOS) | None | Low-friction demo | Rare | MISSING | L | SKIP | 1 |
| W17 | Handoff between devices | None nutrition | Mac+iPhone | Rare | MISSING | L | SKIP | 1 |
| W18 | iPad optimised layout | Paprika | Tablet cooks | Weekly | PARTIAL | M | LATER | 3 |
| W19 | macOS app | Paprika | Desktop cooks | Weekly | MISSING | L | SKIP | 1 |
| W20 | Chrome extension (clip recipe) | Paprika, Plan2Eat, Whisk | Browser flow | Weekly | MISSING | M | NOW | 4 |
| W21 | Firefox extension | Paprika | Coverage | Weekly | MISSING | S | LATER | 2 |
| W22 | Safari extension | Paprika | iOS browser | Weekly | MISSING | M | LATER | 3 |
| W23 | PWA installable | Some | Web-first users | Rare | PARTIAL | S | LATER | 3 |
| W24 | Offline web | Crono pro | Spotty wifi | Weekly | PARTIAL | M | LATER | 3 |
| W25 | Keyboard shortcuts (web) | Crono | Power | Daily | MISSING | S | LATER | 3 |
| W26 | Native file export (share) | All | Data portability | Monthly | PARTIAL | S | NOW | 3 |
| W27 | Camera quick-capture from lock screen (Siri) | Zero | Fastest log | Daily | MISSING | M | LATER | 3 |

## 13. ANALYTICS / INSIGHTS

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| A1 | Weight trend chart | All | Progress | Weekly | HAVE | — | — | — |
| A2 | Weight 7-day rolling average | MacroF | Noise filter | Weekly | PARTIAL | S | NOW | 4 |
| A3 | Weight projection line | LoseIt, MacroF | "When will I…" | Weekly | PARTIAL | S | NOW | 4 |
| A4 | Weight vs goal delta | LoseIt | Motivation | Weekly | PARTIAL | S | NOW | 4 |
| A5 | Calorie 7-day chart | MFP, LoseIt, MacroF | Adherence | Weekly | HAVE | — | — | — |
| A6 | Macro 7-day stacked chart | Crono, MacroF | Protein adherence | Weekly | PARTIAL | S | NOW | 3 |
| A7 | Streak count (logging) | LoseIt, Noom, Zero | Habit | Daily | HAVE (computeLoggingStreak) | — | — | — |
| A8 | Streak freeze (skip a day) | Duolingo-style, Zero, Yazio | Realism | Weekly | MISSING | S | NOW | 4 |
| A9 | "Best week" highlight | LoseIt | Reinforcement | Weekly | MISSING | S | LATER | 3 |
| A10 | Weekly recap card | MacroF | Reflection | Weekly | MISSING | M | NOW | 5 |
| A11 | Month recap | Crono | Reflection | Monthly | MISSING | M | LATER | 3 |
| A12 | Year-in-review | Strava-style, Spotify Wrapped | Virality | Yearly | MISSING | M | LATER | 3 |
| A13 | Consistency score | MacroF | Adherence metric | Daily | MISSING | M | LATER | 3 |
| A14 | Adherence heatmap | MacroF, Strava-style | Pattern | Weekly | MISSING | M | LATER | 3 |
| A15 | Correlation view (fast vs weight) | None | Unique | Weekly | MISSING | L | LATER | 3 |
| A16 | Body comp trend (if logged) | Crono | Physique users | Weekly | MISSING | M | LATER | 2 |
| A17 | Macro breakdown drill-down | Crono, Suppr | Detail | Weekly | HAVE (macro-detail) | — | — | — |
| A18 | Nutrient drill-down | Crono | Clinical | Weekly | PARTIAL | S | LATER | 3 |
| A19 | Compare two periods | MacroF | "vs last month" | Monthly | MISSING | M | LATER | 2 |
| A20 | Highest-calorie food of week | LoseIt | "What was the culprit" | Weekly | MISSING | S | LATER | 3 |
| A21 | Highest-protein food of week | MacroF | Winners list | Weekly | MISSING | S | LATER | 3 |
| A22 | Recipe usage frequency | Paprika | Rotation signal | Monthly | MISSING | S | LATER | 2 |
| A23 | Food variety score (plant points) | ZOE | Gut variety | Weekly | MISSING | M | SKIP | 1 |
| A24 | Today-at-a-glance summary | Suppr | Dashboard | Daily | HAVE (TodayAtAGlance) | — | — | — |
| A25 | Goal-weight countdown | LoseIt | Motivation | Daily | PARTIAL | S | NOW | 3 |
| A26 | Sleep correlation with intake | Apple Health stitch | Wellness | Weekly | MISSING | L | LATER | 2 |
| A27 | Steps correlation with weight | Apple Health stitch | Activity math | Weekly | MISSING | L | LATER | 2 |
| A28 | Deficit-for-day panel | LoseIt | Transparency | Daily | PARTIAL (burn-detail) | S | NOW | 4 |
| A29 | Weekly deficit total | LoseIt | Projection | Weekly | PARTIAL | S | NOW | 3 |
| A30 | Predicted weight-next-week | MacroF | Forecast | Weekly | PARTIAL | S | LATER | 3 |

## 14. GAMIFICATION

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| G1 | Daily streak counter | LoseIt, Zero, Noom | Habit | Daily | HAVE | — | — | — |
| G2 | Streak freeze/skip | Yazio, Zero | Realism | Weekly | MISSING | S | NOW | 4 |
| G3 | Badges | LoseIt, Noom | Reward | Weekly | MISSING | M | SKIP | 1 |
| G4 | Achievements shelf | LoseIt | Collection | Weekly | MISSING | M | SKIP | 1 |
| G5 | Leaderboards | LoseIt | Competition | Weekly | MISSING | L | SKIP | 1 |
| G6 | Group challenges | LoseIt, Noom | Accountability | Weekly | MISSING | L | SKIP | 1 |
| G7 | Level-up / points system | Noom, Yazio | Dopamine | Daily | MISSING | M | SKIP | 1 |
| G8 | Protein-hit / fiber-hit stars | MacroF subtle | Positive reinforcement | Daily | PARTIAL (hits calc) | S | NOW | 3 |
| G9 | Best-ever logging streak record | Zero | Personal best | Monthly | MISSING | S | LATER | 3 |
| G10 | Milestone celebrations (lost 5kg) | LoseIt, Noom | Motivation | Monthly | MISSING | S | LATER | 3 |
| G11 | "Plate clean" day flag | Mealime | Completion | Daily | MISSING | S | SKIP | 1 |
| G12 | Share achievement to social | Strava | Virality | Monthly | MISSING | M | LATER | 2 |
| G13 | Weekly goal completion check | LoseIt | Compliance | Weekly | MISSING | S | LATER | 3 |

## 15. BODY STATS

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| B1 | Weight log | All | Progress | Daily | HAVE | — | — | — |
| B2 | Weight trend visualisation | All | Noise filter | Weekly | PARTIAL | S | NOW | 3 |
| B3 | Multiple weigh-ins per day (avg) | MacroF | Noise handling | Daily | MISSING | S | NOW | 3 |
| B4 | Waist measurement | MFP, LoseIt, Crono | Composition | Weekly | MISSING | S | NOW | 4 |
| B5 | Hip measurement | MFP, LoseIt | Composition | Weekly | MISSING | S | LATER | 3 |
| B6 | Chest / arm / thigh measurements | MFP | Physique | Weekly | MISSING | S | LATER | 2 |
| B7 | Body-fat % log | MFP, Crono, MacroF | Composition | Weekly | MISSING | S | LATER | 3 |
| B8 | Lean mass log | MacroF | Composition | Weekly | MISSING | S | LATER | 2 |
| B9 | BMI display | MFP | Context | Once | PARTIAL | S | NOW | 3 |
| B10 | Progress photo log | LoseIt, Crono | Visual trend | Weekly | MISSING | M | LATER | 3 |
| B11 | Side-by-side photo compare | LoseIt | Transformation | Monthly | MISSING | M | LATER | 3 |
| B12 | Resting heart rate log | MFP (Apple Health) | Wellness | Daily | MISSING | S | LATER | 2 |
| B13 | Blood pressure log | Apple Health | Medical | Weekly | MISSING | S | SKIP | 1 |
| B14 | Cycle / period tracking | Apple Health, Yazio | Women users | Daily | MISSING | M | LATER | 3 |
| B15 | Pregnancy mode | Yazio | Life stage | Daily | MISSING | L | LATER | 2 |
| B16 | Postpartum mode | Yazio | Life stage | Weekly | MISSING | L | LATER | 2 |
| B17 | Sleep log | Apple Health stitch | Wellness | Daily | MISSING | M | LATER | 2 |
| B18 | Mood log | Noom, Ultrahuman | Behaviour | Daily | MISSING | S | LATER | 2 |
| B19 | Custom biometric | Crono Gold | Niche | Weekly | MISSING | M | LATER | 2 |
| B20 | Weight zone / healthy-range colour | MFP | Context | Monthly | MISSING | S | LATER | 2 |

## 16. QOL / MICRO-FEATURES

| # | Feature | Competitors | Problem | Freq | Status | Effort | Rec | Pri |
|---|---|---|---|---|---|---|---|---|
| Q1 | Dark mode | All | Accessibility | Daily | HAVE | — | — | — |
| Q2 | System theme auto-follow | MacroF | Nice default | Daily | HAVE | — | — | — |
| Q3 | Dynamic type / large text | MFP+ | Accessibility | Daily | PARTIAL | S | NOW | 3 |
| Q4 | High-contrast mode | iOS system | Accessibility | Daily | PARTIAL | S | LATER | 2 |
| Q5 | Reduce-motion respect | iOS | Accessibility | Daily | PARTIAL | S | LATER | 2 |
| Q6 | VoiceOver labels | iOS | Accessibility | Daily | PARTIAL | M | NOW | 4 |
| Q7 | Haptics on log success | MFP, MacroF | Polish | Daily | HAVE | — | — | — |
| Q8 | Pull-to-refresh | All | Standard | Daily | PARTIAL | S | NOW | 3 |
| Q9 | Search keyboard "done" commit | All | Small-UX | Daily | PARTIAL | S | NOW | 3 |
| Q10 | Recent search history | MFP, Crono | Speed | Daily | PARTIAL | S | NOW | 4 |
| Q11 | Clear recent | Most | Privacy | Monthly | MISSING | S | LATER | 2 |
| Q12 | Inline keyboard numeric picker | MFP | Faster portion | Daily | PARTIAL | S | NOW | 3 |
| Q13 | "+" FAB on all tabs | MFP, LoseIt | Universal add | Daily | PARTIAL | S | NOW | 3 |
| Q14 | Long-press context menu | iOS-native | Power | Weekly | PARTIAL | S | NOW | 3 |
| Q15 | Swipe left/right between days | Yazio | Date nav | Daily | PARTIAL | S | NOW | 4 |
| Q16 | Day strip / calendar scrubber | Crono, MacroF, Suppr | Date nav | Daily | HAVE (DayStrip) | — | — | — |
| Q17 | Quick "jump to today" | All | Re-centre | Daily | HAVE | — | — | — |
| Q18 | Empty-state coaching | LoseIt, MacroF | First-use | Once | PARTIAL | S | NOW | 3 |
| Q19 | Skeleton loading states | All modern | Polish | Daily | HAVE (AppLoadingSkeleton) | — | — | — |
| Q20 | Optimistic UI on log | MacroF | Speed perception | Daily | PARTIAL | M | NOW | 4 |
| Q21 | Error toast with retry | All | Resilience | Daily | PARTIAL | S | NOW | 3 |
| Q22 | Feature-level error boundary | Suppr | Robustness | Daily | HAVE (FeatureErrorBoundary) | — | — | — |
| Q23 | What's-new changelog | MacroF | Engagement | Monthly | MISSING | S | NOW | 3 |
| Q24 | Public roadmap | Suppr | Trust | Monthly | HAVE | — | — | — |
| Q25 | In-app feedback form | MacroF, Zero | Research loop | Monthly | PARTIAL | S | NOW | 3 |
| Q26 | Feature request voting | Nolt/Canny-style | Community | Monthly | MISSING | M | LATER | 2 |
| Q27 | Help centre | All | Support | Monthly | HAVE | — | — | — |
| Q28 | Contextual tooltips | MacroF | Learning | Weekly | MISSING | S | LATER | 3 |
| Q29 | Glossary of terms | Crono | Education | Rare | MISSING | S | SKIP | 1 |
| Q30 | Privacy-first onboarding copy | Apple-style | Trust | Once | PARTIAL | S | NOW | 3 |
| Q31 | Cookie consent (web) | GDPR | Compliance | Once | HAVE | — | — | — |
| Q32 | Biometric app lock (Face ID) | Crono Gold | Privacy | Daily | MISSING | S | LATER | 2 |
| Q33 | Multiple profiles (family) | None | Households | Daily | MISSING | L | LATER | 2 |
| Q34 | Incognito / private day | None | Cheat day | Weekly | MISSING | S | SKIP | 1 |
| Q35 | Keyboard-shortcut help overlay | Crono web | Discovery | Monthly | MISSING | S | LATER | 2 |
| Q36 | Recipe star rating on card | AllRecipes | Scanning | Daily | MISSING | S | LATER | 3 |
| Q37 | Estimated cook-time badge | Mealime | Filter | Weekly | PARTIAL | S | LATER | 3 |
| Q38 | "X ingredients" quick count | Mealime | Simplicity filter | Weekly | MISSING | S | LATER | 3 |
| Q39 | Ingredient unit smart-convert | Paprika | Cultural UX | Weekly | PARTIAL | M | NOW | 3 |
| Q40 | Input-trim on paste | Small | Clean-up | Weekly | PARTIAL | S | NOW | 2 |
| Q41 | URL-field strip tracking params | Small | Clean URLs | Rare | MISSING | S | LATER | 2 |
| Q42 | Deep link to specific recipe | Paprika | Sharing | Weekly | HAVE | — | — | — |
| Q43 | Deep link to specific day | MacroF | Sharing | Weekly | MISSING | S | LATER | 2 |
| Q44 | Deep link to plan | MacroF | Sharing | Weekly | MISSING | S | LATER | 2 |
| Q45 | Universal search (all data types) | MFP | Single field | Weekly | MISSING | M | LATER | 3 |

## HIDDEN GEMS (power-users rely on; rarely discussed publicly)

| # | Feature | Competitor | Status | Why it matters |
|---|---|---|---|---|
| HG1 | Cronometer Oracle (fill-the-gap food suggestions) | Crono | MISSING | Turns dashboard into a coach without AI cost |
| HG2 | MacroFactor dashboard customisation | MacroF | MISSING | Power users pin their 3 metrics |
| HG3 | Paprika pantry auto-uncheck when added to list | Paprika | MISSING | Removes a manual step |
| HG4 | MacroFactor "copy & paste" entry | MacroF | MISSING | Bypasses search for repeat foods |
| HG5 | LoseIt flexible weekly calorie schedule | LoseIt | MISSING | High/low days without full zigzag |
| HG6 | PlanToEat "refill" grocery from pantry | Plan2Eat | MISSING | Auto-staples shopping |
| HG7 | Cronometer custom meals (save-as-meal combo) | Crono | MISSING | The "saved meal" that isn't a recipe |
| HG8 | Cronometer multiple-serving-size custom food | Crono | MISSING | "1 slice" vs "100g" same food |
| HG9 | Yazio meal timestamp sort | Yazio | PARTIAL | Fasting-adjacent logging UX |
| HG10 | Zero lock-screen fasting widget | Zero | MISSING | Ambient presence |
| HG11 | Paprika "nested categories" | Paprika | MISSING | Library taxonomists |
| HG12 | MFP "recipes I've cooked recently" | MFP | MISSING | Frequency as signal |
| HG13 | Apple Health "meal source" attribution | Apple | PARTIAL | Trust when merging multiple loggers |
| HG14 | Crono data-source badge mix per-food | Crono / Suppr | HAVE | Our edge, keep marketing it |
| HG15 | MacroF expenditure-modifier (travel/illness) | MacroF | MISSING | Honest algo correction |
| HG16 | NYT cooking hands-free scroll gesture | NYT | MISSING | Greasy hands cook mode |
| HG17 | Paprika recipe import via email address | Paprika | MISSING | Newsletter-to-library |
| HG18 | Crono "Pro" share day with dietitian (read-only link) | Crono | MISSING | Clinical handoff |
| HG19 | MacroF "ingredient-level AI log" edit-before-commit | MacroF | MISSING | Photo log that doesn't lock you in |
| HG20 | Zero pause/resume fast | Fastic | MISSING | Reality of interruptions |
| HG21 | LoseIt "snap and save for later" queue | LoseIt | MISSING | Log-mid-meal deferral |
| HG22 | Strong / Fitbod "last-time-you-did-X" recall | Strong | MISSING | Pattern memory |
| HG23 | Strava "achievement/PB on segment" style | Strava | MISSING | Personal-best highlighting |
| HG24 | Notion-style template library | Notion | MISSING | User-shareable day templates |
| HG25 | Todoist recurring scheduling model | Todoist | MISSING | "Every Monday breakfast: X" |
| HG26 | Apple Health "unify from multiple apps" philosophy | Apple | PARTIAL | Trust architecture |

## TABLE STAKES WE ARE MISSING (users will assume we have these)

| # | Feature | Evidence we lack | Priority |
|---|---|---|---|
| TS1 | Copy meal to another day | No occurrence in repo | 5 |
| TS2 | Duplicate entire day | No occurrence | 5 |
| TS3 | Saved meals / custom meal combos (not full recipe) | No occurrence | 5 |
| TS4 | Frequent / favourite foods shortcut | Not surfaced | 5 |
| TS5 | Remaining macros panel (big numbers) | Partial, not prominent | 5 |
| TS6 | Hydration quick-add buttons | Goal only, no logging path | 5 |
| TS7 | Week-start-day setting (Mon/Sun) | Not implemented | 5 |
| TS8 | iOS home-screen widget (day ring) | Not implemented | 5 |
| TS9 | Voice logging (natural language) | Hint only | 5 |
| TS10 | AI photo log | Research-only | 5 |
| TS11 | Custom foods with multiple serving sizes | Not modelled | 4 |
| TS12 | Recipe notes (personal) | Missing | 4 |
| TS13 | Siri Shortcut: log meal | Missing | 4 |
| TS14 | Weekly recap push+card | Missing | 5 |
| TS15 | Chrome/Safari recipe clipper extension | Missing | 4 |
| TS16 | Drag-drop meal across days in plan | Missing | 5 |
| TS17 | Caffeine + alcohol trackers | Missing | 4 |
| TS18 | Streak freeze / skip | Missing | 4 |
| TS19 | Pantry (even lightweight) | Missing | 3 |
| TS20 | Apple Watch complication | Missing | 3 |
| TS21 | Google Fit / Health Connect (Android) | Missing | 4 |
| TS22 | Waist / body-fat logging alongside weight | Missing | 4 |
| TS23 | Weight 7-day moving average line | Partial | 4 |
| TS24 | Leftovers-aware meal plan (cook once, eat twice) | Missing | 5 |
| TS25 | Plan template / saved-week | Missing | 4 |
| TS26 | Consolidate duplicate shopping items (auto-sum) | Partial | 5 |
| TS27 | End-of-day "don't forget to log" nudge | Missing | 4 |
| TS28 | Net carbs display (keto) | Missing | 4 |
| TS29 | Share recipe via link (public URL, no login) | Partial | 4 |
| TS30 | Sugar / sodium targets on dashboard | Partial (data), not surfaced | 3 |

## TOP 50 RANKED ROADMAP (demand × brand-fit ÷ effort)

1. **Copy meal to another day** (L13) — S — Universally missed; unlocks meal-prep loyalty. Priority 5.
2. **Duplicate entire day to another date** (L15) — S — Meal-prep superfans; one query. Priority 5.
3. **Save meal as combo / "custom meals"** (HG7 / TS3) — S-M — Bridges gap between log and full recipe. Priority 5.
4. **Favorites + frequent-foods shortcut on log** (L11, L12) — S — Directly fights logging fatigue. Priority 5.
5. **Remaining macros big-numbers panel + "fit this in" calculator** (M26, M27) — S — The end-of-day question. Priority 5.
6. **Week-start-day setting (Mon/Sun)** (O9) — S — Free-win MFP-removed-feature-style. Priority 5.
7. **Hydration quick-log buttons + preset cups + reminder** (N15–N18, NT3) — S — Already have goal; complete the loop. Priority 5.
8. **Caffeine + Alcohol trackers** (N13, N14) — S — Apple Health already supports; differentiator. Priority 5.
9. **Streak freeze (skip-a-day)** (G2, A8) — S — Retention without toxicity. Priority 4.
10. **Weekly recap card + push** (A10, NT6) — M — Reflection drives retention. Priority 5.
11. **iOS home-screen widget (day ring + remaining)** (W1, W2) — M — Ambient presence; MacroF parity. Priority 5.
12. **Siri Shortcut: log meal / start fast** (W11, W12) — S-M — Power-user delight. Priority 4.
13. **iOS share-sheet recipe clipper polish** (W14) — S — Partial; finish it. Priority 5.
14. **Chrome extension (recipe clipper)** (W20) — M — Web-collectors (Paprika parity). Priority 4.
15. **AI photo logging (single-food, Pro tier)** (L5) — L — Becoming table stakes by 2027. Priority 5.
16. **Voice logging (natural language)** (L7) — M — Second input channel; hint already in code. Priority 5.
17. **Adaptive TDEE full rollout** (M16) — M — Endpoint + scaffolding exist; finish weekly recalibration cycle + UX. Priority 5.
18. **Drag-drop meal across days in plan** (MP8) — M — Expected planning UX. Priority 5.
19. **Copy plan week → next week; save as template** (MP9, MP11) — M — Meal-prep routines. Priority 5.
20. **Pin / lock a planned meal** (MP7) — S — Quick add-on to regenerate flow. Priority 4.
21. **Leftovers-aware plan (cook once, eat twice)** (MP15) — M — White-space feature; differentiator. Priority 5.
22. **Dietary requirements + allergen first-class filters** (MP20, R44, R45) — M — Roadmap Phase A; trust & safety. Priority 5.
23. **Remaining macros after planned meals (intra-day)** (MP30) — S — Integrates plan+log. Priority 5.
24. **Weight 7-day moving average + projection line** (A2, A3) — S — Already scaffolded. Priority 4.
25. **Waist + body-fat % logging** (B4, B7) — S — Expected in 2026. Priority 4.
26. **Progress photo log** (B10) — M — Non-scale victory; differentiator for women-health. Priority 3.
27. **Recipe notes (personal)** (R28) — S — Paprika parity. Priority 4.
28. **Recipe rating (stars)** (R27) — S — Filter by best. Priority 4.
29. **Ingredient-level swap in recipe** (R13) — M — "No cilantro" fix. Priority 4.
30. **Custom food with multiple serving sizes** (R17 / Q39) — M — Crono parity. Priority 4.
31. **Recipe timer inline during cook mode** (R23) — S — Cook-mode polish. Priority 4.
32. **Screen-stays-awake enforcement in cook mode** (R25) — S — Obvious polish. Priority 4.
33. **Partial recipe log (1/3 of pot)** (L22) — S — Common big-batch case. Priority 5.
34. **Undo delete toast** (L35) — S — Polish, resilience. Priority 4.
35. **Swipe-between-days gesture on Today** (Q15) — S — Calendar-adjacent navigation. Priority 4.
36. **Hydration reminder (interval)** (NT3) — S — Paired with widget. Priority 4.
37. **End-of-day "don't forget to log" nudge** (NT4) — S — Retention lever. Priority 4.
38. **Google Fit + Android Health Connect** (D9, D10) — M — Android parity. Priority 4.
39. **Apple Health write: water + macros** (D6, D7) — S — Unified HealthKit story. Priority 3.
40. **CSV export for week/month + JSON full-data** (D22, D23) — S — GDPR / power-users. Priority 4.
41. **Pantry lightweight (have/don't-have toggle per list item)** (S8) — M — Paprika parity stage-1. Priority 4.
42. **Shopping-list duplicate consolidation + unit norm** (S5, S6) — M — Expected behaviour. Priority 5.
43. **Fasting pause/resume + backdate + end-of-fast → log handoff** (F12, F13, F22) — S — Our fasting becomes world-class. Priority 4.
44. **Fasting lock-screen widget + Live Activity** (F17, F19) — L — Zero parity. Priority 4.
45. **Exclude-recipe-from-autogen list** (MP39) — S — Plan relevance. Priority 3.
46. **Empty-state coaching (first-use, each tab)** (Q18) — S — Day-1 retention. Priority 3.
47. **Goal pace slider + projected goal date headline** (O3, O4) — S — LoseIt onboarding parity. Priority 4.
48. **Net-carbs display (keto)** (M11) — S — Carb Manager parity for segment. Priority 4.
49. **Creator share sheet → recipe deep-link import in 1 tap** (SC10, W14, W15) — S — Partial; polish. Priority 4.
50. **What's-new changelog panel** (Q23) — S — Simple engagement loop. Priority 3.

## AVOID LIST (requested but wrong for Suppr)

| Feature | Why request exists | Why avoid |
|---|---|---|
| Crowd-sourced user-submitted DB | Coverage (MFP moat) | Kills accuracy thesis; 37% error rate |
| Leaderboards / group challenges | LoseIt retention | Alienates "tool for adults" positioning |
| Points / level-up | Noom/Yazio dopamine | Incentivises junk logging to maintain streaks |
| GLP-1 integration / medical dispensing | Noom Med growth | Liability territory; not our scope |
| CBT article library | Noom value prop | "Articles I could Google"; expensive to maintain |
| $1 dark-pattern trial | Noom conversion | $62M lawsuit settlement; trust killer |
| Aggressive streak guilt | Snapchat-style | Toxic with food / ED risk |
| Always-on mic listening | None yet | Privacy & trust disaster |
| Before/after "shocking transformation" marketing | MFP, Noom ads | Wrong brand tone |
| AI without verified backoff | SnapCalorie, CalAI | Accuracy failures turn into support cost |
| Recipe quality farmed from scrape | Yummly old | Contradicts approved-sources policy |
| Paywalling barcode scanner | MFP 2022 | Already our #1 marketing lever against MFP |
| Coach-via-DM at $200/yr | Noom | Not our CAC economics |
| Global forums / comments | MFP, FatSecret | Moderation + health-advice liability |
| 50+ wearable integrations | MFP moat | Diminishing returns past Apple Health/GFit/HConnect |

## ALREADY HAVE IT — Marketing Wins

Features users beg for elsewhere that Suppr ships today (lead every marketing surface with these):

1. **Recipe URL import with auto-nutrition** — only Crono comparable
2. **Free barcode scanning** — MFP paywalled in 2022
3. **Verified multi-source nutrition (USDA → OFF → FatSecret) with confidence + source badges** — unique stack
4. **Combined discover → plan → shop → cook → log loop in one app** — white space
5. **Fiber + water as first-class targets (not paywalled)** — MFP/Lose It paywalled
6. **Cook Mode** — Mealime's headline feature
7. **Macro-aware plan generation with portion scaling + per-meal swap** — EatThisMuch plans without tracking; we do both
8. **Web + mobile parity** — MacroF/Carbon/Noom have no web app
9. **CSV export (free)** — Crono paywalls this
10. **Custom macro targets from onboarding (free)** — MFP paywalled
11. **Apple Sign-In + magic link (no password required)** — table-stakes well executed
12. **Multi-format social import (IG/TikTok caption parsing)** — novel creator-feed on-ramp
13. **Dark mode + system theme follow** — table stakes, but present from day 1
14. **First-run checklist + public roadmap** — trust signals

---

## Key source URLs (for provenance when scoring demand)

- [MacroFactor Review: Pricing, Features, and Is It Worth It?](https://fonzi.ai/blog/macrofactor-review)
- [MacroFactor vs Cal AI 2026](https://macrofactor.com/macrofactor-vs-cal-ai/)
- [MacroFactor monthly update Jan/Feb/Mar 2026](https://macrofactor.com/mm-jan-2026/)
- [MyFitnessPal — How do I copy a meal from one day to another](https://support.myfitnesspal.com/hc/en-us/articles/360032622131-How-do-I-copy-a-meal-from-one-day-to-another)
- [MyFitnessPal community: copy meal to different meal](https://community.myfitnesspal.com/en/discussion/10871782/copy-meal-to-different-meal)
- [MyFitnessPal community: copy previous meal to today](https://community.myfitnesspal.com/en/discussion/10932477/copy-previous-meal-to-today)
- [Cronometer — Create and leverage a custom meal](https://cronometer.com/blog/custom-meals/)
- [Cronometer — Create custom recipe with multiple serving sizes](https://support.cronometer.com/hc/en-us/articles/360018510311-Create-Custom-Recipe)
- [Cronometer — Create a custom food (serving sizes)](https://support.cronometer.com/hc/en-us/articles/360018240312-Create-a-Custom-Food)
- [Paprika Recipe Manager Review 2026](https://flavor365.com/paprika-3-recipe-manager-our-honest-2026-review/)
- [Paprika iOS user guide](https://www.paprikaapp.com/help/ios/)
- [Eat This Much Review 2026](https://www.promealplan.com/en/blog/eat-this-much-review-2026)
- [Best meal-planning apps 2026 — CNN Underscored](https://www.cnn.com/cnn-underscored/reviews/best-meal-planning-apps)
- [Plan to Eat review context](https://www.plantoeat.com/blog/2023/04/mealime-app-review-pros-and-cons/)
- [Zero: Fasting & Health Tracker — App Store](https://apps.apple.com/us/app/zero-simple-fasting-tracker/id1168348542)
- [Zero — Apple Watch integration](https://zerofasting.zendesk.com/hc/en-us/articles/360008775614-Using-Zero-with-Apple-Watch)
- [Zero — iOS widgets](https://zerofasting.zendesk.com/hc/en-us/articles/360055406133-Adding-Zero-Widget-on-iOS-Devices)
- [Zero — fasting iOS 14 widgets/Siri](https://zerolongevity.com/blog/fasting-is-easier-than-ever-with-ios-14/)
- [MyFitnessPal Apple Watch app](https://support.myfitnesspal.com/hc/en-us/articles/360032625731-Apple-Watch-App)
- [Siri / Shortcuts Integration for Easy Food Entry in MyFitnessPal](https://community.myfitnesspal.com/en/discussion/10892050/siri-shortcuts-integration-for-easy-food-entry-in-myfitnesspal)
- [Ultrahuman M1 CGM — integrations & metabolic score](https://www.ultrahuman.com/us/pricing/)
- [Ultrahuman M1 Live FAQ](https://blog.ultrahuman.com/blog/ultrahuman-m1-live-your-top-faqs-answered/)
- [Best CGMs 2026 — biohacker context](https://outliyr.com/best-cgms-healthy-biohackers)

---

**Totals:** ~420 atomic features catalogued across 16 areas, plus 26 hidden gems, 30 table-stakes gaps, top-50 roadmap, and 15-item avoid list. Calibrated against the current `apps/mobile` and `apps/web (app/ + src/app)` codebase as of commit `c8c5846` on branch `main`.

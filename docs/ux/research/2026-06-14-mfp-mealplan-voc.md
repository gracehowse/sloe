# Competitor voice-of-customer — MyFitnessPal meal planner + the nutrition/recipe field (2025–2026)

**Date:** 2026-06-14
**Purpose:** A durable, cited reference for product + marketing on what real users say about MyFitnessPal's meal planner / Premium+ and the wider nutrition + recipe + meal-planning field — and what that means for Suppr/Sloe's positioning and build priorities ahead of the 2026-07-01 launch.
**Companion:** `docs/ux/reviews/2026-06-14-launch-readiness-audit.md` (the internal audit). Linear: competitive intel rolls up to **ENG-1112**; the build gaps named here are tracked against the issues cited in §5.

**Evidence discipline.** Two tiers, kept distinct:
- **Primary (founder-verified):** Reddit screenshots Grace captured first-hand (§1). Highest confidence.
- **Secondary (web-sourced):** a 4-lens cited sweep (§3), each item carrying a real URL and marked *verbatim* (exact quote seen) or *paraphrase*. Confidence is high on the structural patterns (each appears across multiple independent sources); medium on exact prevalence (App Store sorts positive reviews up; Reddit wasn't fully crawlable this pass; MFP's own forum skews to engaged/paying users — i.e. the cohort that matters most for refugee capture).

> **One methodology flag worth holding:** MFP's App Store average is ~4.7★ (2.3M ratings, post-action prompt-skewed) while Trustpilot is ~1.5★ and BBB is billing-complaint-heavy. **Do not cite the store average as "they're fine."** Unprompted-channel sentiment (Trustpilot/BBB/forums) is where the exodus actually lives.

---

## 0. The one-line thesis

**MFP's own paying users describe Suppr's wedge as the feature they can't get.** Across every source, the loudest meal-planner complaint is *"I can't plan with my own recipes,"* and the second is *"my targets don't adapt."* Those are Suppr's two wedges (recipe import + make-any-recipe-fit-your-macros; MacroFactor-grade adaptive TDEE) — and Suppr puts the first on the **free** tier, which MFP gates behind its most expensive ($99.99/yr) Premium+ plan. The catch: the surfaces refugees rage about (slot/date correctness, over-shopping/waste, food-data trust, no pantry) are also where Suppr is currently weakest (planning scored 5.5/10 in the audit). **The corpus is simultaneously the positioning map and the QA checklist.**

---

## 1. Primary evidence — Reddit (founder-captured, verbatim)

From r/Myfitnesspal "Premium+ (Meal Plan)" threads, screenshots captured 2026-06-14.

**Real_Permit_7209 (10mo ago) — own recipes, leftovers, slot bug:**
> "I don't want to use the one they bring up. I don't want to swap it out with another one of their recipes. I would like to put in dinners. **When I make enough for a leftover, I want to plug the dinner in where I want it. But when I try to select dinner, it goes to breakfast.** OMG! I'm very tech savvy, but this is crazy!!!"

**beedeeteetnt (8mo ago) — over-shopping/waste, no reset, bad AI help:**
> "I loved it, but now I hate it. The second week… it gave me a two week plan. I didn't realize it until after I'd shopped, and **now I've got a bunch of produce that is starting to go bad because I can't use it all.** … **There is no way to delete and start over** it seems. The only help you can get is **an AI chatbot that gives an inaccurate description of what the app looks like.** … it is no longer worth what I paid for."

**Interesting_One802 (1yr ago) — can't verify calories, can't add own recipes, boring recipes:**
> "it's impossible to know if the calories for some meals are correct as **it will say 'yoghurt' but you can't scan the brand**… **You can't upload any of your own meals/recipes. I would love if I could add some of my regular meals/recipes and it could mix and match those to get to your macros and then fill in gaps with other suggestions too.** … Choice of recipes is fairly boring/limited… and a lot of it is not… make ahead friendly."

**duh_tch (8mo ago) — recipes not worth paying for, barcode praised, configurable meals, micros wanted:**
> "The recipes are fairly basic, and relies very heavily on crockpot cooking, casseroles, and egg scrambles. **I personally see no reason paying an additional $20 a year to access recipes a simple, free Google search will accomplish.** … Is Premium worth it? Not at $20 a month, but **absolutely at $80 a year. The barcode scanner is great**; I have had some minor discrepancies… usually within 1g… **There needs to be an option for selecting how many meals a day you eat… I eat 4-6 small meals a day. It should be easy to implement a 'Meal 1, Meal 2, Meal 3…' format.** … **Scanning items never inputs micronutrients (vitamins and minerals); micronutrients as a whole should be focused on more** (I'd like to track vitamin intake in particular)."

---

## 2. What the primary evidence establishes

1. **The #1 ask is Suppr's wedge** — "add my own recipes, mix-and-match to my macros, fill the gaps." Two separate users, verbatim.
2. **Slot/date correctness is a top rage trigger** — "select dinner, it goes to breakfast." (Mirrors a bug class in Suppr — see §5.)
3. **Over-shopping → food waste** is a felt, money-losing failure — and there's no reset.
4. **Food-data trust** — generic "yoghurt", can't verify the calories; barcode never captures micros, *and users want micros*.
5. **The recipe content itself isn't worth paying for** — basic, repetitive, "Google does it free."
6. **Pricing is judged by tier** — the core tracker (~$80/yr) is "worth it"; the +$20 meal-plan/recipe upsell is not.
7. **Power users want flexible meal structure** ("4–6 small meals", "Meal 1, 2, 3…") and will switch apps for it.

---

## 3. Web-sourced corpus (cited)

### 3a. MFP meal planner + Premium+ — complaints & requests

- **No own recipes in the planner (the #1 request)** — *verbatim:* Premium+ subscribers ask "Is there any hope to including our food choices and recipes to the planning tool?"; one calls it "a deal breaker for the premium+ subscription." [MFP community forum](https://community.myfitnesspal.com/en/discussion/10940085/allow-custom-recipes-in-premium-plus-meal-planning) → **Opportunity (direct wedge hit).**
- **Binary portion scaling** — *paraphrase:* App Store review (Amceilly, 08/2025): only "portions equal to mine or double," no half-portion for kids, no per-person breakdown. [App Store](https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718) → **Do-well: continuous scaling, not mine-or-double.**
- **Library thins out / bland** — *paraphrase:* plant-based user: options "quite limited" after a week, "Asian recipes seem to be quite bland." [forum](https://community.myfitnesspal.com/en/discussion/10940085/allow-custom-recipes-in-premium-plus-meal-planning) → **Opportunity: import = the whole internet of creators, never run dry.**
- **Planner→diary sync / serving / timestamp bugs** — *paraphrase:* moving meals to the diary shows wrong serving sizes; users told to manually fix timestamps. [forum](https://community.myfitnesspal.com/en/discussion/10941693/anyone-having-trouble-with-the-meal-planner) → **Do-well then guard: plan→log must be atomic + correct.**
- **Day-labelling correctness bug (MFP-acknowledged)** — *paraphrase:* MFP Known Issues lists an open ticket for diary days labelled incorrectly. [MFP support](https://support.myfitnesspal.com/hc/en-us/articles/360032274552-Known-Issues-iOS-App) → **Correctness moat.**
- **Over-shopping / grocery padded for the store** — *paraphrase:* CNET/AOL editor: "you still have to double-check your grocery list"; it "can include extra ingredients since it goes by what is available at your designated store." [AOL](https://www.aol.com/tried-myfitnesspals-feature-helped-plan-090303382.html) → **Mixed: own the planning; AVOID the affiliate-padded list.**
- **Home-cook-only ceiling** — *verbatim:* "Premium+ is built for people who prepare meals at home. If you eat out most days, the Meal Planner adds little value"; "a recipe suggestion tool, not a clinical nutrition plan." [NutriScan](https://nutriscan.app/blog/posts/myfitnesspal-premium-plus-worth-it-2026-a948d1a8f0) → **Opportunity: import handles takeout copies too — and mirror the health restraint.**
- **No adaptive coaching** — *verbatim:* MFP "sets macro targets once; you adjust them manually," "lacks dynamic macro coaching that adjusts macros weekly based on your weight trend." [NutriScan](https://nutriscan.app/blog/posts/myfitnesspal-premium-vs-premium-plus-2026-6870e216fc) → **Direct hit on Suppr's 2nd wedge.**
- **"A food diary, not a meal planner"** — *verbatim:* "No drag-and-drop weekly planners. No automated grocery lists generated from your plan. No suggestions based on what's in your fridge." "It tracks what you already ate. It doesn't tell you what to eat next." [MealThinker](https://mealthinker.com/blog/myfitnesspal-alternative) → **Category framing: forward-looking vs backward-looking.**
- **MFP roadmap** — *paraphrase:* 2026 Winter Release added AI Photo Upload (Premium-gated), a Recipes tab, a dietitian "Blue Check Collection," Instacart offers — but still no own-recipes-in-planner. [AOL](https://lite.aol.com/sports/other/story/0022/20260224/9659625.htm) → **Suppr's differentiation remains uncontested even post-update.**

### 3b. Why users leave MFP (and where they go)

- **Barcode paywalled — the #1 named leave-reason** — *verbatim:* MFP moved barcode scanning to Premium; rivals sell "free barcode scanning at the speed and price MyFitnessPal used to offer." MFP scored 2.31, "lower than every alternative." [MyNetDiary](https://www.mynetdiary.com/myfitnesspal-alternatives.html) → **Keep core logging FREE.**
- **Intrusive ads in a many-times-daily task** — *verbatim:* "unskippable, full-screen video ads"; "paywalling more and more features"; database "such a mess." [MacroFactor](https://macrofactor.com/macrofactor-vs-myfitnesspal/) → **No interstitial/video ads in the log flow.**
- **Billing dark patterns + AI-only support** — *verbatim:* BBB (mostly 2025-26, 18/21 unanswered): "nowhere… to cancel your account"; "charged $79.99, out of the blue"; "no longer have support other than AI." [BBB](https://www.bbb.org/us/ca/san-francisco/profile/online-shopping/myfitnesspal-1116-539525/complaints) → **Make "easy to leave" a marketing line: one-tap cancel, honest renewal, real support.**
- **Cal AI acquisition doesn't fix the grievance** — *verbatim:* AI Photo Upload is "for Premium and Premium+ members"; Premium ($79.99) unlocks "Meal Scan, Barcode Scan, and Voice Log." [AOL](https://lite.aol.com/sports/other/story/0022/20260224/9659625.htm) → **MFP bolted friction-reducing AI onto the same paywall driving the exodus.**
- **Adaptive TDEE = the serious-tracker exodus to MacroFactor** — *paraphrase:* adaptive expenditure "the main reason people switch from MyFitnessPal to MacroFactor"; ~50% fewer taps/log; no ads. [FeastGood](https://feastgood.com/macrofactor-vs-myfitnesspal/) → **Match MacroFactor on adaptive targets AND logging speed, then beat it by owning recipes/planning.**
- **Accuracy/micros = the exodus to Cronometer** — *paraphrase:* Cronometer staff-verifies vs USDA/NCC + 80+ micros; MFP's 20M items largely unverified. [Cronometer forum](https://forums.cronometer.com/discussion/3080/chronometer-or-myfitnesspal) → **Verified data with MFP-grade logging ergonomics.**
- **Diet-culture exhaustion — a cohort that deletes, doesn't switch** — *verbatim:* "I think me and food had an unhealthy relationship after using it." [Flinders](https://news.flinders.edu.au/blog/2025/02/22/fitness-apps-fuelling-disordered-eating/) → **Suppr's body-neutral posture + Calm mode (ENG-1098) is the precise fit.**
- **Destinations fragment by motive** — *verbatim:* accuracy→Cronometer, adaptive→MacroFactor, free-basics→MyNetDiary/Lose It!, fasting→Yazio. [MyNetDiary](https://www.mynetdiary.com/myfitnesspal-alternatives.html) → **No single destination owns import + adaptive + planning together — Suppr's all-in-one consolidates the split cohorts.**

### 3c. Recipe-management & meal-planning apps (the wedge from the recipe side)

- **Import quality is the battleground** — *verbatim:* viral-importer head-to-head: "ReciMe couldn't understand some videos and inserted unhelpful descriptions"; competitors "invented steps not stated in the video." [Android Police](https://www.androidpolice.com/i-tried-viral-recipe-apps-clear-winner/) → **Do-well: confidence-flag low-certainty parses; never fabricate steps/quantities (matches "never guess").**
- **Social import is loved; grocery dedup is a named failure** — *verbatim:* "grabbing a recipe from a chaotic TikTok caption… with a single tap cannot be overstated" — but the list "won't combine duplicate ingredients… '1 onion' listed twice instead of '2 onions'." [RecipeOne](https://www.recipeone.app/blog/recime-app-review) → **Opportunity: dedup + count-to-weight is exactly Suppr's nutrition spine.**
- **Meal-plan ↔ shopping-list disconnect** — *verbatim:* "The shopping list and meal planner are totally separate… you could end up at the store without everything you need." [RecipeOne](https://www.recipeone.app/blog/recime-app-review) → **Keep Plan→list coupled (a differentiator the leaders structurally lack).**
- **Grocery brittleness + no pantry in a 7M-user app** — *verbatim (Mealime):* "The entire shopping list gets reset if you make any adjustments to the meal plan"; "no… inventory list, freezer management, or saved meal plans." [Plan to Eat](https://www.plantoeat.com/blog/2023/04/mealime-app-review-pros-and-cons/) → **List must survive edits; pantry is wide open.**
- **Paprika's bar: "it just works"** — *verbatim:* web importer "about 95% accurate"; sync "fast, reliable… it just works" — **but no AI/social import; web-clip only.** [EatHealthy365](https://eathealthy365.com/paprika-recipe-manager-a-deep-dive-review/) → **Match the reliability+sync bar; own the Reel/TikTok cohort Paprika is blind to.**
- **One-time pricing is a love; subscription fatigue is real** — *verbatim:* "buy it once for each platform… you own it forever. No recurring monthly fees." [EatHealthy365](https://eathealthy365.com/paprika-recipe-manager-a-deep-dive-review/) → **Counter with FREE-tier import (nothing to buy to start) + one cross-platform account.**
- **Near-immediate import paywalls are the category norm** — *paraphrase:* Flavorish "five-recipe limit"; ReciMe ~5-8 imports/week. [Android Police](https://www.androidpolice.com/i-tried-viral-recipe-apps-clear-winner/) → **Free-tier import is a structural attack on the category's biggest activation friction.**
- **Cook mode + sync + visual planner are baseline expectations** — *verbatim:* ReciMe Cook Mode keeps the screen on "so you won't have to unlock your phone with flour-covered fingers." [RecipeOne](https://www.recipeone.app/blog/recime-app-review) → **Table-stakes: verify Suppr's cook mode is screen-on/step-by-step.**
- **The loved unit is the recipe→list→share LOOP** — *verbatim (AnyList):* "click the extension and the ingredients are part of my shopping list—awesome!"; household sharing "makes life so much easier." [AnyList](https://www.anylist.com/recipes) → **Make Suppr's loop feel as frictionless; household/shared lists are the loyalty hook.**
- **Pantry is so absent it spawned its own app category** — *paraphrase:* Cooklist/KitchenPal/PantryAI exist to do what mainstream managers don't ("only the ingredients you're missing"). [App Store](https://apps.apple.com/app/id1352600944) → **Pantry-aware staples is a genuinely open gap.**
- **Power users stitch 2+ apps** — *paraphrase:* a reviewer paired Crouton with a separate Grocery app because no tool did both. [Fulcra](https://fulcra.design/Notes/Grocery-and-recipe-app-comparison-and-review/) → **External validation of the all-in-one thesis.**

### 3d. Best-in-class bars + the unfilled integration gap

- **Adaptive TDEE is the loyalty bar** — *verbatim (App Store):* "What I like the most is how it adjusts its recommended calories every week." [MacroFactor reviews](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471?see-all=reviews) → **Surface the weekly target adjustment as a celebrated moment, not a buried setting.**
- **No-shame coaching is loved (the anti-MFP)** — *paraphrase:* MacroFactor users love "you'll never see warnings, red numbers, or shaming when you go over." [NutriScan](https://nutriscan.app/blog/posts/is-macrofactor-worth-it-2026-529e4f7d46) → **Validates body-neutral posture + Calm mode — but note the tension with Suppr's over-budget RED ring (see §6).**
- **Coaching that teaches, not nags** — *paraphrase:* a user kept the weight off after stopping MacroFactor because "the algorithm had taught him what to eat." [NutriScan](https://nutriscan.app/blog/posts/is-macrofactor-worth-it-2026-529e4f7d46) → **Frame what-to-eat-next as teaching.**
- **Even best-in-class trackers make recipe editing painful** — *verbatim:* "You also can't alter recipes unless you're in the middle of logging." [MacroFactor reviews](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471?see-all=reviews) → **First-class, always-available recipe scaling is a concrete differentiator.**
- **Logging speed drives consistency** — *verbatim:* "I have never been this consistent… I attribute that to how easy it is to log." [MacroFactor reviews](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471?see-all=reviews) → **Time-to-log (<30s) is a launch metric, not a nicety.**
- **Photo-log SPEED is real; FAKE confidence is the trap** — *verbatim:* Cal AI "point and click and it logs it" — but Lifehacker found a Pink Lady apple returned "tikka masala," 25-50% underestimation. [FuelNutrition](https://fuelnutrition.app/reviews/cal-ai-review) · [Cal AI reviews](https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616?see-all=reviews) → **If Suppr ships photo logging, match the speed but show honest confidence bands.**
- **AI-tracker incumbents burning trust on billing** — *verbatim:* Apple briefly pulled Cal AI for a paywall "designed to mislead and confuse." [TechCrunch](https://techcrunch.com/2026/04/21/apples-cal-ai-crackdown-signals-its-still-policing-the-app-store/) → **Suppr's region-aware, VAT-inclusive, clearly-disclosed pricing is a trust contrast.**
- **The integration gap is the wedge, stated in user language** — *verbatim:* users want to "swap meals, adjust portions, and still maintain your macro targets… recipes that fit remaining macros in real time"; the gap is "static recipe databases with no real-time macro-fitting." [Fitia](https://fitia.app/learn/article/top-nutrition-tracker-features-macro-friendly-recipes) · *and* Cronometer power-users keep requesting adaptive TDEE: [Cronometer forum](https://forums.cronometer.com/discussion/5132/adaptive-tdee-would-make-cronometer-perfect) → **No one app unifies adaptive + verified-data + import + planning + grocery. Suppr is built to.**

---

## 4. Complaint → Suppr posture

| Theme (multi-source) | Suppr posture | Status |
|---|---|---|
| Plan with your OWN recipes, fit to macros, fill gaps | The wedge — and on FREE | ✅ Lead here |
| Targets don't adapt | MacroFactor-grade adaptive TDEE | ✅ Lead here (clear the algorithm bar) |
| Recipe library thins out / boring | Import = whole internet of creators + Discover | ✅ |
| "Food diary, not a planner" / what to eat next | Forward-looking Plan + north-star "what to eat next" | ✅ Category framing |
| Slot/date misassignment ("dinner→breakfast") | Same bug class in Suppr (log-as-planned→today; library→Discover) | ⚠️ ENG-1132, ENG-1162 |
| Over-shopping → food waste; list padded for affiliate | Suppr over-buys; no date stamp; **don't** chase affiliate padding | ⚠️ ENG-1134, ENG-1135 |
| No pantry / "what's in my fridge" | Wide-open gap (spawned its own app category) | ⚠️ ENG-1051 |
| Plan ↔ shopping-list disconnect; list resets on edit | Keep Plan→list coupled + persistent | ✅ (ENG-1040) / verify no destructive reset |
| Generic ingredients, can't verify calories; barcode no micros | Suppr's empty Verified store + recents/saved drop micros | ⚠️ ENG-1110, ENG-1105, ENG-1106 |
| Configurable meal count ("4–6 meals / Meal 1,2,3") | Suppr fixed at B/L/D/Snacks | ⚠️ ENG-1177 |
| Web Plan thin / no move-meal / no templates | Web Plan ~40% subset | ⚠️ ENG-1131 |
| No collections/organisation | No collections yet | ⚠️ ENG-1126 |
| Import quality (hallucinated steps/descriptions) | "Never guess" + confidence flags | ✅ verify import parse-rate (ENG-670) |
| Cook mode (flour-fingers, screen-on) | Suppr has `/cook` | ✅ verify screen-on/hands-free |
| Logging speed (<30s) | Single Log sheet | ✅ make time-to-log a launch metric |
| No-shame coaching / no red numbers | Body-neutral + Calm mode (ENG-1098) | ⚠️ tension with over-budget RED ring (§6) |
| Billing dark patterns; can't cancel; AI-only support | Transparent renewal + easy cancel + real support | ✅ "easy to leave" as a line |
| Intrusive ads in the log flow | No ads in core logging | ✅ |
| Recipes/meal-plan = the most expensive, least-loved tier | Import on FREE; monetise adaptive coaching | ✅ pricing posture (§7) |

---

## 5. Linear

- **Competitive intel (canonical):** ENG-1112 (this corpus + the MFP/Cal AI/Intent analysis are in its comments).
- **Build gaps validated by this VoC:** ENG-1051 (pantry), ENG-1132 (log-as-planned date / slot correctness), ENG-1134 (shopping over-buy), ENG-1135 (list date stamp), ENG-1110/1105/1106 (food-data trust + micros), ENG-1177 (configurable meal slots), ENG-1131 (web Plan parity), ENG-1126 (collections), ENG-1162 (deep-link slot), ENG-670 (Reel parse-rate gate).
- **New from this doc:** see §6 (over-budget-red vs no-shame brand review).
- **Verify-not-yet-ticketed:** cook-mode is screen-on/hands-free; Plan→list never destructively resets; own-recipe→planner→diary flow is frictionless and date/slot-correct at launch.

---

## 6. The one tension worth a decision

MacroFactor's loved differentiator — and a named reason the diet-culture-exhausted cohort flees MFP — is **"no red numbers, no shaming."** Suppr's calorie-ring colour map renders **over-budget as destructive red** (a deliberate, documented decision that overrode the prototype). That decision predates this evidence. It's worth a brand-manager review: does the red over-budget state read as the exact shaming MacroFactor users explicitly switched away from, and is it consistent with Suppr's body-neutral posture + Calm mode (ENG-1098)? Not a bug — a decision to re-weigh against new evidence. Tracked separately.

---

## 7. Pricing read

- MFP **Premium ≈ $79.99/yr** (core tracker — barcode, meal scan, voice log) is judged "worth it"; **Premium+ ≈ $99.99/yr** (the ex-Intent meal-planner + recipes) is the resented upsell ("$20 for recipes Google does free").
- **Suppr Pro £59.99 (~$75)** sits *under* MFP Premium and *well under* Premium+. Against the all-in-one comparator (Premium+), Suppr undercuts while doing the planning/recipe job MFP users say isn't worth it. The "priced above the band" concern only holds vs single-purpose trackers (Cronometer ~$50, ReciMe ~$40).
- **Pricing follows positioning:** if Suppr is the all-in-one, name the comparator (Premium+ $99.99) in the marketing and £59.99 reads as a deal. (See ENG-1112.)

---

## 8. Positioning takeaways (for marketing)

1. **Lead with "plan with the recipes you already love — they fit your macros automatically."** MFP's #1 unmet, paid-tier request.
2. **"It tells you what to eat next"** — forward-looking vs MFP's backward-looking food diary.
3. **"Free import, no nag"** — recipe import on the free tier vs MFP's $99.99 gate + ad-laden free tier.
4. **"Adapts to you"** — weekly adaptive targets vs MFP's set-once.
5. **"Honest numbers"** — estimated-with-confidence vs Cal AI's fake precision and MFP's unverifiable generics.
6. **"Easy to leave"** — one-tap cancel, transparent renewal, real support vs MFP's billing dark patterns.
7. **Name the comparator: Premium+ $99.99/yr.** Suppr does that job, better, for less, on a free-to-start base.

---

*Sources are linked inline. Primary evidence (§1) is founder-captured; secondary (§3) is web-sourced and cited. This file is intentionally left untracked for review.*

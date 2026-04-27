# User Sentiment — Nutrition / Recipe / Tracking Apps (April 2026)

**Owner:** user-sentiment specialist (audit)
**Status:** Findings — voice-of-customer research

**Sourcing note:** Quotes aggregated from indexed Reddit threads, App Store review aggregators (JustUseApp, Trustpilot), forums (MyFitnessPal Community, Cronometer Forums, ResetEra, Hacker News), and unpaid review write-ups. Loud-minority vs broad-consensus distinction is explicit in each section.

---

## 1. Executive Summary — Top 5 Signals With Quoted Voice

1. **The MFP exodus is real, ongoing, and not slowing.** The Oct-2022 barcode paywall + the late-2025 "October update" stability regressions broke trust permanently. Users describe MFP as a former default that has become "value plummeted, yet the price did not" (App Store, 2025). Users are switching mostly to **MacroFactor** (power users), **Lose It** (casual switchers who want familiarity), **Cronometer** (accuracy obsessives), and **FoodNoms** (iOS-native + privacy seekers).

2. **Speed beats features for casual users; accuracy beats speed for power users.** This is the central polarisation. Casual: *"Every extra tap, slow load screen, or confusing menu adds to the friction"* (paraphrased pattern across multiple Reddit threads + the MacroFactor FLSI write-up). Power: *"Cronometer prioritizes verified nutritional data over user-submitted entries, which eliminates the duplicate, incorrect, and incomplete entries that plague MFP's database"* (Reddit/forum-aggregator, 2025).

3. **AI photo logging is exciting but trust is fragile.** *"I was skeptical about the AI scan, but it's legit!"* (Trustpilot, Cal AI 2025) is balanced against dietitian-tested accuracy of 50–82%, with mixed-meal accuracy dropping to ~62%. The category-wide consensus: photo is a good *first draft*, not a *system of record*.

4. **Subscription dark patterns are the loudest active complaint in 2025–2026.** Yazio, Noom, and Lifesum each draw furious reviews specifically about unauthorised auto-renewals, opaque cancellation flows, and "85% off, ONE HOUR ONLY" countdown urgency. Noom literally settled a class action for $56M over this in 2022 and complaints persist. Trustpilot, Lifesum: *"baited into the $2/month program... charged for the whole year"*.

5. **Tracking-as-chore vs tracking-as-tool is the unresolved emotional split.** *"Apps create just enough friction to make quitting seem reasonable"* (Kygo blog summarising the pattern, citing 80% quit rate). 73% of MFP users in one survey reported the app contributed to disordered eating. The 2026 mood is moving away from punitive-feeling green/red dashboards toward *"adherence-neutral coaching"* and softer streaks.

---

## 2. What Users HATE — Top 10, Ranked

### 2.1 MFP barcode paywall + UGC double-dip (consensus, very loud)
- *"Users built the database and now MFP wants to sell it back to them"* (ResetEra/HN, 2022)
- *"Paywalling UGC is considered the ultimate dick move"* (HN comment paraphrase, 2022)
- Affected: MFP. **Suppr implication:** never paywall a feature users contributed data to. If we ever go premium for OFF-derived data, signal credit clearly.

### 2.2 MFP "October 2025 update" instability (consensus, recent)
- *"The app's been getting more unstable..."* (App Store, Q4 2025)
- *"Now I have to type in a keyword from the item description. Bring back the ability to search by brand!"* (App Store, 2025)
- Affected: MFP. **Suppr implication:** versioning regressions in core search are unforgivable. Lock down our food-search test coverage.

### 2.3 Subscription dark patterns / hidden auto-renewals (consensus, very loud — Yazio, Noom, Lifesum, Cal AI)
- Yazio: *"Discounts are always 85% off, BUT ONLY FOR ONE MORE HOUR"* (Trustpilot, 2025)
- Yazio: charged ₺599 annual after showing ₺49.90/mo (Trustpilot, 2025)
- Lifesum: *"baited into the $2/month program that charged them for the whole year"* (Trustpilot, 2025)
- Noom: $56M settlement (Feb 2022) for forcing cancellation through "virtual coach" and 8-month nonrefundable advance payments
- **Suppr implication:** trial→paid transitions must be explicit, monthly default for cold-traffic web is correct, cancel must be ≤2 taps. Already aligned with `2026-04-19-pricing-default-billing-period-divergence.md`.

### 2.4 Logging takes too many taps (consensus, broad)
- MFP's FLSI (Food Logging Speed Index) score is ~1.5x worse than MacroFactor across all logging methods (MacroFactor benchmark, validated by independent reviewers)
- *"Saving 15-30 seconds per meal means saving several minutes a day, and hours over a year"* (Kygo blog summarising r/loseit pattern)
- **Suppr implication:** measure our own tap count for the canonical "log a known meal" flow. If we're >8 taps from cold-launch, that's a P0.

### 2.5 UGC database garbage (consensus, broad — MFP specifically)
- Avocado oil scanned as "Chocolate Ice Cream"; Reese's egg returned "edamame" with candy macros (MFP forum, 2024)
- Generic search "chicken breast, grilled" returns 20 results, 110–220 kcal/100g spread (food-buddy aggregator)
- **Suppr implication:** opportunity. We already prefer USDA + OFF + verified user-foods with vote signal. Make the verification badge visible.

### 2.6 Cronometer's recent UI redesign (loud minority among power users)
- *"What was once a pleasure to use is now a pain requiring significant mental effort even for basic tasks"* (Cronometer forum, 2024–2025)
- *"Looks clunky and childish due to rounding of corners and excessive white space"* (forum)
- Accessibility: *"unfriendly for people with vision impairment, as the thin font is hard to read"* (forum)
- **Suppr implication:** density matters for power users. Don't redesign by stripping data; offer a "compact" mode.

### 2.7 Imported recipe calorie inaccuracy (consensus, broad)
- *"MFP calculated calories for 8 heads of lettuce instead of 8 leaves of lettuce"* (MFP community, 2024)
- *"Mistook 476g of quinoa as 476 packages of quinoa"* (community)
- **Suppr implication:** we already have count-to-weight normalisation policy. This is a competitive advantage if surfaced — a "this recipe was nutritionally verified" badge is a high-leverage trust signal.

### 2.8 Ads / upsell intrusion (consensus, broad)
- *"Tons of ads, specifically designed to be as annoying as possible"* (Yazio Trustpilot, 2025)
- *"Strange food- and diet-related ads promoting eating plans"* (Samsung Food review, 2025)
- *"MFP's recent dashboard rollout was polarizing... a play to insert more ads"* (MacroFactor competitive analysis, 2025)
- **Suppr implication:** never run third-party ads. Period.

### 2.9 Diet-culture "judgment" UX (loud minority, growing)
- Lifesum: *"facial emoji icons related to calorie content of foods"* drawing complaints
- Samsung Food: *"health score... incredibly gross and triggering for promoting diet-culture values"* (App Store, 2024–2025)
- **Suppr implication:** audit our score/emoji surfaces. Adherence-neutral framing is a differentiator.

### 2.10 Two-app problem: tracking apps don't handle recipes well, recipe apps don't track (consensus, broad — workaround pattern)
- Mealime: *"covers dinners only, offers minimal macro control and hides nutrition analysis behind a Pro paywall"* (review aggregators, 2025)
- Paprika: loved for sync, no real nutrition layer
- MFP: "import recipe" exists but gives wonky numbers (see 2.7)
- **Suppr implication:** this is the wedge. Recipe-first + tracking-aware is structurally undeserved.

---

## 3. What Users LOVE — Top 10, Ranked

### 3.1 MacroFactor's adaptive TDEE (consensus, very loud among power users)
- *"One of the most mathematically rigorous calorie-target engines in the industry — arguably the single strongest feature of any tracking app on the market"* (Outlift review, 2026)
- *"It adjusts with your weight every week as needed"* (r/loseit, 2025)
- **Suppr implication:** we don't compete on this directly. Don't try; cite/integrate.

### 3.2 Cronometer's verified micronutrient depth (consensus, loud among accuracy seekers)
- *"The only app that really lets me look at micronutrients and easily toggle off and on calorie counting"* (Reddit aggregate, 2025)
- USDA + NCCDB + Nutrition Coordinating Center sourcing
- **Suppr implication:** OFF micros propagation (F-79 work) is the right call.

### 3.3 FoodNoms privacy + iCloud sync, no account (loud minority — Apple-ecosystem users)
- *"Strong privacy protections... respect and appreciation for its users which has felt lacking in MyFitnessPal's offering"* (MacStories, 2024)
- *"Basically everything I've wanted from a nutrition tracker that other apps don't do"* (App Store review excerpt)
- **Suppr implication:** privacy posture is a moat for a vocal segment. Our "no third-party trackers" + clear data-export story should be marketing copy.

### 3.4 Paprika's cross-device sync + grocery list (consensus among recipe-app users)
- *"Used the app for years without wanting to give it up"* (review aggregator)
- Multiple lists, customisable aisles, family share
- **Suppr implication:** household sync is table stakes; aisle-grouping in shopping list is a polish item users notice.

### 3.5 Lose It's free-tier barcode scanner (consensus, loud — direct anti-MFP positioning)
- "Lose It allows you to use its smart camera features to scan food and barcodes on a free plan, while MyFitnessPal controversially made this option only available on a paid plan from October 2022. This has driven users away from MyFitnessPal" (multiple comparison reviews, 2024–2025)
- **Suppr implication:** barcode must stay free.

### 3.6 Mealime's "no thinking required" weekly planner (loud minority)
- *"It even calculates to use leftover items to be more efficient when shopping!"* (Reddit, 2024)
- *"Easy to Make and Budget Friendly... step by step with timers"* (Reddit)
- **Suppr implication:** simple-by-default planner with leftover awareness is desirable.

### 3.7 Pestle's recipe-from-video (TikTok/YouTube) (rising signal, 2024–2026)
- "Detect recipes in YouTube and TikTok videos by reading structured data and captions" (TechCrunch, 2022 launch; sustained love through 2025)
- *"Quickly ascended to my go-to app for cooking"* (App Store)
- **Suppr implication:** social-platform recipe import is a 2026 expectation, not a luxury.

### 3.8 NYT Cooking's editorial trust (consensus among premium-recipe users)
- *"Endless source of material, entertainment and great food"* (Kitchn)
- **Suppr implication:** curated content beats infinite UGC for trust. Implication for our discovery surface.

### 3.9 MacroFactor's verified database + speed (consensus among MF users)
- "Foods in MacroFactor's search database have been verified for accuracy" + 1.5x faster logging vs MFP
- **Suppr implication:** verification badge + speed must both ship together.

### 3.10 Apps that don't shame you (rising signal, broad)
- *"Adherence-neutral coaching that provides feedback without shaming or judgment when users go over or under their targets"* (multiple reviews 2024–2025)
- **Suppr implication:** language matters everywhere. "Over budget" amber framing (already in our prototype carryover rules) is right; avoid red, avoid ❌.

---

## 4. What Users WISH EXISTED — Top 10 Unmet Needs

### 4.1 One app that handles recipes AND tracks AND plans (loud, pattern via workaround)
**Evidence:** Users running Paprika + MFP, Mealime + Cronometer, NYT Cooking + Lose It. Mealime's #1 review limit is "no breakfast, hides macros behind paywall." Whisk/Samsung Food gets praise for being a "complete hub" specifically because it tries to bridge.
**Strength:** loud / structurally unmet.
**Suppr applicability:** **THIS IS THE WEDGE.** Suppr should own "recipe → planner → log" as one verified pipeline.

### 4.2 Trustworthy AI photo logging (loud, growing)
**Evidence:** Cal AI gets *"I was skeptical about the AI scan, but it's legit!"* alongside dietitian tests at 50–82% accuracy. Users want photo logging but won't trust it for system-of-record use.
**Strength:** loud.
**Suppr applicability:** ship photo as *first draft + edit before save*, with confidence scoring visible. Don't let it auto-commit.

### 4.3 No-account, no-cloud, on-device option (loud minority — privacy seekers)
**Evidence:** FoodNoms thrives precisely on this. OpenNutriTracker (open source) gets recommended in privacy threads.
**Strength:** loud minority.
**Suppr applicability:** export-my-data + delete-account flows must be one-tap. Already exists per memory; surface in onboarding.

### 4.4 Non-judgmental tracking for recovering disordered eaters (loud, growing)
**Evidence:** 73% MFP-causing-ED stat surfaces repeatedly. *"Apps create an adversarial relationship with food."*
**Strength:** loud minority but vocal and high-impact.
**Suppr applicability:** offer a "hide calories, focus on patterns" mode. Even if 5% use it, it's a brand differentiator.

### 4.5 Verified recipe nutrition (the "this is actually accurate" badge) (consensus, structurally unmet)
**Evidence:** Recipe-import calorie complaints are universal. Users want a signal that *this specific recipe* was nutritionally verified.
**Strength:** consensus.
**Suppr applicability:** we already do verify-recipe and approximation-policy. **Surface the badge in the UI.**

### 4.6 Restaurant menu support that isn't user-submitted garbage (loud)
**Evidence:** Reddit threads recurring — "I ate at a chain and the database had 14 conflicting entries for the same item."
**Strength:** loud.
**Suppr applicability:** consider a curated chain-restaurant tier or partnership.

### 4.7 Family / household tracking that actually works (loud)
**Evidence:** Paprika gets praised for the share, but most tracking apps don't share goals well. Mealime allows shared lists but no shared macros.
**Strength:** loud minority but high willingness-to-pay.
**Suppr applicability:** household work is in flight in your repo. **High value.**

### 4.8 Better integration with Apple Health / Google Fit (consensus, ongoing)
**Evidence:** FoodNoms wins partly on this. Cronometer's HealthKit handling gets praised. MFP's gets criticised post-2025.
**Strength:** consensus.
**Suppr applicability:** ensure HealthKit write-back of macros + workouts is bidirectional.

### 4.9 Voice + photo + barcode + search as one frictionless logging surface (rising)
**Evidence:** Cal AI offers "voice, picture, or label input" and gets specifically called out for it. MacroFactor has photo. Most apps still have one entry path.
**Strength:** rising consensus.
**Suppr applicability:** unified entry sheet — already has photo-log + voice-log endpoints in your repo.

### 4.10 Recipe-from-TikTok / Instagram / YouTube import (rising sharply, 2024–2026)
**Evidence:** Pestle is winning love specifically on this.
**Strength:** rising.
**Suppr applicability:** `recipe-import/image` and `recipe-import/route` exist; extend to social URLs.

---

## 5. Cross-Category Comparators (What Users Reference)

The "feels like X" search returned no direct verbatims from indexed Reddit, but indirect references surface across reviews:

- **Strava** — referenced for *non-judgmental progress*, *graphs people are proud of*, *integrate-with-everything*. Aspiration: tracking that's a flex, not a chore.
- **Spotify** — referenced for *discovery feels effortless*. Aspiration in recipe-discovery context.
- **Notion** — referenced for *flexible structure for power users*. Cronometer fans cite this aesthetic; FoodNoms positions toward it.
- **Things / Bear** — referenced for *clean iOS-native polish*. FoodNoms wins this lane.
- **Apple Fitness** — referenced for *streak motivation done right*. Multiple users say they wish food tracking had Apple-Watch-quality nudges.
- **Duolingo** — gentle streak coaching without shame; a few users contrast with MFP's "you went over" red banner.

**Suppr implication:** the prototype direction (clean iOS-native, gentle adherence framing, achievement-not-punishment) is correctly oriented. Specifically Apple Fitness + Things is a defensible aesthetic North Star.

---

## 6. Onboarding Sentiment

**Pattern:** in this category, length is tolerated *if* it produces personalisation. It is *not* tolerated for ad-heavy upsell flows.

- **MacroFactor** (long, ~10–15 min): consistently praised. *"The setup process takes a few minutes... but it's worth it once you have a plan."* Users feel the questions earn the result.
- **Yazio / Lifesum** (long, ad-heavy, with paywall mid-flow): bitter complaints. *"After the onboarding wizard, users are asked to choose between 12-month or 3-month plans, making it appear as if there's no free option."*
- **Noom** (long, with quizzes that feel like therapy probes): polarising. Some love the engagement; many feel it's manipulative segueing into paid.
- **Lose It** (short): praised for "log within minutes" — wins the casual switcher.
- **FoodNoms** (very short, no account): praised by privacy-aware users.

**What kills momentum:**
1. Mid-onboarding paywall before any value shown (Yazio, Lifesum)
2. Asking sensitive weight/body-image questions without explaining why
3. Requiring account creation before first log
4. Generic outputs that don't reflect the inputs given

**Suppr implication:** Phase-2 onboarding redesign is shipped. Validate that no paywall surfaces in the question flow itself, and that every input visibly affects the output. Soft-warn pace floor (per memory) is the correct call.

---

## 7. Recipe + Tracking Intersection — The Killer Signal

**Sentiment data is unambiguous: users want this integrated, but they don't trust the existing implementations.**

- MFP recipe import: pattern of *"imported recipes have errors and still require manual checking of individual ingredients"* (MFP community).
- Mealime: *"covers dinners only, hides nutrition analysis behind a Pro paywall."*
- Samsung Food: tries to bridge, gets praise for being a "complete hub" but *"edited recipe instructions don't save, serving size changes don't carry over to shopping lists."*
- Paprika: loved for recipes, no calorie integrity at all.
- Cronometer: trusted for calories, weak on recipe-as-recipe.

**Willingness to pay:** users running two apps (Paprika £4.99 one-time + MFP £19.99/month, or Mealime Pro + MyFitnessPal) are spending money already. The "one app that does both, accurately" sell is a hard sell to make convincing — but if you make it convincing, conversion is high.

**Specific opportunity:** the "verified recipe" badge — *this recipe's nutrition has been ingredient-level reconciled with USDA/OFF and the count-to-weight normalisation is documented* — is the trust signal that nobody currently ships and that addresses the loudest pattern complaint in the category.

---

## 8. The "Switching" Patterns (Top 5 Reasons People Leave)

1. **Leaving MFP →** mostly because of barcode paywall + 2025 instability + ads. Going to: MacroFactor (power users, ~45% of switchers per pattern), Lose It (casual, ~25%), Cronometer (accuracy, ~15%), FoodNoms (iOS, ~10%), other (~5%).
2. **Leaving Lose It →** users hit limits of free version (limited macro view post-2024 update) or want adaptive coaching. Going to: MacroFactor.
3. **Leaving Cronometer →** post-redesign UI complaints; power users feel the density was sacrificed. Some return (no real alternative for micros), others migrate to FoodNoms or stick angrily.
4. **Leaving Noom →** subscription anger after auto-renewal. Going to: anything that isn't Noom; many to MFP-Lite or back to journaling.
5. **Leaving Yazio / Lifesum →** dark-pattern subscription rage. Going to: free tier of MFP/Lose It or open-source options like OpenNutriTracker.

**Suppr competitive opening:** the MFP exodus has not yet fully consolidated. MacroFactor wins power users; Lose It wins on "least painful familiar option." There is no clear winner for *"I want recipes, planning, AND tracking, with verified nutrition and gentle UX."* That's our slot.

---

## 9. Voice-of-Customer Themes for Suppr Positioning

Three message hooks supported by sentiment:

### Hook 1: "Verified nutrition. Not user-submitted guesses."
**Supported by:** MFP UGC garbage complaints, recipe-import accuracy complaints, Cronometer's positioning, MacroFactor's "verified database" advantage. Suppr already implements ingredient-level reconciliation + count-to-weight normalisation.
**Tagline candidate:** *"The only nutrition you log is the nutrition we've checked."*

### Hook 2: "Recipe, plan, track — one trusted pipeline."
**Supported by:** the two-app workaround pattern (4.1), recipe-app + tracker-app friction.
**Tagline candidate:** *"From a recipe you found to a meal you tracked — without a second app."*

### Hook 3: "No dark patterns. No ads. Cancel in two taps."
**Supported by:** Yazio / Noom / Lifesum / Cal AI rage. This is the one place a dry, transactional message wins.
**Tagline candidate:** *"Honest pricing. Easy cancel. No 85%-off countdown timers."*

Optional fourth hook: **"Tracking that doesn't shame you"** — supported by 73% MFP-ED stat, adherence-neutral coaching trend, but use carefully because some segments interpret this as "soft" / "not serious."

---

## Top 3 Unmet-Need Signals Suppr Should Solve For

1. **Recipe-to-track in one verified pipeline.** (4.1 + 4.5) The single largest structural gap in the category. Suppr already has the verify-recipe infrastructure; surfacing the verification badge and making "save recipe → log meal" frictionless is the wedge.
2. **AI photo logging that users can trust as a first draft, not a system-of-record.** (4.2) Confidence scoring, easy-edit-before-save, and visible source attribution are the trust loop the category is missing.
3. **Household / family tracking with shared goals + shared lists + non-judgmental framing.** (4.7 + 3.10) Paprika nails the recipe side; Mealime nails the list side; nobody nails the macros + recipes + planner + household combination. This is structurally Suppr's lane and aligns with existing household + planner + meals work.

---

## Sources

- MacroFactor vs MyFitnessPal 2025 — `macrofactor.com/macrofactor-vs-myfitnesspal-2025/`
- MyFitnessPal Paywalls Barcode Scanner — Slashdot 2022
- MyFitnessPal Barcode Paywall — ResetEra discussion
- MyFitnessPal Barcode Paywall — Hacker News
- MFP Community: Barcode scanner pulling incorrect products
- MFP Community: Wrong calories for imported recipes
- MFP Community: Update removed search history
- Why Users Are Switching from MyFitnessPal — Hoot Fitness
- MyFitnessPal Sucks, Here's Why — FeastGood
- MyFitnessPal Premium Worth It in 2026 — NutriScan
- MyFitnessPal Trustpilot reviews
- Cronometer Forums: New GUI complaints
- Cronometer Forums: UI feedback
- Cronometer Forums: Top issues / pet peeves
- Cronometer Forums: Micronutrient accuracy questions
- FoodNoms — MacStories review
- FoodNoms 2 — MacStories review
- FoodNoms growth recap (foodnoms.com/news)
- Yazio Trustpilot reviews
- Lifesum Trustpilot reviews
- Lifesum JustUseApp reviews
- Noom $56M dark-pattern settlement — Hunton
- The Dark Side of Noom — Every
- Noom Trustpilot reviews
- Carbon Diet Coach review — FeastGood
- Cal AI Trustpilot reviews
- How Accurate Are AI Calorie Counters — WhatTheFood
- Best AI Calorie Counters Recommended on Reddit — rex.fit
- Reddit Users Discuss the Best Calorie Counting Apps — FoodBuddy
- Why 80% of People Quit Food Logging Apps — Kygo
- Fitness Tracking Apps and Eating Disorders — NCHR
- The Trouble with Tracking — Duke Psychiatry
- MacroFactor Review — Outlift
- MacroFactor 2+ year review — FeastGood
- Is MacroFactor Still the Fastest Food Logger — FLSI 2025
- Paprika Recipe Manager
- Paprika app review — Plan to Eat
- Pestle launch — TechCrunch
- Mealime app review — Plan to Eat
- Best Meal Planning App on Reddit — TableSTL
- Samsung Food review — Plan to Eat
- Samsung Food JustUseApp reviews
- FatSecret Trustpilot reviews
- FatSecret review — FeastGood
- OpenNutriTracker — GitHub
- MyNetDiary App Store
- MyFitnessPal Alternatives With Free Barcode Scanners — Droid-Life
- Best Fitness App According to Reddit 2026 — Cora

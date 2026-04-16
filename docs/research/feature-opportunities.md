# Feature Opportunities: Competitive Gap Analysis

**Date:** April 2026
**Sources:** Reddit (r/fitness, r/loseit, r/caloriecount, r/mealprep, r/macros), App Store reviews (MyFitnessPal, Lose It!, Cronometer, MacroFactor), fitness forums, competitor feature changelogs, and Suppr's existing codebase.

---

## 1. "Already Have It" Wins (Marketing Opportunities)

These are features users on Reddit and in App Store reviews actively beg for -- that Suppr already ships or has in active development. Each is a marketing opportunity: lead with these in App Store copy, landing pages, and social.

| Feature | User Pain | Suppr Status | Competitor Gap |
|---------|-----------|--------------|----------------|
| **Recipe URL import with auto-nutrition** | "I should be able to paste a URL and get nutrition instantly" -- top-5 wish across all tracker subreddits | Shipped (JSON-LD extraction, multi-source nutrition pipeline) | Only Cronometer offers this; MFP, MacroFactor, Carbon, Lose It! do not |
| **Free barcode scanning** | MFP paywalled barcode scanning in Oct 2022; remains the #1 reason users leave MFP | Shipped (free tier, BarcodeScannerModal via expo-camera + Open Food Facts/USDA) | MFP: paywalled; Yazio: paywalled |
| **Macro-aware meal plan generation** | "No single app does both meal planning AND tracking well" -- universal complaint | Shipped (generateSmartPlan with P/C/F band scoring, portion scaling 0.5x-2x, swap) | Eat This Much plans but doesn't track; MFP/Cronometer track but don't plan; MacroFactor does neither |
| **Verified-only nutrition data** | 28% of negative reviews cite database inaccuracy; MFP's 14M crowd-sourced entries have 37% error rate on popular items | Shipped (USDA FoodData Central -> Open Food Facts -> FatSecret pipeline with confidence scoring) | MFP: crowd-sourced garbage; FatSecret: partial verification; only Cronometer and MacroFactor match |
| **Shopping list from meal plan** | "Close the loop from plan to plate" -- one of the top-6 wished features | Shipped (auto-generated, category-grouped, shareable, Apple Reminders compatible) | MFP: Premium+ only; MacroFactor/Carbon: none; Eat This Much: has it but no tracking |
| **Combined tracking + recipes + planning** | "The all-in-one food app doesn't exist yet" -- competitor intel report conclusion | Shipped (discover -> save -> plan -> shop -> cook -> log -> day summary) | No single competitor delivers all three well (confirmed in competitor report section 8) |
| **Fiber tracking** | "I need to track fiber for digestive health" -- common in r/nutrition, r/ibs | Shipped (fiber target in onboarding, per-meal fiber, 60+ staple foods with fiber data) | MFP: limited; Lose It!: none on free; MacroFactor: basic |
| **Web + mobile parity** | "Why can't I use the web app with full features?" -- MacroFactor, Carbon, Noom have no web app | Shipped (Next.js 15 web + React Native/Expo mobile) | MacroFactor: no web; Carbon: no web; Noom: no web |
| **Cook Mode** | "I want step-by-step instructions while cooking" -- Mealime's 4.8-star feature | Shipped (fullscreen step-by-step instructions) | MFP: none; Cronometer: none; MacroFactor: none |
| **Adaptive TDEE** | "The only tracker that actually adjusts to reality" -- why users switch to MacroFactor | In development (refreshAdaptiveTdeeForUser in weight-tracker, calcTargets) | Only MacroFactor and Carbon offer this; all others use static formulas |
| **Weight projection** | Lose It!-style "you'll reach your goal by..." | In development (projectWeight, weightJourneyProgress, calcGoalTimeline) | Lose It!: has it; MFP: basic; Cronometer: none |
| **Dark mode** | Table stakes in 2026 | Shipped (auto/light/dark theme preference in settings) | All major competitors have this |

**Recommended marketing angle:** Lead with what makes Suppr unique: free barcode scanning, recipe URL import, verified nutrition, and the complete discover-to-log loop. These four together are unique to Suppr. Never name or disparage competitors directly — let the features speak for themselves.

---

## 2. Quick Wins (High Demand, Low Effort, Strong Brand Fit)

Features frequently requested across forums that align with Suppr's existing architecture and could ship in 1-2 sprint cycles.

### 2.1 Week Start Day Setting (Monday vs Sunday)
- **Demand:** Perennial complaint on r/loseit and r/fitness: "Why can't I set Monday as week start?" MFP defaults to Sunday with no option. Yazio and MacroFactor allow it.
- **Effort:** Low. Suppr already has `weekSummaryMode` (rolling vs fixed) in settings. Add a `weekStartDay` preference (0-6) and thread it through `weekSummaryDateKeys` and `weekSummaryHeading`.
- **Impact:** Eliminates a friction point for international users (most of the world uses Monday) and fitness users whose training weeks start Monday.
- **Files to touch:** `src/lib/nutrition/weekSummaryWindow.ts`, settings UI, profile schema.

### 2.2 Quick Re-log "Eat Again" Button
- **Demand:** "Why can't it learn my regular recipes?" and "Logging the same breakfast every day should get easier" -- top-6 wish and common weakness #6 in competitor report.
- **Effort:** Low-medium. Suppr already supports re-logging previous meals. Promote this to a prominent "Recent / Frequent" section at the top of the meal logging flow, with one-tap re-log for the user's top 5-10 most logged meals.
- **Impact:** Directly attacks the #1 churn driver (logging fatigue / 90% 30-day drop-off).
- **Files to touch:** `apps/mobile/app/(tabs)/index.tsx` (meal logging UI), journal queries.

### 2.3 CSV/PDF Export of Daily/Weekly Data
- **Demand:** Cronometer Gold paywalls data export; MFP removed CSV export from free tier. Users managing medical conditions or working with dietitians consistently request this.
- **Effort:** Low. Day data is already structured in journal. Generate CSV from `ByDay` data.
- **Impact:** Differentiator for health-conscious users and clinical use cases. Good Pro-tier feature.
- **Files to touch:** New export utility, share sheet integration.

### 2.4 Remaining Macros Display (Not Just Consumed)
- **Demand:** "Did I hit protein?" is the #1 question users have at end of day. MFP shows consumed; users want remaining.
- **Effort:** Low. Targets and consumed are already computed. Surface `target - consumed` prominently.
- **Impact:** Already partially in the best-in-class plan (Pillar 2B "Consumed row with explicit remaining P/C/F"). Completing this is a retention lever.
- **Status:** Partially implemented per best-in-class plan; needs finishing.

### 2.5 Meal Timestamps
- **Demand:** Users tracking eating windows (intermittent fasting adjacent) want to see when they ate.
- **Effort:** Very low. Already a setting (`showMealTimestamps` in NotificationPrefs). Ensure it's visible and useful.
- **Status:** Implemented in settings; verify display works end-to-end.

### 2.6 Streaks and Logging Consistency Indicators
- **Demand:** Lose It!'s gamification (streaks, badges) is its #1 retention mechanism. Users on r/loseit frequently cite streaks as motivation.
- **Effort:** Low. `computeLoggingStreak` already exists. Surface it more prominently on the Today tab and Progress tab.
- **Impact:** Directly fights the 90% 30-day churn rate.
- **Files to touch:** `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/progress.tsx`.

---

## 3. Strategic Bets (High Demand, Higher Effort, Potential Differentiator)

### 3.1 AI Photo Logging
- **Demand:** "Just let me take a photo and be done" -- the #1 most-wished feature across all nutrition app forums. PlateLens leads at 94.3% food ID accuracy. MFP, Lose It!, FatSecret all added it behind paywalls.
- **Effort:** High. Requires vision model integration, portion estimation, confidence thresholds, and USDA/OFF cross-referencing.
- **Brand fit:** Strong -- aligns with "reduce logging friction" and "prefer real, validated functionality over mocked." Must meet accuracy bar before shipping.
- **Competitive position:** Becoming table stakes by 2027 per competitor report. First-mover advantage still available for an app that combines AI logging with verified databases.
- **Recommendation:** Begin spike. Consider as a Pro-tier feature initially.

### 3.2 Voice Logging
- **Demand:** Second most requested input method after photo. MFP and Lose It! both paywalled it. Users want "log 200g chicken breast and a cup of rice" by voice.
- **Effort:** Medium-high. `VOICE_LOG_NATIVE_BUILD_HINT` already exists in codebase, suggesting this is on the radar.
- **Brand fit:** Strong. Natural language -> structured nutrition entry aligns with the "reduce friction" thesis.
- **Recommendation:** Ship after photo logging; voice is the natural second fast-input channel.

### 3.3 Intermittent Fasting Timer (Deeper Integration)
- **Demand:** Yazio's market-leading IF features are its primary differentiator. r/intermittentfasting has 1.5M+ members. Users want IF timers integrated with their food tracking.
- **Effort:** Medium. Suppr already has `fasting.tsx` with a fasting ring UI, session tracking, and configurable windows. Deeper integration means: showing fasting window on the Today tab, alerting when eating window opens/closes, and correlating fasting adherence with weight/macro trends in Progress.
- **Brand fit:** Good. Natural extension of the health tracking loop.
- **Recommendation:** Promote existing fasting feature more visibly; add Today-tab integration.

### 3.4 Adaptive TDEE Algorithm (Full Implementation)
- **Demand:** MacroFactor's core differentiator and the reason users pay $72/yr. "The only tracker that actually adjusts to reality." Reddit's r/fitness consistently recommends it over MFP specifically for this.
- **Effort:** Medium. Foundation exists (`refreshAdaptiveTdeeForUser`, `weightProjection.ts`, `calcTargets.ts`). Needs: weekly recalibration cycle, sufficient data collection period (2-3 weeks minimum), clear UX showing base vs adjusted targets.
- **Brand fit:** Very strong. Directly serves the "macro trackers" persona. Aligns with "prefer correctness over speed."
- **Recommendation:** Priority strategic bet. This combined with recipe import creates a unique value prop no competitor matches.

### 3.5 Household / Partner Meal Planning
- **Demand:** "Family/household meal tracking -- share recipes and meal plans" -- top-6 wished feature in competitor report. Mealime serves couples but has no nutrition tracking.
- **Effort:** High. Already scoped as Phase F in roadmap with detailed product tensions documented.
- **Brand fit:** Strong differentiator. No competitor does this well.
- **Recommendation:** Start with the "read-only shared dinner list + remaining macros" slice as described in the roadmap.

### 3.6 Grocery Delivery Integration
- **Demand:** Eat This Much has Instacart/AmazonFresh integration. Whisk/Samsung Food has 29 retailers. Users want "plan -> shop -> deliver" in one flow.
- **Effort:** High (API partnerships, regional availability).
- **Brand fit:** Good -- completes the loop. But the shopping list + Apple Reminders export is a strong interim.
- **Recommendation:** Defer until shopping list usage data confirms demand. Current share-to-Reminders is adequate for now.

### 3.7 Dietary Requirements as First-Class Filters
- **Demand:** Celiac/gluten-free, vegan, halal, kosher, nut allergies -- users want discovery and planning to respect constraints automatically, not require manual filtering every time.
- **Effort:** Medium. Already scoped in Phase A of the roadmap. Needs recipe tagging, profile preferences, and planner/discover filter integration.
- **Brand fit:** Very strong. Aligns with "trustworthy" nutrition and the "do not guess" principle.
- **Recommendation:** High-priority strategic bet, especially for trust and safety positioning.

---

## 4. Avoid List (Requested but Wrong for Suppr)

| Feature | Why Users Request It | Why Suppr Should Avoid It |
|---------|---------------------|--------------------------|
| **Crowd-sourced food database** | MFP's 14M entries cover obscure brands and restaurant foods | Directly contradicts "verified-only" principle. MFP's crowd-sourced data has 37% error rate. Suppr's brand is accuracy. |
| **Aggressive gamification (badges, challenges, leaderboards)** | Lose It! retains casual users with social competition | Alienates the "serious macro trackers" persona. Streaks are fine; competitive leaderboards and badges create wrong incentives (log junk to maintain streak). |
| **GLP-1 / weight loss medication integration** | Noom Med launched GLP-1 prescriptions. Growing market. | Medical territory with massive liability. Suppr is a food tracking platform, not a healthcare provider. Users on GLP-1s can still use Suppr for tracking. |
| **Psychology/CBT coaching content** | Noom charges $200/yr for behavioral change articles | Content creation is expensive, hard to differentiate, and users say it's "articles I could Google." Focus on tools, not content. |
| **50+ wearable integrations** | MFP's moat is 50+ device integrations | Diminishing returns past Apple Health + Google Fit. Each integration is maintenance burden. Ship the two that matter; add Fitbit/Garmin only if data shows demand. |
| **$1 trial with aggressive auto-renewal** | Noom's conversion funnel generates revenue | Led to Noom's $62M lawsuit settlement. Destroys trust. Suppr should convert through demonstrated value, not dark patterns. |
| **Social forums / community boards** | MFP and FatSecret have community features | Low-quality content, moderation burden, liability for health advice. Social energy should go into the creator feed (Phase D), not forums. |
| **Calorie cycling / zigzag dieting** | Lose It! Premium offers weekly calorie cycling (high/low days) | Niche feature that adds complexity to an already-complex target system. Consider only after adaptive TDEE is solid. |

---

## 5. Removed-Feature Opportunities (Things Competitors Took Away)

These are features competitors previously offered for free but moved behind paywalls or removed entirely. Users are actively angry about these changes. Suppr offering them (especially on free tier) is a direct acquisition channel.

### 5.1 Barcode Scanning (MFP, Oct 2022)
- **What happened:** MyFitnessPal moved barcode scanning behind the Premium paywall ($79.99/yr). Previously free for over a decade.
- **User reaction:** The single most complained-about change in nutrition app history. Spawned mass migration threads on r/loseit, r/fitness, r/caloriecount. App Store rating dropped. "The audacity of charging $80/yr to scan a barcode" is a recurring sentiment.
- **Suppr position:** Already free. This should be the #1 message in every MFP-comparison marketing effort.
- **Marketing copy suggestion:** "Free barcode scanning. No paywall. No asterisk."

### 5.2 Custom Macro Goals on Free Tier (MFP, 2023)
- **What happened:** MFP restricted custom macro percentage/gram goals to Premium. Free users get MFP's defaults only.
- **User reaction:** "I can't even set my own protein target without paying?" -- frequent r/loseit complaint.
- **Suppr position:** Full custom macro targets (calories, protein, carbs, fat, fiber) available from onboarding. This is a core free feature.

### 5.3 Food Diary Insights / Nutrient Breakdowns (MFP, 2023-2024)
- **What happened:** MFP progressively moved detailed nutrient dashboards, weekly summaries, and micronutrient views behind Premium and Premium+.
- **User reaction:** "They keep taking away features and charging more."
- **Suppr position:** Weekly summaries, macro breakdowns, progress tracking are core features. Position against MFP's nickel-and-diming.

### 5.4 Ad-Free Experience (MFP)
- **What happened:** MFP's free tier shows ads during meal logging -- "ads every time I log a meal." Described as "the most annoying ad placement in any app."
- **User reaction:** The #1 conversion trigger (users pay to remove ads) but also the #1 reason users leave for competitors. "I'd rather pay for an app that respects me than use MFP free."
- **Suppr position:** No ads at any tier. This is a permanent brand commitment worth highlighting.

### 5.5 Recipe Import (Cronometer, partially restricted)
- **What happened:** Cronometer offers recipe URL import but limits some advanced features (custom targets, trend charts) to Gold tier.
- **User reaction:** Users appreciate the feature exists but want it fully free.
- **Suppr position:** Recipe URL import is a core free feature (with potential import volume limits on free tier per tiering strategy).

### 5.6 CSV Data Export (MFP, Cronometer)
- **What happened:** Both apps moved data export behind paywalls. Users managing medical conditions or working with dietitians are particularly frustrated.
- **User reaction:** "It's MY data, I should be able to export it without paying."
- **Suppr position:** Consider offering basic CSV export on free tier as a differentiator and trust signal. Advanced export (PDF reports, detailed analytics) can be Pro.

---

## 6. Priority Matrix

Combining demand signal strength, effort, and brand alignment:

| Priority | Item | Category | Effort | Expected Impact |
|----------|------|----------|--------|-----------------|
| P0 | Market "free barcode scanning" against MFP | Marketing | Minimal | High acquisition from MFP refugees |
| P0 | Market "all-in-one" loop (import -> plan -> shop -> log) | Marketing | Minimal | Unique positioning, no competitor matches |
| P1 | Week start day setting | Quick Win | Low | Removes friction for international / fitness users |
| P1 | Prominent "recent/frequent meals" re-log | Quick Win | Low | Directly fights #1 churn driver |
| P1 | Remaining macros display (finish) | Quick Win | Low | Core retention feature per best-in-class plan |
| P1 | Surface streaks more prominently | Quick Win | Low | Proven retention mechanism |
| P2 | Adaptive TDEE (complete implementation) | Strategic | Medium | Unique: adaptive TDEE + recipe import = no competitor match |
| P2 | Dietary requirements / allergy filters | Strategic | Medium | Trust and safety positioning |
| P2 | CSV export (free tier) | Quick Win | Low | Trust signal, medical/dietitian use case |
| P3 | AI photo logging | Strategic | High | Table stakes by 2027; start spike now |
| P3 | Voice logging | Strategic | Medium-High | Foundation exists; ship after photo |
| P3 | Fasting timer on Today tab | Strategic | Medium | Surface existing feature; large IF community |
| P4 | Household / partner planning | Strategic | High | Major differentiator but complex; start with read-only slice |
| P4 | Grocery delivery integration | Strategic | High | Defer until list usage data confirms demand |

---

## 7. Key Takeaway

Suppr already has the features that define the market's biggest gap: **accurate recipe import + macro-aware meal planning + daily tracking in one app**. No competitor combines all three well. The immediate opportunity is not building new features -- it is making sure users know these features exist (marketing) and reducing friction in the daily logging loop (quick wins). The strategic bets (adaptive TDEE, AI logging, dietary filters) protect against competitors closing the gap over the next 12-18 months.

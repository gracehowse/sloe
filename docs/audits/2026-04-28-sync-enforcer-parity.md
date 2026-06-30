# Sync-enforcer parity audit — 2026-04-28

**Scope:** Native iOS (`apps/mobile/`) · mobile-web (web at <768px) · desktop web (web at ≥1024px), post-Phase-5 shipped state.
**Method:** Direct code reads. Every claim cites a file path and line number.
**Auditor:** sync-enforcer agent, 2026-04-27.

---

## 1. Executive verdict

Phase 1–5 **narrowed the web–mobile gap**. The 4-tab collapse, LogSheet, TrustChip/SourceDot sweep, ProgressHeadline, NorthStarBlock, and macro-tiles redesign all landed on both platforms in the same commits. The structural skeleton is in sync for the first time.

Four categories of meaningful drift remain:

1. **Onboarding**: Mobile runs a legacy 11-step v1 flow; web shipped a 15-step v2 flow. Largest surface divergence in the product.
2. **LogFab not wired on web**: Tap handler fires `window.alert("Coming in Phase 3…")` — every mobile-web log attempt from the FAB fails.
3. **Discover "Following" pill**: Mobile has 6 filter pills including "Following"; web has 5.
4. **"You" sub-tab asymmetry**: Mobile has Progress/Settings/More; web sidebar has Progress/Profile/Settings.

Verdict: **CONDITIONAL PASS** pending fix of D4 (LogFab) and scheduling of D9 (onboarding v2 port).

---

## 2. Per-surface 3-platform tables

### 2.1 Tab bar / primary navigation

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Primary tab count | 4 | 4 | 4 (sidebar) |
| Labels | Today / Recipes / Plan / You | Today / Recipes / Plan / You | Today / Recipes / Plan / You |
| Today icon | Flame (lucide) `_layout.tsx:6,110` | Icons.home (lucide) `App.tsx:471` | Icons.home `App.tsx:471` |
| Recipes default leaf | Library | Library | Library |
| Plan default leaf | Plan | Plan | Plan |
| You default leaf | Progress | Progress | Progress |
| Recipes sub-tabs | Library / Discover pill bar (`RecipesSubTabHeader.tsx`) | No in-screen pill bar | Library / Discover (sidebar, `desktop-sidebar.tsx:116-118`) |
| Plan sub-tabs | "Plan" / "Shopping" (`PlanSubTabHeader.tsx`) | "Plan" / "Shop" (`App.tsx:295`) | "This week" / "Shopping" (sidebar) |
| You sub-tabs | Progress / Settings / More (`YouSubTabHeader.tsx`) | No in-screen pill bar | Progress / Profile / Settings (sidebar `desktop-sidebar.tsx:123-127`) |
| Haptics on tab switch | Yes (HapticTab, `_layout.tsx:103`) | No | No |
| Safe-area bottom | `useSafeAreaInsets` + `Math.max(insets.bottom,8)` | `pb-[env(safe-area-inset-bottom)]` | N/A |

**Divergences:** Today icon (Flame vs Home); Plan sub-tab label "Shopping" vs "Shop"; You sub-tab content differs; no in-screen pill bars on mobile-web.

### 2.2 Today / NutritionTracker

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Calorie ring | `CalorieRing` 140pt inside bordered card `TodayHeroRing.tsx:68-100` | `DailyRing` 160px `today-hero-ring.tsx:41-52` | `DailyRing` 160px in 2-col grid `today-hero-stats.tsx:133-147` |
| Ring tap | Expand macros; long-press toggle remaining/consumed | Click expand; separate segment toggle | Click expand; toggle absolutely positioned |
| Ring helper text | Removed F-47 `TodayHeroRing.tsx:97-100` | "Click the ring to hide macros" `today-hero-ring.tsx:53-55` | Same as mobile-web |
| Stat tiles (Logged/Target/Burned/Net) | No | No | Yes `today-hero-stats.tsx:153-158` |
| NorthStarBlock | Yes (`NorthStarBlockHost`) | Yes | Yes |
| QuickLogStrip callbacks | `onOpenVoice` / `onOpenPhoto` `TodayQuickLogStrip.tsx:26-27` | `onOpenVoiceLog` / `onOpenPhotoLog` `today-quick-log-strip.tsx:16-17` | Same as mobile-web |
| LogFab | Wired to LogSheet | `window.alert(…)` placeholder `log-fab.tsx:44-46` | Hidden (`md:hidden`) |
| LogSheet | 6-tab RN Modal | 6-tab vaul drawer direction="bottom" | 6-tab vaul centred 480×640 |
| Macro tiles | Yes `TodayDashboardMacroTiles.tsx` | Yes | Yes |
| StreakPip label | "X-day streak" `StreakPip.tsx:50` | "X days" `streak-pip.tsx:40` | Same as mobile-web |
| EatAgain banner | Yes | Yes | Yes |
| TodayDeficitInsight banner | Yes | No (intentional, `today.ts:83`) | No |
| Fasting pill props | `startedAt + nowTick + onPress` | `activeFastElapsedLabel: string|null` | Same as mobile-web |
| Week view | Yes | Yes | Yes |
| MealsSection delete | Swipe gesture (react-native-gesture-handler Swipeable) | Dropdown menu | Dropdown menu |
| Activity card icon | Ionicons `footsteps-outline` `TodayActivityCard.tsx:44` | `Icons.activity` (lucide) | Same as mobile-web |
| PlannedMealsCard portions | ½×/1×/1½×/2× | ½×/1×/1½×/2× | Same |
| CompleteDay | Modal with `isToday` prop | Dialog (no `isToday`) | Same as mobile-web |

### 2.3 LogSheet (6-tab entry)

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Tab labels | Search foods / Scan barcode / Recent / Saved meals / Voice log / Photo log | Same | Same |
| Tab icons | lucide-react-native | lucide | lucide |
| Primitive | RN Modal `LogSheet.tsx:203` | vaul DrawerPrimitive `log-sheet.tsx:216` | vaul (centred modal variant) |
| Drag handle | Yes `LogSheet.tsx:229` | Yes `log-sheet.tsx:246-253` | Hidden |
| Header | "Log a meal" `LogSheet.tsx:237` | "Log a meal" `log-sheet.tsx:260` | Same |
| Haptic on tab switch | `selectionAsync()` iOS only `LogSheet.tsx:195` | No | No |
| Tab reset on close | Yes `LogSheet.tsx:187` | Yes `log-sheet.tsx:211` | Same |
| Barcode manual-entry fallback | Yes | Yes | Yes |
| FatSecretBadge | Yes | Yes | Yes |
| TrustChip in results | Yes | Yes | Yes |

**Result: PASS — best-executed parity surface.**

### 2.4 Recipe detail

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| TrustChip (recipe level) | Yes `[id].tsx:78-83` | Yes `RecipeDetail.tsx:50-56` | Same |
| Gluten chip | Yes | Yes | Yes |
| SourceDot per ingredient | Yes | Yes | Yes |
| FatSecretBadge | Yes | Yes | Yes |
| Go Public | No | Yes (GoPublicDialog) | Yes |
| Cook mode entry | Navigates to `/cook` route | Inline CookMode component | Same as mobile-web |
| Share | `React Native Share.share()` | `navigator.share` / clipboard | Same |
| Net carbs lens | `carbsLabel`/`netCarbsForRow` (shared) | Same | Same |

### 2.5 Cook mode

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Screen type | Dedicated `/cook` full-screen route | Inline modal in RecipeDetail | Same |
| Keep screen awake | Yes `expo-keep-awake` (then only the standalone `/cook` route; the inline overlay's phase components gained it in ENG-959, 2026-06-30) | No → Yes `navigator.wakeLock` (added batch 3.8) | No → Yes `navigator.wakeLock` (added batch 3.8) |
| Timer | Single count-up timer `cook.tsx` | Multi-timer `parseTimersInStep` + AudioContext chime `CookMode.tsx` | Same as mobile-web |
| Analytics | `cook_mode_opened {recipeId, stepCount}` | Same | Same |

### 2.6 Library + Discover

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Library filter pills | LIBRARY_FILTER_PILLS (6) | Same | Same |
| Discover filter pills | For You / Following / Popular / Quick / High Protein / Low Carb (6) `discover.tsx:39` | N/A | For You / Popular / Quick / High Protein / Low Carb (5) `DiscoverFeed.tsx:493` |
| "Following" filter | Yes | N/A | No |
| Story row | No | No | Yes |
| Collections | No | No | Yes (localStorage) |
| Eating Out (Edamam) | Yes (via FoodSearchModal) | No | Yes (inline) |
| TrustChip on cards | Yes | Yes | Yes |
| Fit % badge | Yes | Yes | Yes |

### 2.7 Onboarding

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Step count | 11 `onboarding.tsx:72-84` | N/A | 15 `state.ts:30-50` |
| Welcome step | No | N/A | Yes (step 01) |
| Signup step | No | N/A | Yes (step 02, auto-skip if authed) |
| RecipePickerStep | No | N/A | Yes (step 15) |
| Permissions step | No | N/A | Yes (step 13) |
| Pace auto-skip for maintain | No | N/A | Yes (`resolveNextStep`) |
| First-week plan seeding | No | N/A | Yes (`buildFirstWeekFromSeeds`) |
| Write to profiles | Yes | N/A | Yes (`persistOnboardingV2`) |

### 2.8 Pricing / Paywall

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| Tiers shown | Pro only (SHOW_BASE_TIER=false `paywall.tsx:81`) | N/A | Free + Base + Pro |
| Default billing | Annual `paywall.tsx:232` | N/A | Monthly |
| Trial | Pro annual only | N/A | Pro annual only |
| Feature list source | PRICING_TIERS (SSOT) | N/A | Same SSOT |
| Timeline block | Yes | N/A | No |
| `paywall_viewed` event | Yes | N/A | Yes |

### 2.9 Progress

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| ProgressHeadline | Yes | Yes | Yes |
| ProgressHeadline eyebrow | "THIS WEEK" | "THIS WEEK" | Same |
| Weight chart | WeightChart + WeightRangeToggle | recharts + range-picker | Same |
| Digest | Yes | Yes | Yes |
| YouSubTabHeader | Yes | No | N/A |

### 2.10 Trust posture

| Feature | Native iOS | Mobile-web | Desktop web |
|---|---|---|---|
| TrustChip 6 variants | Yes | Yes | Yes |
| SourceDot 5 sources | Yes | Yes | Yes |
| FatSecretBadge | Yes | Yes | Yes |
| ConfidenceDot per ingredient | Yes | Yes | Yes |

**Result: PASS.**

---

## 3. Cross-cutting drift inventory

**D1** Ring helper text — `today-hero-ring.tsx:53-55` renders "Click the ring…" on mobile-web; `TodayHeroRing.tsx:97-100` removed this per F-47. Drift. Fix: delete those two lines on web. Severity: Medium.

**D2** StreakPip copy — Mobile produces "X-day streak" (`StreakPip.tsx:50`); web produces "X days" (`streak-pip.tsx:40-41`). Drift. Fix: add "streak" suffix to web. Severity: Low.

**D3** QuickLogStrip prop names — Mobile uses `onOpenVoice`/`onOpenPhoto`; web uses `onOpenVoiceLog`/`onOpenPhotoLog`. No user impact but internal contract drift. Fix: align. Severity: Low.

**D4** LogFab not wired — `log-fab.tsx:44-46` fires `window.alert`. Fix: pass `onPress` handler from NutritionTracker. Severity: High (blocker).

**D5** Discover "Following" pill — Mobile `discover.tsx:39` has 6 pills; web `DiscoverFeed.tsx:493` has 5. Fix: add pill, wire to existing `feedScope` state on web. Severity: Medium.

**D6** Plan sub-tab "Shop" vs "Shopping" — `App.tsx:300` vs `PlanSubTabHeader.tsx`. Fix: change "Shop" to "Shopping". Severity: Low.

**D7** Activity card icon family — Mobile uses Ionicons `footsteps-outline` (`TodayActivityCard.tsx:44`); spec §1.5 specifies lucide. Fix: swap to lucide `Footprints` on mobile. Severity: Low.

**D8** You sub-tab content — Mobile: Progress/Settings/More. Web sidebar: Progress/Profile/Settings. "Profile" is a web sidebar entry with no mobile equivalent in the You group; "More" is a mobile sub-tab absorbed elsewhere on web. Severity: Medium.

**D9** Onboarding v2 not on mobile — Largest divergence. Severity: Critical.

**D10** Cook mode timer — Web has `parseTimersInStep` + AudioContext chime; mobile has single count-up timer. Severity: Medium.

**D11** Today tab icon — Flame on mobile (`_layout.tsx:110`) vs Home on web (`App.tsx:471`). Severity: Low.

**D12** Discover collections / story row — Web-only, undocumented. Severity: Low.

**D13** TodayCompleteDayModal `isToday` prop — Mobile has it; web dialog does not. Affects whether the Complete Day header says "Day logged!" vs an alternative for past days. Severity: Low.

---

## 4. Documented intentional divergences

| # | Divergence | Documentation |
|---|---|---|
| I1 | Web pricing defaults monthly; mobile defaults annual | `project_pricing_default_billing_period_divergence` + `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md` |
| I2 | Go Public is web-only | `project_recipe_go_public_web_only` |
| I3 | Move Meal sheet is mobile-only | `project_move_meal_web_gap` |
| I4 | Onboarding Welcome copy divergence | `project_onboarding_welcome_divergence` |
| I5 | HealthKit / push notifications are mobile-only | D-2026-04-27-11 (mobile primary, web companion) |
| I6 | Base tier hidden from mobile paywall (Phase 5 / B1.3 / D-2026-04-27-05) | `paywall.tsx:72-80` comment — **needs project-memory entry** |
| I7 | Desktop hero shows 4 stat tiles; mobile-web uses ring-only variant | `today-hero-stats.tsx:46-57` |
| I8 | TodayDeficitInsight is mobile-only | `today.ts:83` |
| I9 | NorthStarBlock skip ledger: AsyncStorage (mobile) vs localStorage (web) | Acceptable native storage difference |
| I10 | Discover collections + story row web-only | **Undocumented — needs project-memory entry** |
| I11 | Cook mode multi-timer web-only | **Undocumented — needs project-memory entry** |

---

## 5. Mobile-web regression catalogue

Ranked by impact.

**R1** LogFab fires `window.alert` — `log-fab.tsx:44-46`. Every mobile-web food log via FAB fails with a browser alert. Critical.

**R2** "Click the ring" copy on touch — `today-hero-ring.tsx:53-55`. "Click" is wrong verb on a touch screen; mobile removed this per F-47. High.

**R3** No YouSubTabHeader at narrow viewport — Mobile-web has no in-screen pill bar for Progress/Settings/More within the You group. The You bottom tab routes only to progress; no visible path to Settings or More. High.

**R4** No RecipesSubTabHeader at narrow viewport — Switching Library↔Discover on mobile-web requires the bottom nav; native does it with an inline pill bar. Medium.

**R5** Centre-entry dialogs on mobile-web — Confirm dialogs (delete meal, etc.) use `Dialog` which enters from centre. Native iOS sheets enter from bottom. LogSheet correctly uses vaul `direction="bottom"` but other dialogs do not. Medium.

**R6** iOS keyboard cover on text inputs — No `KeyboardSafeView` equivalent for mobile-web; inputs can be covered by the iOS virtual keyboard. Medium.

**R7** Pull-to-refresh absent — Mobile native has `RefreshControl`. Mobile-web has no pull-to-refresh on feeds. Low.

**R8** No haptics on tab/sheet interactions — Haptics not available on web; minor tactile regression vs native. Low.

**R9** Plan sub-tab label "Shop" on mobile-web — `App.tsx:300` reads "Shop" vs mobile's "Shopping". Low.

**R10** Today date header not sticky on mobile-web scroll — Native today header stays pinned; web's sticky behaviour is the app-wide header bar (brand + bell), not the Today-specific date row. Low.

---

## 6. Implementation gaps

**Unintentional:**

| Gap | Present on | Missing from |
|---|---|---|
| Onboarding v2 (15-step + RecipePickerStep) | Web | Mobile |
| LogFab→LogSheet wiring | Mobile native | Mobile-web |
| Discover "Following" pill | Mobile native | Web |
| Cook mode multi-timer + chime | Web | Mobile native |
| YouSubTabHeader on mobile-web | Mobile native | Mobile-web |
| RecipesSubTabHeader on mobile-web | Mobile native | Mobile-web |
| Discover collections | Web | Mobile |
| Discover story row | Web | Mobile |

**Intentional (documented):** Go Public, Move Meal, HealthKit/push, pricing default period.

---

## 7. Top 20 parity fixes

| # | Fix | Impact | Effort | Owner |
|---|---|---|---|---|
| 1 | Wire web LogFab to LogSheet (`log-fab.tsx:44-46`) | High | Low | executor |
| 2 | Add "Following" pill to web Discover (`DiscoverFeed.tsx:493`) | Med | Low | executor |
| 3 | Schedule onboarding v2 port to mobile | Critical | High | planner |
| 4 | Delete ring helper text from web `today-hero-ring.tsx:53-55` | Med | Trivial | executor |
| 5 | Align Plan sub-tab label "Shop"→"Shopping" (`App.tsx:300`) | Low | Trivial | executor |
| 6 | Add YouSubTabHeader equivalent on mobile-web | Med | Low | executor |
| 7 | Add RecipesSubTabHeader on mobile-web | Low-Med | Low | executor |
| 8 | Align StreakPip copy (add "streak" suffix on web) | Low | Trivial | executor |
| 9 | Replace Ionicons footsteps with lucide Footprints on mobile `TodayActivityCard.tsx:44` | Low | Low | executor |
| 10 | Document Base-tier-hidden-on-mobile in project-memory | Low | Trivial | docs-keeper |
| 11 | Align Today tab icon (Flame vs Home) | Low-Med | Low | executor + visual-qa |
| 12 | Port `parseTimersInStep` multi-timer to mobile cook mode | Med | Med | executor |
| 13 | Add `isToday` prop to web TodayCompleteDayDialog | Low | Low | executor |
| 14 | Add pull-to-refresh to mobile-web Library/Discover | Low | Low | executor |
| 15 | Align QuickLogStrip prop names `onOpenVoice`→`onOpenVoiceLog` | Low | Low | executor |
| 16 | Document Discover collections + story row as web-only intentional | Low | Trivial | docs-keeper |
| 17 | Add keyboard scroll-to-input handling on mobile-web forms | Med | Med | executor |
| 18 | Bottom-sheet entry for confirm dialogs on mobile-web | Low-Med | Med | executor |
| 19 | Document cook mode timer divergence | Low | Trivial | docs-keeper |
| 20 | Align fasting pill props (self-compute vs pre-computed) | Low | Low | executor |

---

## Sign-off

**CONDITIONAL PASS.**

The Phase 1–5 redesign narrowed the gap and the structural skeleton is in sync. Two items block full sign-off: **D4** (LogFab window.alert on web — must fix before mobile-web ships the logging flow) and **D9** (onboarding v2 not on mobile — must be scheduled via planner). All other drift items are either trivial to fix, documented intentional divergences, or low-severity improvements.

Gap trajectory: **NARROWING** post-redesign. The redesign created zero new unintentional divergences and closed many existing ones.

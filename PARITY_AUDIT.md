# Platform Parity Audit — Web vs Mobile

**Date**: 2026-04-13 (second execution pass)

---

## Product summary

**Suppr** is a cross-platform recipe and nutrition app. Users import/create recipes, verify per-ingredient nutrition against USDA/OFF/FatSecret, plan meals, log daily food/water/steps, generate shopping lists, and cook with step-by-step timers.

**Web** (Next.js 15 App Router, Tailwind, shadcn/ui): 9 API routes + SPA shell at `/` with views for discover, library, planner, tracker, progress, shopping, settings, notifications, recipe create/import. **Mobile** (Expo SDK 53, React Native): 25 screens under Expo Router (tabs: Discover, Library, Track, Plan, More) plus standalone screens for onboarding, login, paywall, profile, progress, cook, verify, create, import, shopping, barcode, notifications, settings.

**Shared backend**: Supabase (28+ tables, RLS on all), 9 Next.js API routes, shared `src/lib/` business logic.

---

## Feature-by-feature comparison

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| **Auth: email/password** | Sign up, sign in, password reset | Sign up, sign in, password reset | In sync |
| **Auth: magic link** | `signInWithOtp` | `signInWithOtp` | In sync |
| **Auth: Apple** | N/A | Apple Sign-In via `expo-apple-authentication` | Mobile only (intentional) |
| **Onboarding** | Single-page form: body stats, goals, dietary prefs, plan pace, nutrition strategy, auto/manual macro targets, measurement units | 14-step wizard: goal, body stats, activity, plan pace, budget, strategy, dietary, calorie schedule, fasting, motivation, vision, obstacles, projection, summary | Both functional; shared dietary constants; web includes plan pace + nutrition strategy |
| **Discover/Browse** | `DiscoverFeed`: catalog + Supabase published recipes, search, save | `discover.tsx`: same feed, search, save, clipboard import detection, `FirstRunChecklist` | In sync |
| **Library** | `Library`: saved/created/imported, filter/sort | `library.tsx`: saved grid with macros | In sync |
| **Recipe detail** | `RecipeDetail`: macros, ingredients with inline verify via food search, cook mode, publish, serving scaler | `recipe/[id].tsx`: macro rings, ingredients with micros, verify link, cook link | In sync |
| **Recipe import** | `RecipeUpload`: URL import, image import (OpenAI) with nutrition verification, manual entry | `import-shared.tsx`: URL/share/clipboard/deep-link import | In sync; image import now runs `verifyIngredients` |
| **Recipe creation** | `RecipeUpload`: full editor, image upload, publish to community | `create-recipe.tsx`: full editor with image upload, publish toggle, description, meal tags | In sync |
| **Ingredient verification** | Embedded in `RecipeDetail` via food search dialog | Dedicated `/recipe/verify` screen with `FoodSearchModal` + barcode | Both functional (different UX patterns — intentional) |
| **Food search** | `FoodSearch.tsx`: USDA/OFF results, portion selection | `FoodSearchModal.tsx`: same + barcode integration | In sync |
| **Nutrition pipeline** | Shared `src/lib/nutrition/verifyIngredients.ts` | Same via API routes | In sync |
| **TDEE / macro calc** | `src/lib/nutrition/tdee.ts` (canonical) | Re-exports from canonical | In sync (single source) |
| **Meal planner** | `MealPlanner`: smart AI generation (calorie-aware, variety scoring, portion scaling, drag-to-reschedule) | `planner.tsx`: same smart generation algorithm via `mealPlanAlgo.ts`, assign/swap | In sync (same algorithm) |
| **Nutrition tracker** | `NutritionTracker`: daily logging, meal slots, quick-add, food search, macro progress rings, streaks, weekly view | `(tabs)/index.tsx`: day logging, food search, barcode, water/steps tracking | Both functional; mobile has water/steps |
| **Progress / wellness** | `ProgressDashboard`: weight projection, deficit insight | `progress.tsx`: weight/steps/body-fat logging, imperial unit support | Both functional |
| **Shopping list** | `ShoppingList`: from plan, category grouping, check-off, export | `shopping.tsx`: from plan, categories, check-off, share/copy export | In sync |
| **Cook mode** | `CookMode`: step-by-step, timer extraction | `cook.tsx`: same + keep-awake | In sync |
| **First-run checklist** | `FirstRunChecklist`: save 3 recipes → plan → log | `FirstRunChecklist` on Discover | In sync |
| **Notifications** | `NotificationsBell` + `NotificationsCenter` | `notifications.tsx`: tab-based inbox + push permission | In sync |
| **Profile / settings** | `Profile` (null-safe body stats) + `Settings` (persisted dietary, measurement, password reset) | `profile.tsx` (dietary prefs) + `settings.tsx` (theme, notifications) | In sync |
| **Billing** | Stripe checkout + webhook → `user_tier` | `paywall.tsx`: RevenueCat IAP → Supabase `user_tier` sync | Both functional; tier syncs to DB on both platforms |
| **Barcode scanner** | Web barcode via RecipeUpload dialog | `barcode.tsx` + `BarcodeScannerModal` | Both have barcode; mobile uses native camera |
| **Nutrition sources info** | `/help` page | `/nutrition-sources` | In sync |
| **Dark mode** | `next-themes` | `ThemeProvider` (AsyncStorage) | In sync |
| **SEO / JSON-LD** | SSR recipe pages with XSS-safe structured data | N/A | Web only (intentional) |
| **Analytics** | PostHog (`AnalyticsProvider`) | PostHog (`posthog-react-native`) | In sync |
| **Error tracking** | Sentry (`@sentry/nextjs`) | Sentry (`@sentry/react-native`) | In sync |

---

## Bugs and data integrity issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | **Dual fiber columns** (historical) | High | **Fixed** — migration corrected to `target_fiber_g`; new migration drops legacy `target_fiber` column |
| 2 | **`database.types.ts` stale** | High | **Fixed** — regenerated with all 28+ tables, correct column names, all functions |
| 3 | **`modal.tsx` leftover** | Low | **Fixed** — deleted |
| 4 | **Mobile analytics/error tracking gap** | Medium | **Fixed** — PostHog + Sentry integrated |
| 5 | **`checklistSignals.ts` undefined savedCount** | Medium | **Fixed** (previous session) |
| 6 | **Barcode APIs unauthenticated** | Critical | **Fixed** — both `POST /api/barcode-mapping` and `GET /api/off/barcode` now require auth via `getUserIdFromRequest` |
| 7 | **RevenueCat→Supabase tier not synced** | High | **Fixed** — `syncTierToSupabase` writes `user_tier` after purchase/restore |
| 8 | **Profile.tsx hardcoded defaults** (age=28, weight=75) | High | **Fixed** — body stats initialised as `null`; TDEE skipped when incomplete |
| 9 | **Image import skipped nutrition verification** | High | **Fixed** — `verifyIngredients` now runs on image-imported ingredients |
| 10 | **Settings "Change Password" dead button** | Medium | **Fixed** — triggers `resetPasswordForEmail` |
| 11 | **Settings dietary/measurement hardcoded, not persisted** | Medium | **Fixed** — loads from DB, persists on change |
| 12 | **Mobile progress kg-only** | Medium | **Fixed** — reads `measurement_system`, converts lb↔kg |
| 13 | **JSON-LD XSS via `</script>` in recipe text** | Medium | **Fixed** — `<` escaped as `\u003c` |
| 14 | **verify-recipe no ingredient count cap** | Low | **Fixed** — max 60 ingredients |
| 15 | **barcode-mapping accepted arbitrary `createdBy`** | High | **Fixed** — `created_by` now set to authenticated `userId`; `foodId` validated for existence |

---

## Security posture (as of 2026-04-13)

| Area | Status |
|------|--------|
| All 9 API routes authenticated | **Yes** (Stripe webhook via signing secret; all others via `getUserIdFromRequest`) |
| All endpoints rate-limited | **Yes** (Stripe webhook relies on signing; others use `rateLimit`) |
| RLS enabled on all tables | **Yes** — 28+ tables, `auth.uid()` policies |
| Service role used only server-side | **Yes** — never exposed to client |
| SSRF protection on recipe import | **Yes** — private host blocking |
| JSON-LD XSS | **Fixed** — angle bracket escaping |
| Known acceptable risks | SSRF: hostname-based only (DNS rebinding not covered); JSONB blobs grow unbounded |

---

## Shared sources of truth

| Asset | Location | Used by |
|-------|----------|---------|
| Nutrition verification | `src/lib/nutrition/verifyIngredients.ts` | Web import API, mobile import |
| Ingredient parsing | `src/lib/recipe-ingredients/parseIngredientLine.ts` | Both |
| TDEE / macros | `src/lib/nutrition/tdee.ts` | Web onboarding + dashboard; mobile via re-export |
| Dietary constants | `src/constants/dietaryPreferences.ts` | Web + mobile onboarding + profile + settings |
| Profile gate | `src/lib/client/homeProfileGate.ts` | Web `/` route |
| Estimation fallback | `src/lib/nutrition/estimateIngredientMacros.ts` | Both |
| Gram conversion | `src/lib/nutrition/measureToGrams.ts` | Both |
| USDA client | `src/lib/usda/fdcClient.ts` | API routes |
| OFF client | `src/lib/openFoodFacts/` | API routes + mobile search |
| FatSecret client | `src/lib/fatsecret/client.ts` | API routes |
| DB types | `src/lib/supabase/database.types.ts` | Web; mobile copy at `apps/mobile/lib/` |
| DB schema | `supabase/schema.sql` + 16 migrations | Both |
| Analytics events | `src/lib/analytics/events.ts` | Web + mobile |

---

## Test inventory (as of 2026-04-13)

| Category | Files | Cases |
|----------|-------|-------|
| Unit (Vitest) | 31 | 363 |
| Integration (Vitest) | 5 | 14 |
| E2E (Playwright) | 4 | 9 |
| **Total** | **40** | **386+** |

Last `npm test` run: **36 files, 393 tests, all passing**.

---

## Known risks / future work

| Risk | Severity | Notes |
|------|----------|-------|
| JSONB blobs (`weight_kg_by_day`, `steps_by_day`, `extra_water_by_day`) grow unbounded | Low-Med | No pruning; acceptable for months of usage; plan date-range partitioning at scale |
| `schema.sql` diverges from migrations (renames, new columns) | Low | schema.sql is base; migrations bring to current; ensure both are applied on fresh envs |
| N+1 in `verifyIngredients` (sequential per-ingredient API calls) | Low-Med | Acceptable for typical recipes (5-15 ingredients); batching planned for v2 |
| SSRF hostname-only check (no DNS resolution) | Low | Mitigated by rate limiting and auth; consider resolve-then-check for production hardening |
| Apple Health integration (mobile stub) | Low | Documented in `docs/integrations/apple-health.md`; requires native dev build |

---

## Intentional platform differences

| Difference | Reason |
|------------|--------|
| Apple Sign-In (mobile) | iOS-only API |
| Native barcode scanner (mobile) | Requires device camera; web has dialog-based barcode input |
| Share intent / clipboard detection (mobile) | OS-level share sheet |
| Haptic feedback (mobile) | No web equivalent |
| Keep screen awake in cook mode (mobile) | Native API |
| SEO / JSON-LD on recipe pages (web) | Not applicable to native app |
| Sidebar navigation (web) vs tab bar (mobile) | Platform convention |
| Stripe checkout (web) vs RevenueCat IAP (mobile) | Payment platform convention |
| Inline verify (web) vs standalone verify screen (mobile) | UX pattern matches platform |
| Richer onboarding wizard (mobile) vs concise form (web) | Mobile benefits from step-by-step; web users prefer speed |
| Dietary prefs in Settings (web) vs Profile (mobile) | Different IA; same DB shape and shared constants |

---

## Landing page alignment (2026-04-18)

The public marketing landing at `/` (unauthenticated visitors only — authenticated users see the app) must stay aligned with the real product on wording, features, pricing, roadmap, and promises. Drift here is a trust / legal risk on a nutrition product.

### Canonical copy module

**`src/lib/copy/today.ts`** is the **single source of truth** for all Today / tracker / calorie-balance strings shared across web, mobile, and the landing:

| Concept | Canonical token | Surfaces importing it |
|---|---|---|
| Calorie ring overline (LOGGED / REMAINING / OVER) | `RING_LABELS` | Web `daily-ring.tsx`, mobile `CalorieRing.tsx`, landing phone + web-shot mocks |
| 4 Today stat-tile labels (Logged / Target / Burned / Net) | `TODAY_STAT_LABELS` | Web `today-hero-stats.tsx`, landing web-shot mock |
| Net detail (deficit / surplus / maintenance) | `NET_DEFICIT_LABEL` + `netDetailFromKcal()` | Web `today-hero-stats.tsx` + `CalorieDeficitInsight`, mobile `TodayDeficitInsight`, landing web-shot mock |
| Meal slot headers (Breakfast / Lunch / Dinner / Snack) | `MEAL_SLOT_HEADERS` | Web `NutritionTracker` slot sections, mobile Today slot headers, landing phone + web-shot mocks |
| "About N kcal deficit so far today" prose | `todayBalanceHeadline()` | Web `CalorieDeficitInsight`, mobile `TodayDeficitInsight` |

Retired phrasings (enforced by `tests/unit/todayCopyParity.test.ts`):
- "below maint.", "below maintenance", "below TDEE" → `deficit`
- "under budget", "over budget" → `deficit` / `surplus`
- "kcal left", "UNDER" → `REMAINING`
- "Today's meals" (single section title) → per-slot headers

### Landing ↔ product alignment

| Feature / claim | Landing shows | Real product | Enforced by |
|---|---|---|---|
| Ring overline | `REMAINING` + `of X kcal` | Web + mobile rings use `RING_LABELS.remaining` | `todayCopyParity` + `landingParity` tests |
| 4-stat meta tiles | Logged / Target / Burned / Net beside the ring | `TodayHeroStats` on web desktop (`lg:`) | `todayHeroStats.test.tsx` |
| Net detail | `deficit` when logged < target, `surplus` when over, `maintenance` at parity | `netDetailFromKcal()` resolves the same | `todayCopyParity` |
| Meal section headers | Breakfast / Lunch / Snack (per-slot) | Same on web + mobile tracker | `landingParity` |
| Mobile tab bar 5th label | `Profile` | Mobile `(tabs)/_layout.tsx` ships `Profile` | manual review |
| Web desktop layout | Sidebar (Track / Recipes categories) | `DesktopSidebar` rendered at `lg:` (≥1024px); mobile-web keeps bottom tabs | `desktopSidebar.test.tsx` |
| "Does it work on iOS, Android, web?" | Web + iOS (TestFlight). Android **not** on roadmap | Matches `docs/product/overview.md` Platforms | `landingParity` forbidden-claim list |
| "Recipe import from 400+ sources" | Retired — imports any JSON-LD recipe site + Instagram/TikTok/YouTube | No curated 400-source list; JSON-LD is the implementation | `landingParity` |
| "Voice control" in cook mode | Retired — cook mode has timers + step highlighting; voice logging is a Pro tracker feature, separate | `CookMode.tsx` has no voice nav | `landingParity` |
| Annual-plan pricing | "Not yet, but it's coming" | Matches `/pricing` FAQ | `landingParity` (forbids hard-coded $50/$120 annual) |
| Pricing tier names + prices | Free $0 / Base $5 / Pro $12 (headline) | Stripe price IDs in env; same numbers in `/pricing` | `landingParity` |

### Ring + hero-stats block (web desktop, 2026-04-18)

`src/app/components/suppr/today-hero-stats.tsx` wraps `TodayHeroRing` and, at `md:` (≥768px), renders the 4-tile meta block (Logged / Target / Burned / Net) to the right of the ring — mirroring the landing web-shot mock. Below `md:` only the ring renders, preserving the mobile-web feel.

- Net number uses `\u2212` (Unicode minus) for negative values so the dash doesn't wrap and screen-readers pronounce "minus".
- Net detail resolves via `netDetailFromKcal()` so the word can never drift from canonical.
- `Burned` shows `—` when no Health data is synced (rather than `0`), so a first-run user isn't misled into thinking their activity is tracked at zero.

### Desktop sidebar (web, 2026-04-18)

`src/app/components/suppr/desktop-sidebar.tsx` renders the landing's web-shot sidebar for real at `lg:` (≥1024px). Structure:

- **Track**: Today · Plan · Progress
- **Recipes**: Library · Discover · Shopping (with unchecked-count badge)
- Pinned bottom: Profile · Settings

Below `lg:` the sidebar is hidden and the bottom tab bar remains — same tab order as the mobile app (`Today / Discover / Plan / Progress / Profile`). This is the deliberate 2026-04-18 decision: *mobile-web should feel like the native mobile app*, desktop-web gets a first-class desktop layout.

### Cross-screen alignment work (Pass 4 + Pass 5 + Pass 6, 2026-04-18)

#### Pass 6 deliverables

- ✅ **Mobile Library — kindFilter pills** added (Saved / Created / Imported / All) in [apps/mobile/app/(tabs)/library.tsx](apps/mobile/app/(tabs)/library.tsx). Kind is derived locally from `authorId + sourceUrl` since mobile doesn't have web's `libraryEntryKindByRecipeId` map: own author + sourceUrl → imported, own author + no sourceUrl → created, other author → saved. Mobile Library now exposes both **sort + filter**, matching web.
- ✅ **Web Profile — Goals & Targets parity rows**: added Dashboard Widgets, Week starts on, Caffeine limit, Alcohol limit as new rows beneath Daily Targets in the Settings section. Each row shows the current value as the sub-label and links to `/?view=settings` for editing. Mobile parity for the 5 granular rows mobile shows under "Goals & Targets".
- ✅ **Mobile Named plans switcher** (Pass 7) — ported. Pure CRUD helpers extracted to [src/lib/mealPlan/namedSlots.ts](src/lib/mealPlan/namedSlots.ts) (shared between web `AppDataContext` and mobile). Mobile hook [apps/mobile/hooks/use-meal-plan-slots.ts](apps/mobile/hooks/use-meal-plan-slots.ts) persists slot metadata to AsyncStorage (web uses localStorage). Cloud syncs only the active plan via `upsertMealPlanJson` — slot names + ids stay device-local on both. UI is a horizontal pill row above the planner header with `+ New` and long-press for rename / delete. 23 unit tests on the shared helpers ([tests/unit/mealPlanNamedSlots.test.ts](tests/unit/mealPlanNamedSlots.test.ts)).
- ✅ **Bug fix: `Lock was stolen by another request`** — added [src/lib/supabase/isAuthLockAbort.ts](src/lib/supabase/isAuthLockAbort.ts) helper that detects benign Supabase auth-lock collisions in browser-side `{ data, error }` callsites that race during page focus / refresh cycles. Wired into `refreshDiscoverRecipes`. Use the same helper in any other frequently-firing `from(...).select(...)` callsite that surfaces the same false-positive error log.



Pass 5 closed the highest-impact items from the Pass 4 backlog. Remaining items are documented as either intentional divergence or as deferred work with a clear owner.

#### Discover (Pass 5)

- ✅ **fix** Search bar shape changed from `rounded-full` to `rounded-md` to match mobile's `borderRadius: 10`. Cosmetic but visible.
- ✅ **fix** Import CTA: dropped the primary→success gradient in favour of the flat `Accent.primary + alpha` card mobile uses. Same visual family across platforms.

#### Library (Pass 5)

- ✅ **fix** Added the **sort cycle button** (Recent → Calories → Protein → Recent) on web — mobile parity. Web Library now exposes both filter (Saved/Created/Imported) AND sort, ahead of mobile.
- **deferred** Mobile kindFilter — needs new data plumbing (`libraryEntryKindByRecipeId` doesn't exist on mobile). Worth doing in a focused mobile pass.

#### Profile / More (Pass 5)

- ✅ **fix** Added the **Upgrade-to-Pro banner** for free + base users on web. Same copy and CTA semantics as mobile (`apps/mobile/app/(tabs)/more.tsx` 416). Pro users see no banner.
- ✅ **fix** **Suppr Score** is now interactive on web — clicking opens an info modal that explains the 0–100 formula, mirroring mobile's Alert.alert (40 pts logging streak + 30 pts saved recipes + 30 pts active account).
- **deferred** Web rolls Goals & Targets / Caffeine limit / Alcohol limit / Week starts on / Dashboard Widgets into a single "Daily Targets" row + a separate "Settings" view. Mobile surfaces each as its own row inside a "Goals & Targets" section. Restructuring web into 5 granular rows is its own ~1hr pass.

#### Plan (Pass 5)

- ✅ **fix** Added the **compact day strip** at the top of the multi-day plan on web (`apps/mobile/app/(tabs)/planner.tsx` 815 parity). One narrow card per day with weekday, kcal progress bar, and total. Click jumps to that day's full card (anchor `#plan-day-{n}`).
- **intentional divergence** `HouseholdPanel` (web, mounted from App.tsx around `MealPlanner`) vs inline `HouseholdCard` (mobile inside `MealPlanner`). Same feature, different mount point. Both work, both connect to the same shared `householdClient`.
- **deferred** Web has a "Named plans" multi-slot meal-plan switcher; mobile has no equivalent. Either port to mobile (~30 min) or document as a web-only power feature.

#### Progress

- **structurally aligned** Header text (`Progress` / `Weekly report`), `WeeklyRecapCard` first, then stats + charts in matching order. No surgery needed.

### Cross-screen divergence backlog (Pass 4 audit, 2026-04-18)

Audit of every tab's mobile vs web composition. Items marked **fix** were addressed in this batch; items marked **deferred** are followup work the user can prioritise.

#### Discover

- **fix** Web `DiscoverFeed` was missing the **My Library** CTA card that mobile shows next to the Import card. Added below the Import CTA, navigates via the same `view=library` URL pushState pattern. ([src/app/components/DiscoverFeed.tsx](src/app/components/DiscoverFeed.tsx) ~525)
- **deferred / cosmetic** Search bar shape differs: mobile rectangular, web rounded pill. Both work; pick one before next visual sweep.
- **deferred / cosmetic** Import CTA visual: mobile uses a flat card on `Accent.primary + alpha`; web uses a primary→success gradient. Pick one canonical treatment.

#### Plan

- **intentional divergence** Compact day-summary strip exists on mobile (above the full day cards) for phone scannability. Web shows only the full day cards because horizontal real estate makes the strip redundant. Documented; do not "fix".
- **intentional divergence** `HouseholdPanel` (web) vs inline `HouseholdCard` (mobile) — same feature, different mount point. Web wraps `MealPlanner` from `app/App.tsx` case `"plan"`; mobile renders inside the planner.
- **deferred** Web has a "Named plans" multi-slot meal-plan switcher; mobile has no equivalent. Either port to mobile or document as web-only power feature.

#### Progress

- **structurally aligned** Header (`Progress` / `Weekly report`), `WeeklyRecapCard`, then stats + charts in matching order on both platforms. No surgery needed for Pass 4.

#### Library

- **deferred** Mobile sorts by Recent / Calories / Protein (no kind filter). Web filters by Saved / Created / Imported (no sort). Each platform has a feature the other lacks; both should eventually expose both.

#### Profile / More

- **deferred — substantial** Mobile More has a 3-stat-pill row (Recipes / Streak / Suppr Score), an Upgrade-to-Pro banner for free users, and 7+ sectioned cards (Goals & Targets, Connections, Notifications, Account, About, Sign out / Delete). Web `Profile` surfaces fewer sections and has no Suppr Score concept. Aligning is its own ~2-hour pass; see followup backlog.

### Today composition order (Pass 1, 2026-04-18)

Web `NutritionTracker.tsx` now renders sub-components in the **same order** as mobile `apps/mobile/app/(tabs)/index.tsx`. This is the canonical Today flow on every platform; a divergence here is a bug.

| # | Component | Gating |
|---|---|---|
| 1 | `TodayDateHeader` (with embedded `DayStrip`) | always |
| 2 | `TodayFastingPill` | day mode + active fast |
| 3 | `TodayWeekView` | week mode |
| 4 | `TodayHeroStats` (web desktop) / `TodayHeroRing` (mobile-web + native) | day mode |
| 5 | `RemainingMacrosBar` | day mode |
| 6 | `TodayDashboardMacroTiles` | day mode |
| 7 | nutrient detail rows (web inline grid; mobile uses a "View all nutrients (N)" link → modal — **intentional divergence**, web has the screen real estate to show inline) | when ≥1 micro present |
| 8 | `TodayQuickLogStrip` | day mode |
| 9 | `TodayStreakInsightCard` | day mode |
| 10 | `TodayDeficitInsight` (mobile) — small banner only | isToday + remaining > 0. Web has **no equivalent** (Pass 7 cleanup, 2026-04-18): the standalone `CalorieDeficitInsight` panel duplicated data already in the Net tile + Activity Bonus card. |
| 11 | `TodayEatAgainBanner` | isToday + suggestion + not dismissed today |
| 12 | `QuickAddPanel` (collapsed CTA above) | day mode |
| 13 | `TodayMealsSection` | day mode |
| 14 | `TodayPlannedMealsCard` | day mode + plan exists for today + ≥1 meal |
| 15 | `TodayStepsCard` (or "Connect health" link first-run fallback) | day mode |
| 16 | `TodayActivityBonusCard` | day mode + (hasBurnData OR isToday) |
| 17 | `HydrationStimulantsCard` (or "Track hydration?" link first-run fallback) | water target > 0 OR any logged |

### Token alignment (Pass 3, 2026-04-18)

Cross-platform comparison of `apps/mobile/constants/theme.ts` vs `src/styles/theme.css`:

**Aligned hexes** — these MUST stay byte-identical between platforms; align both when changing:
- All `Accent.*` (primary / success / warning / destructive / cyan / orange / magenta / info)
- All `MacroColors.*` (calories / protein / carbs / fat / fiber / sugar / sodium / water)
- All `StimulantColors.*` (caffeine / alcohol)
- Foreground text: light `#111118`, dark `#e4e4e8`
- Border + cardBorder: light `#e4e4ec`, dark `#282830`
- Input background: light `#ededf2`, dark `#202028`
- Muted icon colour: light `#6b6b78`, dark `#7a7a88`
- Spacing scale: `xs:4 sm:8 md:12 lg:16 xl:20 xxl:24 xxxl:32` ↔ `--spacing-pm-1 … --spacing-pm-10`
- Radius scale: `sm:8 md:12 lg:16 xl:20` ↔ `--radius:12 --radius-card:16`

**Intentional cross-platform divergence** — do NOT "fix" without revising this section first:
- **Background**: mobile keeps pure white (`#ffffff`) and OLED-friendly black (`#0a0a0f`); web uses slightly off-white (`#f4f5f7`) and slightly-raised black (`#101014`) for desktop eye-comfort and to avoid LCD halation.
- **Card (dark)**: mobile `#16161e`, web `#18181c` — each card sits the same amount above its platform's background.
- **Nutrient detail UI**: mobile uses a "View all nutrients (N)" link → modal because of small-screen scannability; web shows the full grid inline because the screen real estate is there.

### Parity tests added this batch

- `tests/unit/todayCopyParity.test.ts` — 15 tests. Asserts canonical module outputs and scans web + mobile + landing for forbidden phrases.
- `tests/unit/landingParity.test.tsx` — 15 tests. Renders `LandingPage` and checks ring overline, stat labels, meal-slot headers, Net detail, pricing tiers match `/pricing`, and a forbidden-claims list (400+, voice control, annual-plan prices, mock URL).
- `tests/unit/todayHeroStats.test.tsx` — 6 tests. Verifies the 4-tile block's number formatting, deficit/surplus/maintenance detail, and em-dash when Burned is zero.
- `tests/unit/desktopSidebar.test.tsx` — 5 tests. Nav item presence, `aria-current`, click dispatch, shopping badge render + cap at `99+`.

### What to do when this section fails

If `tests/unit/todayCopyParity.test.ts` lights up because you added a forbidden phrase:

1. **First, try to use the canonical token.** The vast majority of the time, the correct fix is to `import { … } from "src/lib/copy/today"` and consume the constant or the function.
2. **If the new phrase is genuinely intentional** (a new product decision), update both `src/lib/copy/today.ts` (remove from `FORBIDDEN_TODAY_PHRASES`, rename constant if needed) and the comment block at the top of the file explaining the reason. The diff is then a deliberate product-copy decision, not a drift.

If `tests/unit/landingParity.test.tsx` lights up:

1. Probably the landing is claiming something the real product doesn't do yet. Trim the claim, don't update the test to allow it.
2. If the product grew the capability (e.g. we really do support Android now, or we really did curate 400 sources), remove the entry from `FORBIDDEN_CLAIMS` in the test and update `docs/product/overview.md` so the two stay in sync.

---

## Pre-merge checklist (for any future change)

- [ ] Shared `src/lib/` change → test both platforms
- [ ] Schema/migration change → regenerate types, update both query sites
- [ ] User-facing flow change → check other platform
- [ ] API response shape change → verify both consumers
- [ ] New constant/enum → add to shared location (`src/constants/` or `src/types/`)
- [ ] New analytics event → add to `src/lib/analytics/events.ts` (shared)
- [ ] Security-sensitive change → verify auth, rate limit, input validation

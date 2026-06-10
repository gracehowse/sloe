# Suppr Warm-Coaching Redesign — Master Index

**Created:** 2026-06-02  
**Status:** Spec-complete — awaiting HTML prototypes + flag-gated implementation  
**Design philosophy:** Suppr is an editorial cookbook that coaches you warmly. Julienne gives the bones (serif-display editorial type, restrained whitespace, clean white canvas). Lifesum gives the soul (coaching voice, warmer colour temperature, nurturing personality). White base everywhere; no cream wash; warm cards (`#F6F5F2`) create warmth.

---

## 1. Document index

### Design system (canonical — all surface specs are subordinate to this file)

| File | Purpose |
|---|---|
| [`_design-system.md`](./_design-system.md) | Colour system, typography scale, spacing, radius, elevation, card system, chart system, motion, navigation, component library, imagery rules, voice/copy rules, accessibility standards, cross-platform parity rules, feature flag requirements |

### Surface specs

| File | Surface | Platforms | Status |
|---|---|---|---|
| [`today.md`](./today.md) | Today / Home Dashboard — calorie ring, macro tiles, meals, north-star, weekly check-in, activity, deficit, hydration, win-moment | iOS primary + web parity | Spec |
| [`plan.md`](./plan.md) | Plan tab — week overview, day sections, meal rows, move/swap/portion, templates, shopping list, generate flow | iOS primary + web parity | Spec |
| [`recipes.md`](./recipes.md) | Recipes — library, recipe detail, cook mode, shopping list, verify, import/create | iOS primary + web parity | Spec |
| [`progress-insights.md`](./progress-insights.md) | Progress tab — weight chart, daily calories, macro adherence, adaptive TDEE, trajectory, journey, digest, 30-day milestone, streak/freeze | iOS primary + web parity | Spec |
| [`onboarding.md`](./onboarding.md) | Onboarding — all 13 steps (Welcome → Signup → Goal → Sex → Age → Height → Weight → Activity → Pace → Diet → Strategy → Reveal → Data-bridges) | iOS primary + web parity | Spec |
| [`nutrition-log.md`](./nutrition-log.md) | Nutrition tracking & logging — LogSheet, food search, barcode/label OCR, macro tiles, daily diary, voice log, photo log, portion picker, weekly nutrition chart, weight trend chart, weekly check-in | iOS primary + web parity | Spec |
| [`paywall.md`](./paywall.md) | Paywall & monetisation — full paywall, AI gate sheet, web pricing page, settings membership card, checkout receipt | iOS primary + web parity | Spec |
| [`settings.md`](./settings.md) | Settings / Profile / Account — shell, profile card, membership, goals/targets, display, connections, Apple Health, danger zone, household, data export | iOS primary + web parity | Spec |
| [`weight.md`](./weight.md) | Weight tracking — chart, range toggle, trend header, trajectory/forecast, journey/goal card, maintenance/TDEE, sparse state, log sheet, all-data sheet, 30-day modal, win-moment, weight_surface_mode | iOS primary + web parity | Spec |
| [`import.md`](./import.md) | Recipe import — action sheet, idle state, loading, caption preview, review/ingredient list, verify screen, photo import, paste-list, success/error states | iOS primary + web parity | Spec |
| [`ai-coach.md`](./ai-coach.md) | AI Coach / Insights engine — north-star, adaptive-TDEE narrative, DigestStoryCard, TrajectoryCard, Digest + suggestion cascade, deficit insight, activity bonus, fasting narrative, win-moment, bounded Ask spec | iOS primary + web parity | Spec |
| [`habits.md`](./habits.md) | Habits & behaviour change — streak pip, streak insight card, freeze history, missed-yesterday, nudge queue, weekly check-in (mobile + web), weekly recap/digest, 30-day milestone, win-moment overlay, weight+TDEE trend chart | iOS primary + web parity | Spec |

---

## 2. Screen-by-screen product map

### Mobile tabs (4 tabs, canonical)

**Today (tab 1 — `(tabs)/index.tsx`)**
- Date header + contextual greeting line
- Calorie ring (3-state: gradient / success green / destructive red)
- Remaining ↔ Consumed toggle pill
- Inner P/C/F sub-rings
- Stats row (Goal / Eaten / Bonus)
- Status pills (On-track, Adaptive TDEE learning)
- Macro tiles 2×2 or bars (Settings toggle)
- Full nutrient breakdown chevron → FullNutrientPanelSheet
- Fasting pill (conditional)
- Deficit insight card (conditional)
- Meals section — Breakfast / Lunch / Dinner / Snacks
- North-star "what to eat next" card
- Weekly insight card
- Weekly check-in banner / card
- Onboarding nudge cards
- Planned meals card
- Activity card (steps histogram)
- Activity bonus card (TDEE sparkline, burn breakdown)
- Hydration & stimulants card
- Complete Day button
- Win-moment overlay (flag `redesign_winmoment`)

**Plan (tab 2 — `(tabs)/planner.tsx`)**
- Week overview header (headline + weekday dot row + 7-day stacked macro bar strip + coaching subtitle)
- Plan slot switcher (named plans)
- Plan / Shopping sub-tab
- Generate / Regenerate button + loading state
- Day sections (day header → macro band tracks → meal rows)
- Meal rows (photo thumbnail + slot label + recipe name + estimated kcal + inline ⇄ swap + overflow ⋯)
- Add-slot-back chips
- Leftover rows
- Portion-size modal (Recime ± stepper)
- Move-meal sheet
- Row action sheet (6 actions)
- Plan templates sheet
- Shopping list (recipe-grouped, per-ingredient illustration, household scope, progress bar)
- Post-generate confidence reveal (flag `redesign_winmoment`)

**Recipes (tab 3 — `(tabs)/library.tsx`)**
- Library header + search + filter pills + sort label
- Recipe card list (hero image, title, macro row with protein emphasis, draft/bookmark badges)
- Recipe detail (hero, verb action row, fits-your-day verdict chip, macro tiles, kcal headline, allergen callout, Ingredients / Steps / Nutrition tabs, log card, notes, source attribution, sticky footer)
- Cook mode — step region, named multi-timer tray, persistent bottom utility bar, "last time" card, completion card
- Verify screen (confidence tier chips, ingredient card rows, caption-claim panel)
- Import surface (action sheet, idle state, loading, caption preview, review, verify, photo import, paste-list, success/error)
- Shopping list (see Plan tab)

**Progress (tab 4 — `(tabs)/progress.tsx`)**
- Progress header + hero metric (adherence %, avg cals, or streak)
- Range picker (7d / 30d / 90d / All — with disabled states)
- Story gate ring (pre-3-days)
- Weight chart card (Trend / Scale toggle, stat-pair header, goal-line pill, confidence band, staleness pill, "See all measurements")
- Three-stat row (avg intake / maintenance / deficit)
- Daily calories chart (7 bars, per-day target dots, daily avg hero, today marker)
- Macro adherence bars (Protein / Carbs / Fat, "current vs goal" framing, on-target day count)
- Maintenance / adaptive TDEE card + numbered "How it was calculated" ledger
- Trajectory card
- Journey card (Started / Current / Goal ledger, progress bar, milestone badges)
- Apple Health card (mini-tiles)
- Weekly digest / recap card (Fraunces headline, mini 7-bar chart, closest-to-target inset, share/dismiss)
- Digest suggestion module
- DigestStoryCard
- 30-day milestone modal
- Streak + freeze panel (weekday strip, freeze economy row)
- Log Weight sheet
- All-weight-data sheet (source provenance chips)
- Win-moment overlay

### Stack screens (modal / push)

| Screen | Entry point |
|---|---|
| LogSheet (6 modes) | Log FAB / tab bar button |
| FoodSearchPanel → preview card → portion picker | LogSheet |
| BarcodeScannerModal + Label OCR mode | LogSheet scan mode |
| VoiceLogSheet (Pro) | LogSheet voice mode |
| PhotoLogSheet | LogSheet photo mode |
| SaveMealSheet / SavedMealPortionSheet | Meal row actions |
| TodayEditMealModal | Long-press meal row |
| FullNutrientPanelSheet | Macro tiles chevron |
| WhereThisComesFromSheet | Activity bonus card |
| WeeklyCheckinModal / WeeklyCheckinCard | Today / weekly check-in banner |
| WinMomentPlayer | Landmark triggers |
| Milestone30DayModal | Progress tab (30 distinct logged days) |
| LogWeightSheet | Progress header / sparse state CTA |
| AllWeightDataSheet | Weight chart "See all measurements" |
| GoalPaceEditorSheet | Targets screen / check-in |
| GoalPaceRetuneSheet | Weekly check-in accept → re-tune |
| NotificationPrefsSheet | Settings → Connections |
| MoveMealSheet | Plan row action |
| PlanTemplatesSheet | Plan header |
| PortionPickerSheet | Plan meal row portion pill |
| CreateRecipeActionSheet | Recipes "+" |
| import-shared | Share sheet / clipboard / deep link |
| recipe/verify | Post-import or recipe detail |
| cook | Recipe detail → Start Cooking |
| fasting | Deep link / Today |
| paywall | Multiple Pro-gate entry points |
| household-settings | Settings → Household |
| health-sync | Settings → Connections → Apple Health |
| targets | Settings → Goals & targets |
| profile | Settings → Profile |
| more / settings | Progress tab → Settings row |
| notifications (inbox) | Settings → Notifications → View inbox |

### Web routes (parity to mobile tabs)

| Route | Maps to |
|---|---|
| `/` → `LandingPage.tsx` | Marketing / landing |
| `/pricing` | Paywall (web) |
| `/onboarding` | Onboarding funnel |
| `/account` → `NutritionTracker.tsx` | Today |
| `/plan` → `MealPlanner.tsx` | Plan (7-column kanban grid) |
| `/recipes` → `Library.tsx` | Recipes library |
| `/recipe/[id]` → `RecipeDetail.tsx` | Recipe detail |
| `/account/progress` → `ProgressDashboard.tsx` | Progress |
| `/import` → `RecipeUpload.tsx` | Recipe import |
| `/account/settings` → `Settings.tsx` | Settings |
| `/account/profile` → `Profile.tsx` | Profile / targets |
| `/account/billing` | Subscription management (Stripe portal) |
| `/checkout/success` | Checkout receipt |
| `/help`, `/privacy`, `/dmca`, `/licences` | Legal / help |

---

## 3. Deliverables checklist

| Deliverable | Status | File |
|---|---|---|
| **Screen-by-screen surface specs** (12 surfaces) | DONE | `today.md`, `plan.md`, `recipes.md`, `progress-insights.md`, `onboarding.md`, `nutrition-log.md`, `paywall.md`, `settings.md`, `weight.md`, `import.md`, `ai-coach.md`, `habits.md` |
| **Full UX audit** (weaknesses, benchmark comparables, anti-patterns) | DONE — embedded in each spec §2 | All surface specs |
| **Mobbin benchmark analysis** (named screens with URLs per surface) | DONE — embedded per component in each spec | All surface specs |
| **Design system** (colour, typography, spacing, radius, elevation, cards, charts, motion, navigation, components, imagery, voice, accessibility) | DONE | `_design-system.md` |
| **Typography system** (full type scale with 14 named roles, two typefaces, platform notes) | DONE | `_design-system.md` §2 |
| **Colour system** (base palette, semantic roles, macro colour map, meal-slot colours, specialist tokens, opacity patterns) | DONE | `_design-system.md` §1 |
| **Card system** (3 card backgrounds, 6 semantic variant states, empty/null/loading/error patterns) | DONE | `_design-system.md` §6 |
| **Chart system** (7 chart types: weight trend, daily calories, macro adherence bars, stacked macro, per-day band tracks, trajectory, 7-day strip) | DONE | `_design-system.md` §7 |
| **Motion system** (5 easing tokens, 6 duration tokens, reduced-motion rules, full motion inventory by surface, haptics spec) | DONE | `_design-system.md` §8 |
| **Navigation system** (tab bar, pattern matrix, bottom sheet snap points) | DONE | `_design-system.md` §9 |
| **Component library** (row anatomy, cards, modals/sheets, progress indicators, search field, filter pills, empty states, toasts, paywall components, onboarding OptionCard, settings rows) | DONE | `_design-system.md` §10 |
| **Imagery system** (ingredient single-subject rule, meal photography rule, forbidden styles, fallback hierarchy, generation prompt templates) | DONE | `_design-system.md` §11 |
| **Interaction guidelines** (voice + copy rules, forbidden phrases, trust posture, tilde requirement, WCAG AA contrast rules, touch targets, gesture accessibility) | DONE | `_design-system.md` §12–13 |
| **HTML prototypes** (pre-implementation requirement per `feedback_html_prototypes_before_coding.md`) | NOT YET — required before production code | Pending per surface |
| **Before/after screenshots** (required per CLAUDE.md visual-validation rule) | NOT YET — required at implementation time | Pending per flag |

---

## 4. Top 12 highest-leverage redesign moves (ranked)

These are ordered by cross-surface impact, implementation feasibility, and alignment with the primary launch and retention goals (Today = retention; Recipes = viral hook).

| # | Move | Surface | One-line rationale |
|---|---|---|---|
| 1 | **Fraunces serif for all meal names and big numerals** | Today, Plan, Recipes, Nutrition Log | Single highest-leverage typographic change: applies to every meal row, every recipe card, every calorie hero — editorial warmth at the most-seen elements across every session |
| 2 | **North-star card as full editorial hero with hyperreal food photography** | Today | The product's stated north-star moment currently renders as a compact utility card; upgrading to the Oura-style hero with meal photography makes the viral differentiator visible every session |
| 3 | **Visible Remaining ↔ Consumed toggle on calorie ring (replace hidden long-press)** | Today, Nutrition Log | The most important budget signal in the product is currently undiscoverable; MacroFactor's explicit pill is the validated pattern — fixes a UX failure on the highest-traffic screen |
| 4 | **Week overview bar strip on Plan tab (7-day stacked macro bars)** | Plan | Makes the algorithmic output legible at first glance; turns "Build plan" from a black-box action into a visible confidence artefact; directly supports the "engineered plan" positioning vs recipe-app competitors |
| 5 | **Hyperreal food photography on plan meal rows and recipe library cards** | Plan, Recipes | The plan and library are text-only today; adding editorial food photography makes the content feel real and appetising before the user has cooked anything — the primary emotional job of a planner |
| 6 | **Inline swap affordance (⇄) on plan meal rows** | Plan | Swap is the primary planner verb and currently requires 3 taps (row → overflow → Swap meal); making it one tap directly reduces the friction on the most-used planner interaction |
| 7 | **Free-vs-Pro matrix on paywall (showing Free's genuine value)** | Paywall | Reframes the paywall from "Free is restricted" to "Pro extends what already works"; validated by AllTrails — the single change most likely to improve conversion trust without any pricing change |
| 8 | **Palette correction on web pricing page** (violet/indigo → terracotta) | Paywall (web) | This is a bug, not a preference — off-brand gradient CTAs and macro-colour trust icons violate the locked design system; low effort, immediate cross-platform consistency |
| 9 | **Leading icons + ALL-CAPS eyebrows on Settings** | Settings | Eliminates the "read every label sequentially" problem on the highest-stakes low-frequency surface; Monarch/Oura validated — makes targets, membership, and danger zone discoverable in <2s |
| 10 | **`--streak-milestone` token (eliminate amber collision on streak milestones)** | Today, Progress, Habits | Amber is locked to over-budget/alerts; streak milestone tinting currently collides with the alert semantic; introducing a dedicated deep-terracotta token (`#A3522C`) costs one line in the token file and fixes a confusing false-alarm signal |
| 11 | **Confidence band + Trend/Scale toggle on weight chart** | Progress, Weight | MacroFactor's signature pattern applied: makes the MA smoothing legible (users currently think the smoothed line is their literal scale reading), communicates TDEE confidence visually, and resolves the most common user confusion on any smoothed weight chart |
| 12 | **Accessible-first visible "Swap" button on recipe import review rows (replace long-press)** | Import, Recipes | The recipe import review is the viral activation moment (Reel → macros); a wrong ingredient match currently requires discovering a long-press to fix; making "Swap" a visible pill recovers a large class of abandoned imports |

---

## 5. Functionality preservation guarantee

All 12 surface specs contain exhaustive "FUNCTIONALITY PRESERVED" checklists that are sign-off gates for implementation. No spec removes, hides, simplifies, or weakens any audited feature, data point, calculation, gating rule, honesty footnote, or suppression rule.

Key documented preservation commitments (representative sample):

- **Today:** 22 sheets/modals, hero ring 3-state colour mapping, all 7 macro types, north-star all 5 suggestion kinds, all 14 behavioural mechanics (streak, win-moment, weekly check-in, complete-day, HealthKit), all Free vs Pro gates
- **Plan:** Full `mealPlanAlgo.ts` algorithm constants (2000 sampler cap, band thresholds, asymmetric penalty, portion clamps), all 6 row actions, shopping list household scope, all named-plan and template mechanics
- **Recipes:** Cook mode standalone `cook.tsx` canonical path, 4-tier confidence system, gluten disclaimer always-visible (legal surface), FatSecret attribution ToS, voice-handsfree shell explicitly non-fake, all import engines and error copy verbatim
- **Progress:** All adaptive TDEE gates (`MIN_LOGGING_DAYS`, `MIN_WEIGH_INS`, confidence tiers), all chart layers (never dropping to a single bare smoothed line — Noom/Yazio anti-pattern explicitly rejected), digest suppression rules, `STORY_DATA_FLOOR_DAYS = 3`
- **Onboarding:** All pace safety tiers (warn/danger acknowledgement gate), `weightSkipped` path, all 14 EU FIC regulated allergens, Mifflin formula transparency, all persist + seed + plan-build chain
- **Paywall:** All 12 `from` values, CMA-compliant cadence-in-days disclosure verbatim, trust chips verbatim, all analytics events, StoreKit failure handling, poll-until-entitled
- **Habits:** All freeze engine constants (`earnFreezeIfMilestone` multiples-of-7, `budgetMax = 3` always Free), `FORBIDDEN_TODAY_PHRASES` never appearing in redesigned copy, no confetti, no mascots, no Pro gate on any habit surface, `floorAppliedKcal` always prominently visible
- **Weight:** All 63 audited features confirmed preserved (chart/calculation × 14, adaptive TDEE × 7, trajectory × 5, journey × 5, milestones × 6, interactions × 8, ED-safe × 3, gating × 3, HealthKit × 4)

The redesign is a visual and information-architecture elevation only. All logic, gating, data pipelines, analytical models, and honesty gates are unchanged.

---

*This index is the navigation layer for the Suppr warm-coaching redesign. It does not replace the surface specs — link to them for the complete component-by-component detail, benchmark citations, functionality checklists, and implementation guidance.*

# Sloe redesign — migration coverage matrix

**Purpose:** guarantee no functionality is silently dropped when migrating the live app to the Sloe design system. Every real screen/feature gets an explicit verdict. This is the migration map.

_Created 2026-06-02. Read-only audit of `apps/mobile/app/**` (44 screens) + `src/app/components/**` (web), cross-referenced against the 11 Figma frames (file `B3UdOFup7ITersgNuoXh0l`) and the 12 functional contracts in `docs/ux/redesign/*.md`. **Scope decisions resolved by Grace 2026-06-02 — see "Resolved scope" below.**_

## The migration model (3 layers)

1. **Re-skin (automatic, ALL screens).** The Sloe redesign is token-driven (`src/styles/theme.css` + `apps/mobile/constants/theme.ts`). Swapping those tokens + adding Newsreader re-skins **every** screen at once — even ones we never explicitly redesign get the Sloe palette/fonts with **zero feature loss, zero layout change**. The app is never half-old-half-new.
2. **Redesign (per-screen, where a design exists).** The Figma frames + contracts get their new layouts on top of the re-skin.
3. **Coverage matrix (this doc).** Every feature gets a verdict so nothing slips.

## Resolved scope (Grace 2026-06-02)

- **Tabs = Today · Plan · ⊕ · Recipes · Progress** (4 tabs + Log FAB). Confirmed.
- **Settings via avatar, not a tab** — tapping the name/profile pic top-right → Settings. `profile` folds into Settings; nav stays as today.
- **Recipes tab = Library + Discover** (sub-views, as the app currently works). `library` + `discover` (+ `creator/[id]`) live INSIDE Recipes.
- **Ask + Habits = POST-LAUNCH** (deferred; not in this redesign).
- **Fasting = in scope** → Sloe design.
- **Detail drill-downs = need Sloe design.**
- **Household = needs Sloe design.**

## Counts (this redesign)

| | Count |
|---|---|
| Figma frames | 11 |
| Real mobile screens audited | 44 |
| Deferred to post-launch | 2 (Ask, Habits) |

## Verdict legend

- **REDESIGNED** — has a Figma frame → migrate to the new layout.
- **NEEDS DESIGN** — real, in-scope feature with **no Figma frame** → I design it → Figma before "done".
- **RE-SKIN ONLY** — keep current layout, gets Sloe tokens/font automatically.
- **FOLD** — absorbed into a redesigned surface (no standalone screen).
- **DEFERRED** — post-launch, out of this redesign.

---

## A. REDESIGNED — Figma frame exists (the core)

| Mobile screen | Web equivalent | Figma frame | Contract | Notes |
|---|---|---|---|---|
| `(tabs)/index` | `NutritionTracker` / `TodayAtAGlance` | Today | today | ⚠️ 6,318-line file — refactor as we go |
| `(tabs)/planner` | `MealPlanner` | Plan | plan | Shopping list likely lives here |
| `(tabs)/recipes` → hosts **Library + Discover** | `Library` + `DiscoverFeed` | Cookbook | recipes | ⚠️ Cookbook frame currently shows "Recipes/Shopping List" segments → **re-segment to Library / Discover** to match the live IA |
| `recipe/[id]` | `RecipeDetail` | Recipe detail | recipes | |
| `(tabs)/progress` | `ProgressDashboard` | Progress | progress-insights | |
| `(tabs)/settings` | `Settings` | Settings | settings | reached via top-right avatar |
| `onboarding` + `onboarding-v2` | `onboarding/web-flow` | Onboarding | onboarding | reconcile v2 vs canonical |
| `paywall` | `UpgradePrompt` | Paywall | paywall | |
| `cookbook-import` + `plan-import` + `import-shared` | `RecipeUpload` / `PlanSourceSelector` | Import | import | 3 import routes → 1 Figma frame; map each |
| Log flow: `PhotoLogSheet` + `VoiceLogSheet` + `FoodSearchModal` + `BarcodeScannerModal` + `LogTabBarButton` | `FoodSearch` | Log a meal | nutrition-log | ⊕ FAB opens this; Figma shows the unified entry sheet |

## B. NEEDS DESIGN — ✅ ALL DESIGNED in Figma (2026-06-02, "Drill-downs / extras" row at y=2600)

Every in-scope needs-design surface now has a Sloe Figma frame, Mobbin-informed, in the established system:
- ✅ **Macro detail** 148:2 · ✅ **Energy out** (burn) 149:2 · ✅ **Meal nutrition** 150:2 · ✅ **Weight metric** 151:2 (also covers `weight-tracker`)
- ✅ **Fasting** 154:2 · ✅ **Cook mode** 155:2 · ✅ **Weekly recap** 156:2
- ✅ **Shopping list** 159:2 · ✅ **Targets** 158:2 · ✅ **Household** 160:2
- ✅ **New recipe** (create) 162:2 · ✅ **Verify recipe** (import confidence) 163:2 · ✅ **Discover** (Recipes/Discover tab) 164:2 · ✅ **Creator profile** 165:2
- ✅ **Cookbook re-segmented** to **Library / Discover** (167:2, replaced 109:2)

Nothing in-scope remains undesigned. Remaining = re-skin-only (D) auto-covered + deferred (E).


| Mobile screen | Web equiv | Contract? | Notes |
|---|---|---|---|
| `weight-tracker` | (in Progress) | weight ✓ | has a contract, needs a frame |
| `cook` | `CookMode` | — | Cook Mode — important cooking surface |
| `create-recipe` + `recipe/create` + `recipe/verify` | `RecipeUpload` | (recipes) | recipe creation/verify flow |
| `shopping` | `ShoppingList` | (plan) | home = Plan (or Recipes) — confirm during design |
| `targets` | `Targets` | (settings/today) | goals/targets editor behind Settings rows |
| `fasting` | `FastingTimer` | — | **in scope** — Sloe design |
| `household-settings` + household bits | `HouseholdSettingsPage`/`HouseholdPanel`/`HouseholdBar` | — | **Sloe design** |
| `burn-detail` | `BurnDetailPanel` | (today) | **drill-down — Sloe design** |
| `macro-detail` | `MacroDetailPanel` | (today) | **drill-down — Sloe design** |
| `meal-nutrition` | (detail) | (nutrition-log) | **drill-down — Sloe design** |
| `progress-metric` | `ProgressMetricDetail` | (progress) | **drill-down — Sloe design** |
| `weekly-recap` | (recap) | (progress) | **drill-down — Sloe design** |

## C. FOLD — absorbed into a redesigned surface

- `library` + `discover` + `creator/[id]` → **Recipes tab** (Library + Discover sub-views, as today)
- `profile` → **Settings** (top-right avatar → Settings; nav unchanged)
- `barcode`, `search`, `PhotoLogSheet`, `VoiceLogSheet`, `FoodSearchModal` → **Log a meal** flow
- `targets` → reached from **Settings** (Daily Goals / Nutritional Targets) — designed as its own editor (see B)

## D. RE-SKIN ONLY — keep layout, gets Sloe tokens automatically

`(tabs)/notifications` + `notifications-prompt` · `(tabs)/search` (also folded into Log) · `health-sync` + `dev/health-import-labels` · `nutrition-sources` · `whats-new` · `(tabs)/more` · `login` · `+not-found`

## E. DEFERRED — post-launch (out of this redesign)

| Item | Figma | Contract | Notes |
|---|---|---|---|
| **Ask (AI coach)** | Ask (frame exists, parked) | ai-coach | No app route; post-launch build |
| **Habits** | — | habits | Never built; post-launch |

## F. EXCLUDE (not user-facing)

`dev/calorie-ring-states`, `dev/health-import-labels`, `_layout` — dev/infra.

---

## Build queue (derived)

1. **Token + font foundation** — Sloe palette + Newsreader into `theme.css` + `theme.ts` (semantic 8-slot remap; parity tests updated). Re-skins everything.
2. **Today-on-iOS pilot** — prove the pipeline end-to-end (real data, all states, screenshot-diff vs Figma).
3. **Core redesigns (A)** — Plan, Recipes (re-segment to Library/Discover), Recipe detail, Progress, Settings, Onboarding, Paywall, Import, Log.
4. **Needs-design (B)** — design each → Figma → build: drill-downs, weight, cook, shopping, targets, fasting, household.
5. **Re-skin verify (D)** — visual check only.
6. **Deferred (E)** — after launch.

## Web/mobile parity

Every verdict applies to **both** platforms (web components map 1:1 to the mobile surfaces). The token swap re-skins both; redesigns ship to both per the parity rule. iOS leads, web follows.

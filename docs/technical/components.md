# Component Reference

**Audience:** Developers

## Web Components (`src/app/components/`)

### Feature Components

| Component | Purpose |
|-----------|---------|
| `RecipeDetail` | Full recipe view — nutrition rings, ingredients with macros, cook mode, serving scaler, verify, publish |
| `DiscoverFeed` | Masonry grid of public community recipes with search/filter |
| `Library` | Personal saved recipe grid with sort/filter |
| `MealPlanner` | Drag-and-drop weekly meal planner calendar |
| `NutritionTracker` | Daily macro diary with food logging, progress rings, and water/hydration tracking card |
| `FoodSearch` | USDA/OFF food search panel for ingredient verification |
| `Profile` | User profile editor — body stats, goals, macro targets |
| `RecipeUpload` | Create/import recipe wizard (manual, URL, image) |
| `CookMode` | Step-by-step fullscreen cooking instructions with timer |
| `ShoppingList` | Shopping list with category grouping and check-off |
| `Settings` | App settings — theme, activity-adjusted goals, dashboard widget picker, week start, measurement system, dietary restrictions, notifications, data export |
| `TodayAtAGlance` | Dashboard widget showing today's macro progress |
| `GoPublicDialog` | Dialog to publish a private recipe to community |
| `NotificationsCenter` | Full notifications panel |
| `NotificationsBell` | Header bell icon with unread badge |
| `UpgradePrompt` | Inline banner prompting upgrade |
| `FirstRunChecklist` | Post-onboarding getting-started checklist |
| `suppr/RemainingMacrosBar` | Compact 4–5 column row (kcal/P/C/F + fiber when tracked) showing macros left today, with optional "after logging this" projection row for fit-this-in previews. Uses shared `lib/nutrition/remainingMacros.ts`. |
| `suppr/QuickAddPanel` | Tabbed picker (Favourites / Frequent / Recent / My meals) that re-logs a meal into the active slot with one tap. Star toggle persists to `public.user_favorite_foods`; the "My meals" tab reads from `public.user_saved_meals` + `user_saved_meal_items` (Batch 2.6). Uses shared helpers `lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`, and `savedMealsLogic.ts`, so the mobile Quick add panel in `apps/mobile/app/(tabs)/index.tsx` stays in sync. |
| `suppr/SaveMealDialog` | **Batch 2.6** — Dialog to save 2+ already-logged items as a reusable meal combo. Name input, optional default-slot dropdown, reorder-up/down + remove per item. Calls `createSavedMeal` and fires `saved_meal_created`. Opened from the `Save combo` chip on a `NutritionTracker` meal-slot header via the `suppr:open-save-meal-dialog` CustomEvent bridge. |
| `suppr/SavedMealsTab` | **Batch 2.6** — The "My meals" tab body inside `QuickAddPanel`. Lists combos with bundle totals (items count, kcal, P/C/F) + one-tap log + overflow menu (Rename / Delete). Loading, empty, and signed-out states handled explicitly. Pure presentation + dispatch; the parent owns fetch and optimistic state. |
| `suppr/CopyMealDialog` | Per-meal "Copy to another day…" dialog opened from the `NutritionTracker` row overflow menu. Single-date picker + optional quick-range chips (+2 / +3 / +7 days). Calls `copyMealToDate` or `copyMealToDateRange` on the `useNutritionJournalState` hook. Source day is always dropped via the shared `sanitizeCopyTargets`. |
| `suppr/DuplicateDayDialog` | Day-header "Duplicate day…" dialog. Single-day or inclusive range mode. Calls `duplicateDay` or `duplicateDayToDateRange`. No-ops when the source day has zero meals; shows factual summary copy. |
| `suppr/HydrationStimulantsCard` | **Batch 2.5** — Today dashboard card with three rows: Water, Caffeine, Alcohol. Water shows progress to `target_water_ml` with four quick-add chips (100/250/500/750 ml). Caffeine shows progress to `target_caffeine_mg` (default 400 mg, FDA) with four chips (Espresso / Coffee / Filter / Tea). Alcohol shows a week-rolling sum against `target_alcohol_g_weekly` with four chips (Beer 500ml / Wine 150ml / Spirit 44ml / Cider 330ml). Alcohol row is hidden when the weekly target is 0. Over-target copy is factual and amber, never red. Each row has a "Reset today" overflow action. Uses shared pure helper `lib/nutrition/hydrationStimulants.ts`. Parity with mobile `HydrationStimulantsCard`. |
| `suppr/AddIngredientDialog` | **Batch 2.7** — Dialog opened from the "+ Add ingredient" button on an imported recipe's ingredients tab (`RecipeDetail`). Free-text name + amount + unit picker + "Find match" button that calls the shared verify pipeline (`/api/nutrition/verify-recipe`) and pre-fills macros from USDA/OFF. Optional manual override section holds label values when no confident match is found. Save sets `addedByUser: true` on the persisted row and, when manual macros were typed, persists `overrideMacros` too. Fires `recipe_ingredient_added` with `{ recipeId, hasMatch }`. Parity with mobile `AddIngredientSheet`. |
| `suppr/OverrideIngredientDialog` | **Batch 2.7** — Per-row "Override nutrition…" action in the ingredients list. Number inputs pre-fill from the current effective macros (override-if-present else the match). Save persists `overrideMacros` on the row via the existing `recipe_ingredients` UPDATE path; Reset clears it. Fires `recipe_ingredient_overridden` / `recipe_ingredient_override_cleared` with `{ recipeId, ingredientPosition }`. Parity with mobile `OverrideIngredientSheet`. Both dialogs share `sanitizeOverrideInput` from `src/lib/nutrition/ingredientOverrides.ts`. |
| `suppr/CreateCustomFoodDialog` | **Batch 3.9** — Create or edit a user-defined custom food (e.g. "Homemade granola"). Name + optional Brand inputs, "Macros per N grams" basis (default 100g), macro inputs (kcal / protein / carbs / fat + optional fibre), repeatable `label = grams` rows for named serving shortcuts, and a live preview showing the first serving's scaled macros. Save / Save changes hands a `CreateCustomFoodPayload` back to the caller which runs it through `createCustomFood` / `updateCustomFood`. Zero-macro save is allowed with a soft "Macros not set" notice. Shares `scaleMacrosForGrams` / `dedupeServings` / `normaliseCustomFoodName` with mobile via `src/lib/nutrition/customFoods.ts`. Fires `custom_food_created` or `custom_food_updated` (caller-side). |
| `suppr/PlanTemplatesDialog` | **Batch 3.10** — Two-tab dialog on the Meal Planner header. "Save as template" mode: name input (1–80 chars, case-insensitive unique per user) + day-count selector clamped to plan length. "My templates" mode: list with Apply (confirms overwrite) and Delete actions. Rejects empty-week saves with an inline error — no silent success. Does no direct I/O — callers route through `createPlanTemplate` / `applyTemplateToWeek` / `deletePlanTemplate`. Fires `plan_template_created` / `plan_template_applied`. Parity with mobile `PlanTemplatesSheet`. |
| `suppr/WeeklyRecapCard` | **Batch 4.11** — Sunday-evening (Saturday for Sunday-start users) summary of the previous completed week, rendered on `ProgressDashboard`. Supportive, factual copy (no shame phrases). Stat grid: Avg calories, Avg protein + adherence %, Streak + freezes available, Weight delta (suppressed when <2 weigh-ins). "Share week" button uses `navigator.share` on mobile web + clipboard fallback; "Got it" / close button dismisses and writes `weekly_recap_last_seen_week_key` to profile. Uses shared `lib/nutrition/weeklyRecap.ts` (`buildWeeklyRecap`, `shouldShowRecap`, `weekKeyFor`, `formatRecapForShare`). Fires `weekly_recap_shown` / `_dismissed` / `_shared`. Parity with mobile `WeeklyRecapCard`. |
| `suppr/VoiceLogDialog` | **Batch 5.13** — Pro-tier voice logging. Press-and-hold mic (Web Speech API when available, typed fallback otherwise), posts transcript to `/api/nutrition/voice-log`, renders a review list where each parsed item shows a confidence badge (`ConfidenceDot`) and an "AI estimate" badge, and macros are inline-editable. Low-confidence (< 0.5) items get an amber border, `role="alert"` "please verify" note, and the submit label becomes "Log anyway". Shares `sanitiseAiItems`, `classifyConfidence`, `aggregateTotals`, `averageConfidence` with mobile via `src/lib/nutrition/aiLogging.ts`. Fires `voice_log_started` / `voice_log_committed`. Parity with mobile `VoiceLogSheet`. |
| `suppr/PhotoLogDialog` | **Batch 5.13** — Pro-tier AI photo logging. `<input type="file" accept="image/*" capture="environment">` + preview, posts multipart to `/api/nutrition/photo-log`, same review UI as `VoiceLogDialog` (confidence + AI badges, inline macro edit). Same shared sanitisation + totals helper. Fires `ai_photo_log_started` / `ai_photo_log_committed`. Parity with mobile `PhotoLogSheet`. |
| `suppr/AiPaywallDialog` | **Batch 5.13** — Factual Pro paywall shown when a free or Base user taps the Voice-log or Snap entry point. Feature-specific title + body, "Not now" and "See plans" actions (linking to `/pricing?from=voice_log` or `?from=photo_log`). No countdowns or dark patterns. Fires `voice_log_paywalled` / `ai_photo_log_paywalled` from the caller. |

### UI Primitives (shadcn/ui)

42 Radix-based primitives: accordion, alert-dialog, avatar, badge, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner (toasts), switch, table, tabs, textarea, toggle, toggle-group, tooltip.

## Mobile Components (`apps/mobile/components/`)

| Component | Purpose |
|-----------|---------|
| `FoodSearchModal` | Bottom-sheet food search — USDA + OFF results, portion picker, original recipe context, optional fit-this-in "If you log this" hint when caller supplies `macroTargets` / `macroConsumed` |
| `RemainingMacrosBar` | Row of kcal/P/C/F (+ fiber when tracked) showing macros left today. Parity with web `suppr/RemainingMacrosBar`, shares the same pure helper. Rendered on the Today tab below the calorie ring in day view. |
| Quick add panel (inline in `app/(tabs)/index.tsx`) | Full-screen overlay with Favourites / Frequent / Recent / My meals tab row. Opens from the `Previous` FAB action. Each row has a star toggle (`Ionicons star` / `star-outline`) and tap-to-log; saved-meal rows tap-to-log the whole combo and long-press for Rename / Delete. Shares `src/lib/nutrition/foodHistory.ts`, `favoriteFoods.ts`, `savedMeals.ts`, and `savedMealsLogic.ts` with the web `QuickAddPanel` component. |
| `SaveMealSheet` | **Batch 2.6** — Bottom-sheet mirror of web `suppr/SaveMealDialog`. Name `TextInput`, default-slot chip row, reorder/remove per item, Save persists via shared `createSavedMeal` and fires `saved_meal_created`. Triggered by the `Save combo` chip on a slot header when the slot has 2+ items. |
| Eat again card (inline in `app/(tabs)/index.tsx`) | Banner above the meal slots on Today when there is a prior-day meal in the current slot. One-tap logs into today's inferred slot. Dismissible for the day via AsyncStorage key `suppr-eat-again-dismissed`. Web parity via a matching inline card in `NutritionTracker.tsx` using `localStorage`. |
| `CopyMealSheet` | Bottom-sheet "Copy to another day" — in-house calendar + quick-range chips (+2 / +3 / +7). Mirrors web `suppr/CopyMealDialog`. Shares `addDays` / `sanitizeCopyTargets` from `src/lib/nutrition/copyMeals.ts`. |
| `DuplicateDaySheet` | Bottom-sheet "Duplicate day" with Single-day / Date-range toggle. Range mode is a two-tap start-then-end selection; visually shades the inclusive window. Mirrors web `suppr/DuplicateDayDialog` and shares `expandDateRange` / `sanitizeCopyTargets`. |
| `HydrationStimulantsCard` | **Batch 2.5** — Today tab card mirroring web `suppr/HydrationStimulantsCard`. Three rows (Water / Caffeine / Alcohol) with quick-add chips, progress bars to targets, factual over-target copy ("Over 400 mg" / "Over limit") in `Accent.warning` amber, and a "Reset today" modal per row. Alcohol row hidden when `target_alcohol_g_weekly === 0`. Every chip has `accessibilityRole="button"` and an `accessibilityLabel` naming quantity + stimulant. Shares all preset amounts and week-sum semantics with web via `src/lib/nutrition/hydrationStimulants.ts`. |
| `AddIngredientSheet` | **Batch 2.7** — Bottom-sheet mirror of web `suppr/AddIngredientDialog`. Opened from the "+ Add ingredient" row at the bottom of `recipe/verify.tsx`. Name `TextInput`, numeric amount, unit chip row, "Find match" calls the shared verify pipeline, and a collapsible manual-macros section holds label values when no match is confident. Persists via `addUserIngredient` in `apps/mobile/lib/verifyRecipe.ts`. Fires `recipe_ingredient_added`. |
| `OverrideIngredientSheet` | **Batch 2.7** — Bottom-sheet mirror of web `suppr/OverrideIngredientDialog`. Expanded-row "Override nutrition" action opens it pre-filled with current effective macros. Save persists via `setIngredientOverride`; Reset clears it. Fires `recipe_ingredient_overridden` / `recipe_ingredient_override_cleared`. Shares `sanitizeOverrideInput` + `effectiveMacros` + `recomputeRecipeTotals` with the web dialog via `src/lib/nutrition/ingredientOverrides.ts`. |
| `CreateCustomFoodSheet` | **Batch 3.9** — Bottom-sheet mirror of web `suppr/CreateCustomFoodDialog`. Name + optional brand, macros-per-`baseGrams` (default 100g) inputs, repeatable `label = grams` serving rows with add/remove, and a live preview of the first saved serving's scaled macros. `keyboardType="decimal-pad"` on every macro input; add/remove rows have per-row `accessibilityLabel`s. Does no I/O — hands the payload to the caller for `createCustomFood` / `updateCustomFood`. Uses the same `scaleMacrosForGrams` / `dedupeServings` / `normaliseCustomFoodName` helpers as web via `src/lib/nutrition/customFoods.ts`. |
| `PlanTemplatesSheet` | **Batch 3.10** — Bottom-sheet mirror of web `suppr/PlanTemplatesDialog`. Same two modes (Save / My templates), same validation (empty-week saves rejected loudly, name 1–80 chars). Delete has a native `Alert.alert` confirm. Shares all server logic with web via `src/lib/nutrition/planTemplatesClient.ts`. |
| `WeeklyRecapCard` | **Batch 4.11** — Mirror of web `suppr/WeeklyRecapCard` rendered on the Progress tab above the 2x2 stat grid. Share button uses the React Native `Share` API; dismiss writes `weekly_recap_last_seen_week_key`. Push notification (`apps/mobile/lib/weeklyRecapPush.ts`) schedules a local `Notifications.WEEKLY` trigger at Sunday-18:00 (Monday-start) or Saturday-18:00 (Sunday-start) when `weekly_recap_push_enabled = true`. All stat computation shared with web via `src/lib/nutrition/weeklyRecap.ts`. |
| `HandleSiriDeepLinks` (inline in `app/_layout.tsx`) | **Batch 5.12** — Listens for `Linking.getInitialURL()` + `Linking.addEventListener("url")`, parses via `parseSiriDeepLink` (shared), enqueues mutations via `setPendingSiriAction`, routes to `/`, and fires `AccessibilityInfo.announceForAccessibility` for VoiceOver confirmation. Skipped by the existing social-share forwarder so the two handlers never race. |
| Siri-action flush effect (inline in `app/(tabs)/index.tsx`) | **Batch 5.12** — On userId-ready and on every `AppState → "active"`, calls `consumePendingSiriAction` once and dispatches to `addWaterMl` (log_water) or the new `startFastFromShortcut` (start_fast). `today_remaining` is a no-op at flush time — the routing step already landed the user on Today. Guarded by 5-minute TTL so stale shortcuts never auto-log. |
| Widget snapshot effect (inline in `app/(tabs)/index.tsx`) | **Batch 5.12** — Watches `totals` + `effectiveCalorieGoal` + macro targets + `activeFastStart` and calls `writeWidgetSnapshot(buildWidgetSnapshot(...))` debounced 500 ms when the user is on Today in day view. Writes AsyncStorage always and a best-effort file to `FileSystem.documentDirectory/suppr-widget-snapshot.json`. Fires `widget_snapshot_updated` on success. Snapshot shape is frozen in `src/lib/nutrition/widgetSnapshot.ts` so a future native iOS widget extension reads it directly. |
| `VoiceLogSheet` | **Batch 5.13** — Mobile mirror of web `suppr/VoiceLogDialog`. Press-and-hold mic uses `expo-speech-recognition` when a dev build exposes it; typed fallback otherwise. Posts transcript to `/api/nutrition/voice-log`, renders a review list with confidence + "AI estimate" badges, inline macro edit, and per-item "Low confidence — please verify" notes. Fires `voice_log_started` / `voice_log_committed`. Shares helpers with web via `src/lib/nutrition/aiLogging.ts`. |
| `PhotoLogSheet` | **Batch 5.13** — Mobile mirror of web `suppr/PhotoLogDialog`. Uses `expo-image-picker` for camera + library selection. Posts multipart to `/api/nutrition/photo-log`, same review UI + inline macro edit. Fires `ai_photo_log_started` / `ai_photo_log_committed`. |
| Pro gate for Voice / Snap entry points (inline in `app/(tabs)/index.tsx`) | **Batch 5.13** — Loads `profiles.user_tier`; non-Pro users tapping Voice or Snap fire `voice_log_paywalled` / `ai_photo_log_paywalled` and route to `/paywall?from=voice_log` / `?from=photo_log` instead of opening the sheet. Quick-log chips show a small `lock-closed` icon next to the label for locked state. Mirrors the web paywall dialog. |
| `BarcodeScannerModal` | Camera overlay for barcode scanning with product lookup |
| `MealTypePicker` | Multi-select chips for meal type tagging (Breakfast/Lunch/Dinner/Snack) |
| `FirstRunChecklist` | Mobile onboarding checklist |
| `haptic-tab` | Tab bar button with haptic feedback |
| `parallax-scroll-view` | ScrollView with parallax header image |

## Mobile Screens (`apps/mobile/app/`)

### Tab Bar (5 visible tabs)

| Tab | Screen | Purpose |
|-----|--------|---------|
| Discover | `(tabs)/index.tsx` | Community recipe feed with search, save, macro chips |
| Library | `(tabs)/library.tsx` | Personal saved recipes |
| Plan | `(tabs)/planner.tsx` | Meal planner with slot toggles, macro indicators, swap, log |
| Track | `(tabs)/tracker.tsx` | Daily/weekly food diary with meal slots, barcode, previous meals |
| More | `(tabs)/more.tsx` | Menu: create, shopping, import, profile, barcode, settings |

### Stack Screens

| Screen | Purpose |
|--------|---------|
| `login.tsx` | Auth — email/password, magic link, Apple Sign-In |
| `onboarding.tsx` | 15-step profile setup with TDEE calculator |
| `recipe/[id].tsx` | Recipe detail with portion-adjusted view, macro rings, ingredients |
| `recipe/verify.tsx` | Ingredient-level nutrition verification with USDA search |
| `create-recipe.tsx` | Manual recipe creation with food search, meal type picker |
| `import-shared.tsx` | URL import with review screen and meal type picker |
| `shopping.tsx` | Shopping list with clear/remove/share |
| `cook.tsx` | Cook mode (step-by-step fullscreen) |
| `paywall.tsx` | Subscription paywall (IAP pending) |
| `profile.tsx` | Profile & macro target editor |

## Related Documents
- [Technical Architecture](architecture.md)
- [UX/UI Patterns](../ux/patterns.md)

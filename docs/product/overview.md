# Product Overview

**Audience:** All

## What is Suppr?

Suppr is a recipe and nutrition tracking platform that helps users import recipes from the web, verify their nutritional content against USDA/FDA databases (with Open Food Facts, Edamam, and FatSecret in the stack where applicable), plan meals to hit personal macro targets, and track daily food intake.

## Who is it for?

Health-conscious home cooks who want accurate nutrition data for the recipes they actually cook — not generic database entries. Primary personas:

- **Macro trackers** — people counting protein/carbs/fat for fitness goals
- **Meal preppers** — people who plan weekly meals in advance
- **Recipe collectors** — people who save recipes from food blogs and want them in one place with nutrition data

## Platforms

| Platform | Technology | Status |
|----------|-----------|--------|
| Web | Next.js 15 (App Router) | Production |
| iOS | React Native / Expo | Development |
| Android | React Native / Expo | Development |

## Core Value Proposition

1. **Import any recipe** — paste a URL, we extract ingredients and instructions automatically
2. **Real nutrition data** — verified against USDA FoodData Central, Open Food Facts, Edamam (parser / food search), and FatSecret
3. **Smart meal planning** — macro-aware algorithm that respects meal type tags and portion-scales to hit targets
4. **Track everything** — daily/weekly food diary with barcode scanning and previous meal re-logging

## Feature Map

### Recipe Management
- Import from URL (JSON-LD extraction from any recipe site)
- Import from social (Instagram/TikTok via OpenAI caption parsing)
- Manual recipe creation with ingredient search
- Ingredient-level nutrition verification with USDA food search
- **Add ingredient post-import** (Batch 2.7) — if the importer missed a row ("I also added cheese"), the recipe detail on web and the verify screen on mobile both expose a "+ Add ingredient" affordance. Name + quantity + unit + a "Find match" step that calls the same verify pipeline used during import; low-confidence or no-match rows persist with `addedByUser: true` so totals update but the row shows a low-confidence badge. Fires `recipe_ingredient_added`.
- **Per-ingredient override** (Batch 2.7) — when USDA/OFF picked the wrong food for one line, users can pin manual macros from the label on that row without rewriting the recipe. The override replaces the matched macros when computing recipe totals and shows a visible "override" badge with a Reset affordance to revert. Fires `recipe_ingredient_overridden` / `recipe_ingredient_override_cleared`.
- Barcode scanning for packaged foods
- Portion-adjusted recipe viewing
- Cook Mode (step-by-step fullscreen instructions)
- Recipe publishing and community feed

### Nutrition
- Multi-source verification pipeline (USDA -> OFF -> FatSecret -> local estimation)
- 60+ staple foods with fiber data for estimation fallback
- Per-ingredient macro display (calories, protein, carbs, fat, fiber, sugar, sodium)
- Confidence scoring and source attribution

### Meal Planning
- Configurable meal slots (Breakfast/Lunch/Dinner/Snack — toggle any on/off)
- Macro-aware scoring algorithm with portion scaling (0.5x to 2x)
- Profile-synced targets (calories, protein, carbs, fat)
- Per-macro over/under indicators per day
- Swap individual meals without regenerating entire plan
- Log planned meals directly to tracker
- Auto-generate shopping list from plan

#### Drag-drop meals between days (Batch 3.10)
Any planned meal can be moved to another day or another slot without regenerating the plan. On web, users drag a card and drop it on the target slot — source and destination swap places in one move, and day totals recompute immediately. A keyboard-accessible "Move" button opens a factual prompt (`day,slot`) that works identically for screen-reader and keyboard users. On mobile, the Move action lives in the meal action sheet. Both platforms fire `meal_moved_in_plan` with `{ fromSlot, toSlot, crossDay }`. The underlying `moveMealInPlan` helper is shared — there is no place for web and mobile to drift on what a "move" means.

#### Save plan as template (Batch 3.10)
A week (or any 1–7 day slice) can be saved as a named template like "Bulk week" or "Vacation week". Templates persist server-side in `user_plan_templates` with RLS locked to the owning user, and names are unique per user (case-insensitive). Applying a template overwrites the current week after a confirm. Empty-week saves fail loudly — there is no silent success and no blank template; the dialog shows "This plan has no meals to save." Web and mobile share the same validation, DB client, and pure helpers (`buildTemplateFromWeek`, `applyTemplateToWeek`, `validatePlanTemplate`).

#### Leftovers-aware plan (Batch 3.10)
When a recipe yields more than one serving and the user eats one, the remaining servings automatically fill matching slots on following days as "leftover of [recipe]". A dinner yielding 3 becomes lunch or dinner on the next two days; a breakfast yielding 2 becomes next-day breakfast or snack. Occupied slots are never overwritten. Leftover slots carry a `🍱 Leftover of [recipe]` badge but their macros equal the parent's scaled macros — the flag is purely visual, and totals are honest. If the user swaps or unlocks the parent, a confirm prompt states exactly how many leftovers will disappear ("This will remove 2 leftover meals.") and the plan recomputes. The whole pipeline lives in `src/lib/nutrition/leftoversPlanner.ts` and is unit-tested on both happy and unhappy paths.

### Food Tracking

#### Today progressive disclosure (Audit M4, 2026-04-18)
The Today screen progressively discloses its feature surfaces. On first run the
user sees **only** the essentials — Day strip, calorie hero ring, remaining
macros bar, meals section, and a single collapsed "Quick add" CTA above Meals.
Everything else reveals as the user demonstrates relevance.

| Card / surface | Visibility rule |
|---|---|
| Day strip, calorie hero ring, remaining macros bar, dashboard macro tiles, Meals section | Always visible in day view. |
| Quick add panel (Usual meals / Recent / Frequent / Favourites) | Collapsed by default behind a single "Quick add" CTA above Meals. Tap expands inline (web + mobile). The last open/closed choice persists per device under `suppr-quick-add-collapsed-v1` — localStorage on web, AsyncStorage on mobile. The full-screen panel (mobile FAB → Previous) remains the power-user path. |
| Hydration & stimulants card | Visible once the user has a non-zero `target_water_ml` **OR** has logged water / caffeine / alcohol (directly or via a meal that carries `waterMl`). Hidden first-run fallback: a compact "Track hydration?" link that reveals the card on tap — no state is written until the user logs something. |
| Steps & activity card | Visible once Apple Health / Google Fit has synced at least once (`steps_by_day` or `activity_burn_by_day` non-empty for any day). Hidden first-run fallback: a compact "Connect health" link (mobile opens the Health Sync screen; web reveals the card so the user can log steps manually). |
| Adaptive TDEE hint | Visible once `adaptive_tdee_confidence` is medium/high **OR** the user has logged ≥ 14 days. Matches the `getEffectiveTDEE` threshold so the hint and the calorie budget agree. |

Returning users never lose cards they have already interacted with — every
gate is sticky. Manual reveal is always available via the first-run links; no
card or feature is removed by this change. Rules live in the shared helper
`src/lib/nutrition/todayProgressiveDisclosure.ts` so web and mobile cannot
drift.

- Daily view with meal slot sections (Breakfast/Lunch/Dinner/Snack)
- Weekly view with calorie bar chart and macro breakdown
- Quick-log manual entry
- Search USDA/OFF food database
- Barcode scanner
- Re-log from previous meals
- Delete entries (long-press)
- Profile-synced targets with over/under display
- Remaining macros bar below the daily ring shows kcal / protein / carbs / fat (+ fiber when tracked) left today, flipping to a factual "+N over" indicator in the destructive colour once a macro exceeds its target
- Fit-this-in preview on food search — selecting a portion shows "If you log this: N kcal / Pg / Cg / Fg left" so the user can decide without leaving the sheet
- Quick add panel with **Usual meals / Recent / Frequent / Favourites** tabs (Ship M1 reorder). "Usual meals" replaces "My meals" as both the label and the first tab, making saved meals the canonical re-log surface. First-tab default resolves via the shared `resolveQuickAddDefaultTab(hasSavedMeals)` helper — `"saved"` when the user has ≥1 saved meal, else `"recent"`. Star a meal once to one-tap re-log it forever. Frequent ranks by how many times the meal has been logged; Recent shows the last 20 unique meals. Web and mobile share the same logic via `src/lib/nutrition/foodHistory.ts` + `favoriteFoods.ts`.

#### Usual meals (Ship M1 canonical re-log; Batch 2.6 infrastructure)
- **What it is** — a user-named bundle of 2+ foods logged together habitually (e.g. "My usual breakfast" = oats + berries + protein powder). One tap re-logs every item into the active slot on the active day with fresh ids, so the saved meal and its past instances are independent rows. Distinct from **recipes** (multi-step cooked dishes with ingredients/instructions), from **favourites** (single-food one-tap re-log), and from **meal templates** (future whole-day plans). Ship M1 (2026-04-18) makes this the **canonical re-log mechanism** — slot-level save + log surfaces + first-run hint + weekly-recap growth loop — and retires the "combo" terminology from user-facing copy.
- **Save flow** — the meal-slot section renders a full-width **"Save {Slot} as a meal"** row below the last item when the slot has ≥2 items and no saved meal exists yet for this slot. Replaces the old 10px "Save combo" metadata pill. Tapping opens the save dialog (web `SaveMealDialog`) / bottom sheet (mobile `SaveMealSheet`) with the items pre-filled and the active slot preselected. Dialog title: **"Save as a usual meal"**. Name is pre-filled as `My usual {slot}`. Item-level full editing post-save is deferred to a later batch — users delete + re-create to change items.
- **Re-log flow** — two surfaces:
  1. **Slot-header `[↻ Log usual: {name}]` pill (primary, Ship M1).** Renders on each slot header whose `defaultMealSlot` has ≥1 saved meal. Direct one-tap log; 2+ matches open a picker with the top 3 by `last_logged_at`. Fires `usual_meal_log_tapped` alongside `saved_meal_logged`.
  2. **Quick Add "Usual meals" tab (secondary).** Reordered to first-position. Tap `+` on any row to log the bundle into the active slot or the saved meal's stored default slot.
  Both paths go through the same `addLoggedMealForDate` (web) / `setByDay` (mobile) insert path as manual logs, so confidence, micros, and `nutrition_entries` end up identical to a normal log.
- **First-run hint (Ship M1).** After the user has either logged ≥2 items in a slot today OR logged the same item in a slot on ≥2 distinct days in the last 7, a one-off dismissible "Make this your usual {slot}. One tap to re-log it tomorrow." card renders inside the slot. `Save as usual` opens the save flow pre-seeded; `Not now` dismisses the hint for that slot forever. Dismiss state is persisted under `suppr-usual-meal-hint-dismissed-v1`. Analytics: `usual_meal_hint_shown` / `usual_meal_hint_accepted` / `usual_meal_hint_dismissed`, all `{ slot }`.
- **Weekly recap growth-loop line (Ship M1 + Action 5 Item 8).** The weekly `WeeklyRecapCard` on the Progress dashboard surfaces one additional line. Celebration: "You logged {name} {n} times this week." when a saved meal was re-logged in the window. Prompt (original Ship M1 path): "Got a usual {slot}? Save it once, log it in one tap." with a `Save {Slot} as a meal` CTA when the user has zero saved meals AND ≥5 distinct logged days. Prompt (loosened Action 5 Item 8 path, 2026-04-19): "Got a usual {slot}? You've logged the same one N times in 2 weeks." when the user has saved meals BUT the most-repeated unsaved slot has ≥3 distinct-day repeats of the same `(title, kcal)` pattern over the 14-day window (`USUAL_MEAL_REPEAT_FLOOR = 3`). Suppressed when all four canonical slots already have a saved meal, or when the dominant unsaved-slot pattern repeats <3 times. Decision lives in the pure `buildUsualMealRecapInsight` helper in `src/lib/nutrition/weeklyRecap.ts`.
- **Manage** — web overflow menu on each saved meal has Rename / Delete. Mobile long-press opens an action sheet with the same options. Rename trims + reuses the shared `renameSavedMeal`; delete cascades child items via FK `on delete cascade`.
- **Persistence** — parent row in `public.user_saved_meals` (name, optional `default_meal_slot`, `log_count`, `last_logged_at`) plus child rows in `public.user_saved_meal_items` (one per food, ordered by `position`). RLS locks both to the owning user. Saved meals are listed by `(last_logged_at desc nulls last, created_at desc)` so the most recently re-logged ones bubble up.
- **Analytics** — `saved_meal_created` on save, `saved_meal_logged` with `{ itemCount, slot }` on re-log, `saved_meal_deleted` on delete, plus the four Ship M1 events: `usual_meal_log_tapped`, `usual_meal_hint_shown`, `usual_meal_hint_accepted`, `usual_meal_hint_dismissed`. Events fire identically on web and mobile.
- **Accessibility** — name input is labelled "Usual meal name"; each item row has a full label including title + per-item macros; each saved-meal row label includes bundle totals so screen readers announce the macro cost before the user logs. Slot-header pill has a single-match label ("Log usual {Slot}: {name}") or a multi-match label ("Log a usual {Slot} — choose from N saved meals") depending on count.
- "Eat again" — re-logging a prior-day meal in one tap. The dedicated Today banner was **retired from both platforms**: suppressed from Today in the Sloe Figma 654:2 unification (mobile 2026-05-22; web commit 664df1cb), then the dead `TodayEatAgainBanner` / `TodayEatAgainScroller` components + their candidate/dismiss plumbing were **deleted in ENG-984 (2026-06-17)**. Today shows at most the north-star / deficit prompt. Re-logging now lives in the Quick Add picker's Recent / Frequent tabs. The shared `computeEatAgainForSlot` / `eatAgainDismiss` helpers (`src/lib/nutrition/`) remain as independently-tested utilities.
- Copy meal / Duplicate day — any logged meal has a "Copy to another day…" action (web: row overflow menu; mobile: long-press). Day header has a "Duplicate day…" action. Both offer a single target day and an inclusive multi-day range; the source day is always excluded. Copied rows go through the same `nutrition_entries` insert path as normal logs, with a fresh id per row. Shared helper `src/lib/nutrition/copyMeals.ts`. Analytics events: `meal_copied`, `day_duplicated` with `{ source, batchSize, targetDayCount }` on both platforms.

#### Custom foods (Batch 3.9)
- **What it is** — a user-defined food that isn't in USDA or Open Food Facts. The canonical use case is homemade items (granola, protein balls) and local-only items (corner-bakery pastry) where no label, no barcode, no USDA row exists. Distinct from **favourites** (starring a known food) and from **saved-meal combos** (bundling already-logged items).
- **Create flow** — web: "+ Create custom food" entry point is wired into the food-search panel (`FoodSearch.tsx`), always visible beneath the results list (and promoted when the query has zero results — "Can't find it? Create your own."). Opens `CreateCustomFoodDialog` prefilled with the current query as the food name. Mobile: same entry, same payload via `CreateCustomFoodSheet` inside `FoodSearchModal.tsx`. Both take Name (required) + optional Brand, "Macros per N grams" basis (default 100 — the nutrition-label convention), macro inputs (kcal / protein / carbs / fat + optional fibre), and any number of named serving shortcuts like `1 bowl = 80g`, `1 tbsp = 12g`, `1 cup = 120g`. A live preview shows the first saved serving scaled. Zero-macro save is allowed with a soft "Macros not set" notice — no blocking, the user fills it in later. After save, the panel auto-selects the new food and drops the user straight into the portion picker so logging is a single extra tap.
- **Log flow** — custom foods surface at the top of the food-search results list with a "Custom" badge (accessibility label "Custom food") when the typed query matches their name or brand (`searchCustomFoods`). When picked, the portion picker chips list the food's saved servings (labelled "1 bowl · 80 g" etc.) as a segmented control; changing the chip updates the gram weight immediately. The default chip is the first saved serving so most custom foods log in a single tap-to-confirm. Macros are projected onto a per-100g basis via the shared `customFoodToMacrosPer100g` helper and then scaled by the same `scaleMacros`/`scaleMacrosForGrams` path USDA / OFF results use — no nutrition values are minted; a non-positive `baseGrams` is treated as zero, never as a divide-by-zero. Logged custom foods write to `nutrition_entries` through the existing insert path (no bypass).
- **Edit / delete** — each custom food row in the library has an overflow menu (web) / long-press menu (mobile) with Edit + Delete. Edit opens the same dialog pre-filled; Delete removes the row. Dedupe: the DB unique index on `(user_id, lower(name))` prevents duplicates; on collision the client appends " (2)" … " (9)" to the name so rapid imports don't fail silently.
- **Persistence** — `public.user_custom_foods` (Batch 3.9). Macros per `base_grams`; `servings jsonb` holds `[{label, grams}]` bounded to 20 rows. RLS is owner-only full CRUD. Fiber is nullable (homemade items often genuinely lack a fiber value).
- **Analytics** — `custom_food_created` with `{ hasBrand, servingCount }` on save; `custom_food_updated` / `custom_food_deleted` on edit / delete; `custom_food_logged` with `{ servingLabel?, grams }` alongside the normal `food_logged` event so custom-food usage can be sliced without double-counting total logs.
- **Accessibility** — all inputs are labelled; macro inputs use `inputmode="decimal"` (web) / `keyboardType="decimal-pad"` (mobile); add / remove serving-row buttons carry per-row aria-labels referencing the row label so screen readers announce which row is being removed.

#### Hydration & stimulants (Batch 2.5)
- Today dashboard has a dedicated card with three rows: **Water**, **Caffeine**, **Alcohol**.
- **Water** — progress bar against `profiles.target_water_ml` + four quick-add chips (100 / 250 / 500 / 750 ml). Includes a "from logged food" sub-line when meals contribute water. Manual water input still flows through the manual-log modal.
- **Caffeine** — daily total in mg against `profiles.target_caffeine_mg` (default 400 mg — the FDA upper bound for healthy adults). Four quick-add chips: Espresso (64 mg), Coffee (95 mg), Filter coffee (120 mg), Black tea (48 mg). Additional presets (green tea, energy drink, cola) are available programmatically and used by future UI. Over-target copy is factual — "Over 400 mg" — in `Accent.warning` amber, never the destructive red. No card-wide red treatment.
- **Alcohol** — **week-rolling** grams-of-ethanol sum against `profiles.target_alcohol_g_weekly`. Four quick-add chips: Beer 500 ml (16 g), Wine 150 ml (14 g), Spirit 44 ml (14 g), Cider 330 ml (12 g). 14 g ethanol ≈ 1 US standard drink ≈ 1.75 UK units. The whole row is **hidden** when `target_alcohol_g_weekly === 0` — users opt in via Settings. Over-target copy is factual — "Over limit" — also in amber.
- **Reset today** — each row has an overflow action that clears that day's value for that kind, leaving the other two rows (and the other days) untouched.
- **Apple Health** — inbound: dietary caffeine samples are pulled into `extra_caffeine_by_day` on the same throttle as `syncNutritionFromHealthThrottled`, using `max(existing, imported)` per day to stay idempotent across re-syncs. Outbound: `exportDayToHealth` writes a `Suppr caffeine` food sample with the day's caffeine total. Alcohol is **not** wired because `HKQuantityTypeIdentifierNumberOfAlcoholicBeverages` is a count type that sits outside the dietary `saveFoodSample` path — tracked as a backlog item.
- **Analytics** — every quick-add fires `hydration_logged` (water) or `stimulant_logged` (caffeine / alcohol) with `{ type, amount, unit, preset }`. Reset actions fire the same events with `amount: 0, preset: "reset"` so reset frequency is observable.
- **Accessibility** — every chip carries an `aria-label` (web) / `accessibilityLabel` (mobile) that names both the quantity and the stimulant, e.g. "Add 250 millilitres water", "Add Coffee: 95 milligrams caffeine", "Add Wine 150ml: 14 grams alcohol".

### Shopping List
- Auto-generated from meal plan
- Grouped by category
- Check off items
- Remove individual items (long-press)
- Clear checked / clear all
- Share via system share sheet (Apple Reminders compatible)

### User Profile
- 15-step onboarding with TDEE calculator
- Activity level, goal (cut/maintain/bulk), macro strategy
- Custom calorie/protein/carbs/fat/fiber/water targets
- Caffeine daily cap (default 400 mg — FDA) and optional alcohol weekly cap (default 0 = hidden). Configurable in Settings.
- Measurement system preference (metric/imperial)
- Apple Sign-In, email/password, magic link auth

### Engagement & Retention (Batch 4.11)

**Streak freeze.** The logging streak (`computeLoggingStreak`) is a retention signal, but a hard streak punishes real-world users (sick days, travel). Users hold a small budget of freeze credits (default cap 3, configurable 0–10) that each absorb a single zero-meal day without breaking the streak. Freezes are earned automatically when the streak crosses a multiple of 7 (7, 14, 21…). UI copy is factual — "Freeze used (Tue)", never "Streak saved!". The raw streak is never overwritten; the protected streak is a derived value (`computeProtectedStreak`) so we can surface both side-by-side when useful. Feature can be disabled per-user by setting `streak_freeze_budget_max = 0`.

**Weekly recap card.** On Sunday evening (or Saturday for Sunday-start users), the Progress dashboard surfaces a recap of the week that just ended: avg calories, avg protein + adherence %, streak length, best day (highest-protein), and weight delta (suppressed when <2 weigh-ins). Supportive, factual copy — "3 days logged this week" not "You missed 4 days". Dismissible ("Got it") and shareable ("Share week" → system share sheet / clipboard). Once dismissed, the same week doesn't re-appear; the card reappears when the week key flips. As of Action 5 Item 7 (2026-04-19) the recap also surfaces a one-line "Your maintenance landed at X kcal this week (formula said Y)." between the stat row and the share button — only when the resolver's adaptive branch won at medium / high confidence; suppressed for formula fallback, low confidence, and identical values via the shared `formatMaintenanceRecapLine` helper.

**Weekly recap push (mobile).** Local `expo-notifications` trigger fires at 18:00 on the end-of-week day in the device's local timezone, nudging users back to the recap. Respects `weekly_recap_push_enabled` (first-class opt-out in Settings on both platforms — web Settings Notifications section and mobile More → Connections → "Weekly recap"). Toggling off cancels any queued notification immediately; toggling on reschedules. Fires `weekly_recap_push_enabled_toggled { enabled }` on committed change. The notification deep-links to `/progress`. Web push is deferred — weekly recap is mobile-primary, and web users who open the app get the card directly on Progress.

### iOS widgets + Siri Shortcuts (Batch 5.12)

**Siri Shortcuts deep links.** Three `suppr://` URLs cover hands-free action without a native Siri Intent extension. Users add them to the iOS Shortcuts app (Open URL action) and optionally donate to Siri / add to Home screen / attach to the Action Button.

- `suppr://log/water?ml=250` — add N ml water to today's hydration. `ml` defaults to 250, clamps to 1..5000, rejects non-numeric.
- `suppr://fast/start?hours=16` — begin an N-hour fast. `hours` defaults to 16, clamps to 1..48, rejects non-numeric. No-ops when a fast is already active (never stacks sessions).
- `suppr://today/remaining` — open Today. Also the tap URL for the (future) Home / Lock-screen widget.

The URL parser (`parseSiriDeepLink`) uses the WHATWG `URL` class, is case-insensitive on host + path, treats a present-but-non-numeric parameter as hostile (rejects rather than silently defaults), and never throws. A pending-action queue (`lib/siriPending.ts`, single-slot / latest-wins / 5-minute TTL) bridges the deep-link handler in `_layout.tsx` to the Today tab so the layout doesn't need access to Today's hook state. Water actions flow through the existing `addWaterMl` path; fast actions append to `profiles.fasting_sessions` via `startFastFromShortcut`. Every action triggers an accessibility announcement so VoiceOver users hear confirmation immediately.

**iOS widget snapshot.** Today writes a compact snapshot of the day to AsyncStorage and (best-effort) to a shared file in the documents directory every time kcal consumed / target / remaining macros / active fast state changes, debounced 500 ms. Snapshot shape (`WidgetSnapshot`) is frozen in `src/lib/nutrition/widgetSnapshot.ts` so a future native Swift widget extension can read it via App Group without JS involvement. The widget itself is deferred to a separate iOS developer task that wires `expo-apple-targets` (or equivalent) and a `WidgetKit` target — the snapshot is ready for consumption as soon as that extension lands. Analytics `widget_snapshot_updated` on every successful write.

**Deferred.** Native Swift widget extension (render the calorie ring / remaining macros / fasting countdown). `react-native-siri-shortcut` donation (auto-populate the Shortcuts app without pasting URLs). Both can slot in without reshaping the shared helpers.

### Voice logging + AI photo logging (Pro, Batch 5.13)

**What it is.** Two hands-free ways to log a meal:

- **Voice log.** Press-and-hold the mic, describe what you ate in natural language ("two eggs and a slice of toast"), release to transcribe. The transcript is parsed by an LLM into structured food items, and each item is run through our verified nutrition pipeline (USDA -> Open Food Facts -> FatSecret -> estimation fallback) — we never invent macro values.
- **AI photo log.** Snap a photo of your meal; GPT-4o identifies the foods and estimates portions, we match each one against the verified nutrition pipeline, and you get a review list before anything commits to your diary.

**Why Pro.** Both features call vision / language models with per-user cost. They sit behind `user_tier === "pro"`; free + Base users see a factual paywall dialog ("Voice logging is a Pro feature. Upgrade to use it.") and a lock icon on the entry points. No countdowns, no dark patterns.

**Review before commit.** Every parsed item shows a confidence dot (high / medium / low, 0.75 and 0.5 thresholds), an "AI estimate" badge, and inline-editable macros. Items with confidence < 0.5 get an amber border and a "Low confidence — please verify" note. Nothing auto-logs: the user always taps "Log all" (or "Log anyway" when low-confidence items are present).

**Source tagging.** Voice-logged entries carry `source: "AI voice"`; photo-logged entries carry `source: "AI photo"`. These surface in the Quick Add Recent tab with a small "AI" badge so users can always tell which diary rows came from an AI estimate.

**Analytics.** `voice_log_started`, `voice_log_committed` (`{ itemCount, avgConfidence }`), `voice_log_paywalled`, `ai_photo_log_started`, `ai_photo_log_committed`, `ai_photo_log_paywalled`. The same events fire on web and mobile via the shared `src/lib/analytics/events.ts` map.

**Deferred.** Server-side Whisper-based audio upload (the browser Web Speech API + mobile OS STT cover the current release). A native multilingual prompt. Native Android mic permission prompt UI (handled by Expo when permission is denied).

### Monetisation
- Free / Base (£3.99/mo or £29.99/yr) / Pro (£7.99/mo or £59.99/yr) tiers — 37% saving on annual
- Web: Stripe direct (Checkout + webhook). Mobile: Apple IAP via RevenueCat SDK. Both write to `profiles.user_tier` — Pattern A per `docs/decisions/2026-04-19-billing-architecture-pattern-a.md`
- Mobile IAP offering provisioning pending in RevenueCat dashboard (tracked in ship checklist)

## Related Documents
- [Web / mobile parity & navigation scope](./web-mobile-parity-scope.md) — Discover / Plan / Profile audit, photo/voice scope, Library tab decision
- [Technical Architecture](../technical/architecture.md)
- [User Journeys](../journeys/)
- [API Reference](../api/)
- [Data Schema](../data/schema.md)

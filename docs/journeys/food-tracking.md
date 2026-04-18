# User Journey: Food Tracking

**Audience:** Product / Design

## Overview
User logs food throughout the day, tracks progress against their calorie and macro targets, and reviews weekly trends.

## Entry Points
- Track tab on the bottom navigation

## Day View

### First-run Today (Audit M4, 2026-04-18)
Before any data exists, Today is intentionally sparse. A brand-new user sees:

1. **Day strip** — pick a day (today is pre-selected).
2. **Calorie hero ring** — shows target vs consumed (0 consumed on first run).
3. **Remaining macros bar** — kcal / P / C / F left today.
4. **Meals section** — four empty meal slots with "+ Add food" per slot.
5. **Quick add CTA** (collapsed) — a single tappable pill above Meals. Expanding it reveals the Favourites / Frequent / Recent / My meals tabs inline; the choice persists per device under `suppr-quick-add-collapsed-v1`.
6. **"Track hydration?"** — tiny link shown in place of the hydration card until the user has a water target or has logged water / caffeine / alcohol.
7. **"Connect health"** — tiny link shown in place of the Steps & activity card until Apple Health / Google Fit has synced at least once (mobile opens the Health Sync screen; web reveals the card so the user can log steps manually).

Hydration, Steps, Activity Bonus, Adaptive TDEE hint, and Deficit insight only
appear once the user's state earns them (see `todayProgressiveDisclosure.ts`
for the rules). The primary action on first-run Today is therefore always
unambiguous: **log something**.

A returning user who has ever interacted with any card continues to see that
card — the gates are sticky.

### Layout
```
┌─────────────────────────────┐
│  Day | Week  toggle         │
│  ‹  Today  ›  (date nav)   │
├─────────────────────────────┤
│  1,240 kcal left            │  ← hero number (red "+250 over" when exceeded)
│  ███████░░░░ Food / Goal    │  ← calorie bar (red when over)
├─────────────────────────────┤
│  PROTEIN  ███████░ 60g/93g  │
│  CARBS    █████░░░ 80g/124g │
│  FATS     ████░░░░ 30g/41g  │
├─────────────────────────────┤
│  KCAL   PROTEIN  CARBS  FAT │  ← RemainingMacrosBar
│  1,240  33g left 44g   11g  │    (+ FIBER column when fiber target set)
│  left   /93g     /124g /41g │    over-budget → "+N over" in destructive colour
├─────────────────────────────┤
│  HYDRATION & STIMULANTS     │  ← Batch 2.5 card
│  💧 Water    750/2500 ml    │  ← water row, quick-adds 100/250/500/750
│    [+100] [+250] [+500] [+750]                                        │
│  ☕ Caffeine  95/400 mg      │  ← caffeine row (default 400 mg / FDA)
│    [+Espresso][+Coffee][+Filter][+Tea]                                │
│  🍷 Alcohol  28/196 g/week  │  ← alcohol row (hidden when target = 0)
│    [+Beer][+Wine][+Spirit][+Cider]
│    Over-target: amber "Over 400 mg" / "Over limit" (no red card)     
├─────────────────────────────┤
│  Goal - Food = Remaining    │  ← calorie math (shows "Over" in red)
├─────────────────────────────┤
│  Breakfast  ▾  120 kcal     │  ← tap header to collapse/expand
│  ├─ Protein Oats  506 kcal  │  ← click delete icon to remove (with confirmation)
│  └─ [ADD FOOD]              │  ← opens quick-log for Breakfast slot
│  Lunch  ▾                   │
│  └─ [ADD FOOD]              │
│  Dinner  ▾                  │
│  └─ [ADD FOOD]              │
│  Snack  ▾                   │
│  └─ [ADD FOOD]              │
├─────────────────────────────┤
│  [+ Quick Add] [Search]    │
│  [Scan]        [Previous]  │  ← action buttons
└─────────────────────────────┘
```

### Adding Food

**Quick Add** — manual entry form:
- Meal slot switcher (Breakfast/Lunch/Dinner/Snack tabs)
- Fields: food name, calories, protein, carbs, fat
- "Add to Today" button

**Search** — FoodSearchModal:
- Search USDA + Open Food Facts databases
- Select food → portion picker → Use this
- When the caller supplies macro targets and today's consumed totals, the portion picker shows a fit-this-in preview row ("after: N kcal / Ng / Ng / Ng left") that updates as the user adjusts the portion. This uses `projectRemaining()` from `src/lib/nutrition/remainingMacros.ts`. Present on both web (`FoodSearch.tsx`) and mobile (`FoodSearchModal.tsx`).
- Logged to the active meal slot

**Create custom food** (Batch 3.9) — entry point inside the food-search panel:
- Can't find your food? **Create a custom food from FoodSearch.** Type what you're looking for, and when the results don't match — or when you already know the item only exists in your kitchen — tap "+ Create custom food" at the bottom of the results (or "Can't find it? Create your own." in the zero-results state). Fill in Name + macros + saved servings, hit Save, and the panel drops you straight into the portion picker for the food you just created so logging is one more tap. The same flow works on web (`FoodSearch.tsx` → `CreateCustomFoodDialog`) and mobile (`FoodSearchModal.tsx` → `CreateCustomFoodSheet`).
- Always visible as a "+ Create custom food" row at the bottom of the results list; promoted when the query returns zero results (for "homemade X" / "nana's Y" cases where USDA and OFF have nothing).
- Opens `CreateCustomFoodDialog` (web) / `CreateCustomFoodSheet` (mobile) with the typed search query pre-filled as the Name.
- Form fields: Name (required), Brand (optional, e.g. "My recipe", "Local bakery"), "Macros per N grams" basis (default 100), kcal / protein / carbs / fat / optional fibre, and any number of named serving shortcuts as `label = grams` rows (e.g. "1 bowl = 80g", "1 tbsp = 12g"). A live preview shows the first saved serving scaled.
- Save persists to `public.user_custom_foods` via `createCustomFood`. Unique-violation on `(user_id, lower(name))` retries with " (2)", " (3)", … up to " (9)" appended so a quick rename is not required.
- After save, the custom food is searchable (`searchCustomFoods` runs `ilike` across name + brand) and surfaces at the top of search results with a "Custom" badge (accessibility label "Custom food").
- When the user picks a custom food, the portion sheet offers the standard grams path plus a segmented control of the food's saved servings. The default chip is the first saved serving so most custom foods log in one tap. Macros project onto per-100g via `customFoodToMacrosPer100g`, then scale linearly via the same `scaleMacros` path USDA / OFF use (never invented, never divide-by-zero). Entries write to `nutrition_entries` through the existing insert path.
- Edit / Delete — web: overflow menu on the custom-food row (confirm via `window.confirm` fallback). Mobile: long-press the row, then pick Edit or Delete from the action sheet (double-confirmed for delete). Edit opens the same dialog pre-filled.
- Analytics: `custom_food_created` with `{ hasBrand, servingCount }` on save, `custom_food_updated` on edit, `custom_food_deleted` on delete. Logging a custom food fires `custom_food_logged` with `{ servingLabel?, grams }` alongside the normal `food_logged` event.

**Scan** — BarcodeScannerModal:
- Camera barcode scanning
- Product lookup via Open Food Facts
- Auto-logs to active meal slot

**Voice log (Pro, Batch 5.13)** — `VoiceLogDialog` (web) / `VoiceLogSheet` (mobile):
- Entry point: "Voice" chip in the Today quick-log strip and in the FAB sub-sheet. Free + Base users see a lock icon and the factual paywall dialog ("Voice logging is a Pro feature. Upgrade to use it.") on tap — no countdowns, no dark patterns. Analytics: `voice_log_paywalled`.
- **Capture.** Press-and-hold the mic to record. Web uses the browser Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) when available; mobile uses `expo-speech-recognition` when a dev build exposes it. Both fall back to a typed input if native capture is unavailable.
- **Parse.** Transcript POSTs to `/api/nutrition/voice-log`. The route calls GPT-4o-mini to decompose the transcript into structured items (`name`, `amount`, `unit`), then runs each through the shared `verifyIngredients` pipeline to get verified macros. No nutrition values are invented by the LLM — per MacroFactor-style approach.
- **Review.** Each parsed item is rendered with an editable name, editable macros (kcal/P/C/F), a confidence dot (high ≥0.75 / medium ≥0.5 / low <0.5), and an "AI estimate" badge. Low-confidence items get an amber border + a `role="alert"` "Low confidence — please verify" note; the commit button becomes "Log anyway".
- **Commit.** "Log all" writes each reviewed item as a separate diary row with `source: "AI voice"`. Analytics: `voice_log_committed` with `{ itemCount, avgConfidence }`.

**Photo log (Pro, Batch 5.13)** — `PhotoLogDialog` (web) / `PhotoLogSheet` (mobile):
- Entry point: "Snap" chip in the Today quick-log strip. Same Pro gate as voice log (lock icon + factual paywall dialog for free + Base tiers; analytics: `ai_photo_log_paywalled`).
- **Capture.** Web uses `<input type="file" accept="image/*" capture="environment" />` for camera / library selection. Mobile uses `expo-image-picker` with both Camera and Library buttons. Local preview renders from the picked File / URI.
- **Analyse.** "Analyse" POSTs multipart to `/api/nutrition/photo-log`. GPT-4o identifies foods and estimates portions; each item is matched through `verifyIngredients` for verified macros. Max photo size 6 MB (enforced server-side).
- **Review + commit.** Same review UI as voice log (confidence + AI-estimate badges, inline macro edit, low-confidence amber styling). Commit writes rows with `source: "AI photo"`. Analytics: `ai_photo_log_started` / `ai_photo_log_committed`.

**AI-sourced row badge.** Rows in the Quick Add panel's Recent tab show a subtle "AI" badge when their `source` contains `"AI voice"` / `"AI photo"` / `"voice"` / `"ai_photo"`. This is informational (not shameful) so users can always tell a macro estimate came from an AI pass.

**Quick add** — tabbed panel (Favourites / Frequent / Recent / My meals):
- Opens from the `Previous` FAB action on mobile; rendered inline above the Meals section on web.
- **Favourites** — meals the user has starred. Source of truth: `public.user_favorite_foods`. Empty state copy: "Star meals you log often for one-tap re-logging."
- **Frequent** — most-logged meals across journal history, ranked by count. Source: `computeFrequentMeals()` from `src/lib/nutrition/foodHistory.ts`.
- **Recent** — the last 20 unique meals from journal history (default tab; matches the prior "Previous Meals" behaviour).
- **My meals** (Batch 2.6) — user-saved meal combos from `public.user_saved_meals`, newest-re-logged first. Each row shows name, item count, and bundle totals. Tap `+` to log every item to the active slot in one action. Overflow (web) / long-press (mobile) exposes Rename / Delete.
- Each single-food row shows title, kcal · P/C/F summary, an `Nx` occurrence badge, a star toggle, and a `+` button that logs to the active slot.
- Star toggles are optimistic and revert on Supabase error; a unique-violation on add is treated as success (existing row is returned).

### Save a meal combo (Batch 2.6)
A **saved meal** is a user-named bundle of 2+ foods the user habitually logs together — e.g. "My usual breakfast" = oats + berries + protein powder + almond butter. It is **not** a recipe (no ingredients list, no instructions, no servings) and **not** a single favourite (favourites are one food; combos are a bundle). Meal templates (whole-day plans) are a separate future concept.

- **Entry point:** every meal-slot header shows a **Save combo** chip once the slot has 2+ logged items. Tap it to open the save UI — the web dialog (`suppr/SaveMealDialog`) or the mobile bottom sheet (`SaveMealSheet`). Gated on ≥2 items — with fewer the chip isn't rendered.
- **Save form:** name input (required, trimmed, cap 80 chars) + optional default-slot chip/dropdown (Breakfast / Lunch / Dinner / Snacks) + reorderable item list (up / down arrows + remove). The active slot is preselected as the default slot, and the name is pre-filled with "My <slot> combo".
- **Persistence:** parent row lands in `public.user_saved_meals` (name, optional `default_meal_slot`, `log_count`, `last_logged_at`); child rows land in `public.user_saved_meal_items` (one per food, ordered by `position`). If the items insert fails the parent is deleted (no zombie combos).
- **Re-log:** in the Quick Add panel's "My meals" tab, tap `+` on a row to expand the combo into individual journal entries via the shared `buildMealEntriesFromSavedMeal` helper and insert each through the same `addLoggedMealForDate` (web) / `setByDay` (mobile) path as any manual log. Each re-log gets fresh ids per row, so past logs and the saved combo stay independent. Combos with a `default_meal_slot` log into that slot; otherwise they log into the active slot.
- **Rename / Delete:** web uses a row overflow menu; mobile uses long-press + action sheet. Rename trims + persists via `renameSavedMeal`; delete cascades child items via FK `on delete cascade`.
- **Analytics:** `saved_meal_created` (with `itemCount`, `defaultMealSlot`), `saved_meal_logged` (`itemCount`, `slot`), `saved_meal_deleted`. All three fire on both platforms.
- **Edge cases:** signed-out users see an "Sign in to save meal combos" empty state. An empty combo never appears in the list (parent-without-items rows are cleaned up on failed insert). Concurrent double-taps on a row are guarded by an optimistic pending-ids set so the user sees one log even if they tap twice.

**Eat again card** — one-tap banner above the meal slots on Today:
- Appears when `computeEatAgainForSlot(byDay, currentSlotFromTime, now)` finds a meal in the current slot on a prior day. `currentSlotFromTime` is inferred from local clock time (Breakfast/Lunch/Snacks/Dinner).
- One tap logs the meal into today's inferred slot with source provenance preserved.
- Dismissible for the day; resets on the next new day. Persisted via `localStorage` (web) / `AsyncStorage` (mobile) under key `suppr-eat-again-dismissed`.

### Collapsing Meal Sections
- Tap/click any meal header (Breakfast, Lunch, etc.) to collapse or expand that section
- Collapsed sections still show the total kcal in the header
- A chevron indicator rotates to show collapsed/expanded state
- Both web and mobile support this behaviour

### Deleting Food
- **Mobile:** Long-press any logged entry -> action sheet with Edit / Copy / Delete -> removes from journal
- **Web:** Click the row overflow menu -> "Delete" -> `window.confirm()` dialog -> removes from journal
- Both platforms issue a `DELETE` against `nutrition_entries` so the removal persists across sessions and devices.

### Copying food to another day (batch 1.4)
- **Web:** On any logged meal row, the overflow menu exposes **Copy to another day…** which opens the `CopyMealDialog`. The day header above the Meals section has a **Duplicate day…** button when the day has meals.
- **Mobile:** Long-press on a meal row opens the action sheet with **Copy to another day**. The day view shows a small **Duplicate day…** chip above the meal-slots card when meals exist.
- **Target selector:** both platforms offer a single target day (date picker) plus optional quick-range chips (+2, +3, +7 days) on Copy, and a Single-day / Date-range toggle on Duplicate. The source day is always dropped and duplicate targets are deduped by the shared helper `sanitizeCopyTargets`.
- **Persistence:** each destination row is inserted through the same `nutrition_entries` insert path as a normal manual log, with a freshly minted `id`. The source row is never mutated.
- **Edge cases:** if the target list resolves to zero (e.g. only the source day was selected), both platforms show a factual **"Nothing to copy"** / **"Nothing to duplicate"** toast and make no writes. Duplicating a day with zero meals is also a no-op.
- **Analytics:** one `meal_copied` or `day_duplicated` event per confirmed action, with `{ source, batchSize, targetDayCount }`.

### Date Navigation
- `‹` and `›` arrows to move between days
- Tap date label to jump to today
- Shows "Today", "Yesterday", or "Mon 7 Apr" format

## Week View

### Layout
```
┌─────────────────────────────┐
│  Weekly Calories            │
│  Mon Tue Wed Thu Fri Sat Sun│
│  ▓▓▓ ▓▓▓ ▓   ▓▓            │  ← bar chart (red bars = over target)
│  Daily goal: 1,240 kcal    │
├─────────────────────────────┤
│  Weekly Summary             │
│  8,680 total  1,240 avg  0 │
│  Total kcal   Daily avg  Over│
├─────────────────────────────┤
│  Daily Averages             │
│  PROTEIN  ███████░ 85g/93g  │
│  CARBS    █████░░░ 95g/124g │
│  FATS     ████░░░░ 35g/41g  │
├─────────────────────────────┤
│  Macro Breakdown            │
│  Mon ████████████ 1,240     │  ← stacked P/C/F bar per day
│  Tue ████████████ 1,180     │
│  ...                        │
│  🔴 Protein  🔵 Carbs  🟡 Fat│
└─────────────────────────────┘
```

- Tap any day bar to drill into Day view for that date
- Week navigation with `‹` `›` arrows
- Weekly average calculated from days with logged food only
- Week boundary respects `profiles.week_start_day` (Monday or Sunday). In calendar-week mode the seven displayed days start on the user's chosen day. In rolling mode the window is always the 7 days ending on the selected date, ignoring week start.

## Hydration & Stimulants Card (Batch 2.5)

- Component: `src/app/components/suppr/hydration-stimulants-card.tsx` (web), `apps/mobile/components/HydrationStimulantsCard.tsx` (mobile).
- Shared pure helper: `src/lib/nutrition/hydrationStimulants.ts` — presets, `weeklyAlcoholG`, `sumWaterFromMeals`, `isOverTarget`, `parseDayNumberMap`, `formatWaterAmount`, `imperialWaterQuickAdds`.
- **Water target**: `profiles.target_water_ml` (existing). Storage is always millilitres on both platforms.
- **Measurement system (audit C3, 2026-04-18):** the water row, the "from logged food" sub-line, and the quick-add chips respect `profiles.measurement_system` on both platforms. Imperial renders in `fl oz` (chips at 4 / 8 / 16 / 20 fl oz — each stored as integer millilitres); metric renders integer ml up to 1 L, then one-decimal L. Caffeine stays in mg and alcohol in grams on both systems. Flipping measurement system on Settings and returning to Today re-renders the same logged water in the new unit — nothing is re-encoded.
- **Caffeine target**: `profiles.target_caffeine_mg`, default 400 mg (FDA upper bound for healthy adults).
- **Alcohol target**: `profiles.target_alcohol_g_weekly`, default 0 (row hidden). Users set it in Settings; 196 g ≈ 14 UK units.
- **Persistence**: `extra_water_by_day`, `extra_caffeine_by_day`, `extra_alcohol_g_by_day` on `profiles`. Each is a `{YYYY-MM-DD: number}` map. Writes are debounced to 300ms on web and awaited per-tap on mobile (matches the pre-existing water pattern).
- **Reset today**: per-row overflow action (web dropdown / mobile modal) deletes the current day's key for that kind and persists, untouched other days.
- **Over-target copy** is factual and amber (`Accent.warning`), never red:
  - Caffeine: `Over <target> mg` when daily total exceeds `target_caffeine_mg`.
  - Alcohol: `Over limit` when the week-rolling sum exceeds `target_alcohol_g_weekly`.
- **Analytics**: `hydration_logged` (water) or `stimulant_logged` (caffeine/alcohol) with `{ type, amount, unit, preset }`. Reset fires `amount: 0, preset: "reset"`.
- **Apple Health (iOS)**: inbound caffeine import on the existing nutrition-import throttle; outbound caffeine written as a single `Suppr caffeine` food sample. Alcohol is not wired (see `docs/health-platform-phase-b.md` backlog).

## Data Storage
- Primary: `nutrition_entries` relational table (one row per logged meal)
- Fallback: `nutrition_journals` legacy JSON blob keyed by date (`YYYY-MM-DD`)
- Each entry: `{ id, name (slot), recipeTitle, time, calories, protein, carbs, fat, fiberG, waterMl, portionMultiplier }`
- Additions: debounced upsert to Supabase (600ms delay)
- Deletions: immediate `DELETE` by entry ID on both web and mobile

## Related Documents
- [Journey: Meal Planning](meal-planning.md)
- [Product: Feature Map](../product/overview.md#food-tracking)

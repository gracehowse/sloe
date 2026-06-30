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

> **Phase 2 update (2026-04-27, B1.2 canonical Today):** the hero
> ring is the single canonical variant — the 3-variant picker (ring /
> bar / number) is locked to ring; the corner grid affordance and
> picker modal are suppressed via `<TodayHero hidePicker />`. The
> streak ribbon is now a 22pt `<StreakPip>` rendered above the date
> row. The TodayQuickLogStrip is no longer in the composition root;
> the persistent `<LogFab>` (canonical 56pt circle, `right: 18,
> bottom: 100`) is the sole logging-entry affordance going forward.
> Phase 3 wires the FAB to the unified `<LogSheet>` (B2.1) and lands
> the north-star "what to eat next" block (B2.2). See
> `docs/journeys/tab-collapse-2026-04-27.md` for the full Phase 2
> reasoning.

```
┌─────────────────────────────┐
│           [🔥 5 days]       │  ← StreakPip (right-aligned), day-view only
│  Day | Week  toggle         │
│  ‹  Today  ›  (date nav)   │
├─────────────────────────────┤
│  1,240 kcal left            │  ← hero ring (canonical; picker locked)
│  ███████░░░░ Food / Goal    │
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
│  [Scan]        [Previous]  │  ← action buttons (see <LogFab> below)
└─────────────────────────────┘

                              ●  ← persistent <LogFab> (Phase 2 / B1.2)
                                  56pt, right: 18, bottom: 100
                                  Mobile: opens TodayFabSheet (existing
                                  log paths). Mobile-web: surfaces a
                                  "Coming in Phase 3" placeholder.
                                  Desktop web: hidden (D-2026-04-27-11).
```

### Adding Food

**Quick Add** — manual entry form:
- Meal slot switcher (Breakfast/Lunch/Dinner/Snack tabs)
- Fields: food name, calories, protein, carbs, fat
- "Add to Today" button

**Search** — shared `<FoodSearch>` (web) / `FoodSearchModal` (mobile):
- Entry points on Today: the `Search` chip in the quick-log strip and the "Search foods" CTA inside the Add-meal dialog. Both open the same shared search modal. Opening from inside Add-meal closes the Add-meal dialog first (parity across platforms — the two dialogs never stack).
- Results merge: **Custom foods (user's own) → USDA → Open Food Facts**. Custom foods surface at the top with a "Custom" badge; USDA + OFF results render underneath, ranked by the shared relevance scorer.
- **Per-serving display** (TestFlight `APo0qS9vcFvmBJEJJ_-61YA` 2026-04-19 shipped the inference; build 11 `AKvgjnb` + `APGJJlg` 2026-04-19 shipped the badge + headline-kcal flip). Every row that exposes a natural portion (Edamam `servingSizes[]`, USDA Branded `servingSize` + `householdServingFullText`, USDA Survey `foodPortions[]`, parsable OFF `serving_size`) shows `{kcal} kcal · P/C/F` for the portion as the primary line, an accent-coloured uppercase **`per serving`** badge, and a subdued secondary line of the form `{label} ({grams} g) · {per100gKcal} kcal / 100 g`. The right-rail big kcal number is the per-serving value. Rows with no natural portion (generic USDA, Edamam rows that expose only `"Gram"`, OFF free-text like `"1 piece"`) fall back to a muted `per 100g` badge with the per-100g kcal on the right rail unchanged. Inference lives in `src/lib/nutrition/primaryServing.ts`; the per-row headline + badge decision is resolved by the shared `resolveFoodSearchHeadline` in `src/lib/nutrition/foodSearchHeadline.ts`, imported by both platforms so the badge text and arithmetic can't drift.
- Select food → portion picker → Use this (single-tap log when a custom food has a default saved serving). When a natural portion exists, the picker prepends it as the first chip and seeds it as the default selection (matches MFP / LoseIt behaviour).
- When the caller supplies macro targets and today's consumed totals, the portion picker shows a fit-this-in preview row ("after: N kcal / Ng / Ng / Ng left") that updates as the user adjusts the portion. This uses `projectRemaining()` from `src/lib/nutrition/remainingMacros.ts`. Present on both web (`FoodSearch.tsx`) and mobile (`FoodSearchModal.tsx`).
- **Portion-fit hint** (ENG-854, flag `portion_fit_hint_v1`, **default-OFF** — registered in `KNOWN_DEFAULT_OFF_FLAGS` on both platforms) — a body-neutral line below the "If you log this" grid in the `FoodSearchPanel` preview that answers the inverse question: *how much of this fits what's left today?* The math is `solvePortionToFit(targets, consumed, basis, naturalUnit, confidence)` in `src/lib/nutrition/remainingMacros.ts` (re-exported to mobile via `@suppr/nutrition-core/remainingMacros`): for each tracked macro it computes the closed-form cap `remaining / perUnit` (macros scale linearly with quantity, so no iterative search is needed) and takes the smallest — the **binding macro** is the one that floors first. The copy reads "A 220 g serving fits your remaining 540 kcal." when calories bind (the common case + the tie-break default), or "About N servings fits — limited by carbs." when a macro target is the tighter constraint. The quantity is **floored**, never rounded up, so logging the suggested portion can't tip the binding macro over. **Nutrition-trust rule:** when the food has no metric grounding (`chosenPortion.gramWeight === 0`, e.g. a FatSecret count serving) or a low confidence tier, the solver returns a *qualitative* result and the copy falls back to "This can fit — adjust the amount to match what's left." — it never invents a fake gram/serving number. Both panels call the shared `portionFitHintForPreview()` wrapper so the platforms can't drift. Flag-OFF (the default) renders zero change. Both web (`src/app/components/food-search/FoodSearchPanel.tsx`) and mobile (`apps/mobile/components/food-search/FoodSearchPanel.tsx`).
- Logged to the active meal slot with canonical `source`: `"Custom food"` / `"USDA FoodData Central"` / `"Open Food Facts"` in the journal row, and `food_logged.source: "custom_food"` (custom) or `"manual"` (USDA/OFF) in analytics — identical strings on both platforms (Post-ship #5 / C1a, 2026-04-18).

**Create custom food** (Batch 3.9) — entry point inside the food-search panel:
- Can't find your food? **Create a custom food from FoodSearch.** Type what you're looking for, and when the results don't match — or when you already know the item only exists in your kitchen — tap "+ Create custom food" at the bottom of the results (or "Can't find it? Create your own." in the zero-results state). Fill in Name + macros + saved servings, hit Save, and the panel drops you straight into the portion picker for the food you just created so logging is one more tap. The same flow works on web (`FoodSearch.tsx` → `CreateCustomFoodDialog`) and mobile (`FoodSearchModal.tsx` → `CreateCustomFoodSheet`).
- Always visible as a "+ Create custom food" row at the bottom of the results list; promoted when the query returns zero results (for "homemade X" / "nana's Y" cases where USDA and OFF have nothing).
- Opens `CreateCustomFoodDialog` (web) / `CreateCustomFoodSheet` (mobile) with the typed search query pre-filled as the Name.
- Form fields (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`, 2026-04-19 — expanded to match MyFitnessPal / LoseIt without becoming a seven-section wall):
  1. **Name** (required), **Brand** (optional).
  2. **Natural serving row** — `Serving size` label + grams + optional `servings per container` — prominent above the macro grid so users reason in "1 slice" rather than grams. Persisted as the first entry of `servings jsonb`; servings-per-container lives in its own `servings_per_container numeric` column. Validation: both serving fields empty or both set.
  3. **Macros per `base_grams`** (default 100 — MFP / USDA convention): kcal / protein / carbs / fat / optional fibre. A live **"Per-serving preview"** below the grid shows `{label} ({grams} g) ≈ {kcal} · P/C/F` computed from the per-100g projection, so users can sanity-check label arithmetic before saving.
  4. Collapsed **"Add detailed nutrition"** disclosure — **sugar** (g), **saturated fat** (g), **sodium** (mg), plus an optional **barcode** text input. Disclosure auto-opens on edit when the food already has any detailed field set. Barcode is validated to 8 / 12 / 13 / 14 digits (EAN-8 / UPC-A / EAN-13 / GTIN-14); malformed input surfaces a soft inline error `"Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank."` and disables Save. No camera scanner yet — text input only for this pass.
- Save button is disabled until: name non-empty, `baseGrams > 0`, serving label + grams are paired correctly, barcode valid.
- A custom food with a saved natural serving renders in search with the same per-portion primary line as Pret / OFF hits — e.g. `"Homemade granola · 120 kcal · 1 slice (30 g)"` — via `customFoodToPrimaryServing` (integrates with TestFlight `APo0qS9vcFvmBJEJJ_-61YA` fix A2). Foods without a natural serving fall back to the existing "per 100 g" row.
- Save persists to `public.user_custom_foods` via `createCustomFood`. Unique-violation on `(user_id, lower(name))` retries with " (2)", " (3)", … up to " (9)" appended so a quick rename is not required.
- After save, the custom food is searchable (`searchCustomFoods` runs `ilike` across name + brand) and surfaces at the top of search results with a "Custom" badge (accessibility label "Custom food").
- When the user picks a custom food, the portion sheet offers the standard grams path plus a segmented control of the food's saved servings. The default chip is the first saved serving so most custom foods log in one tap. Macros project onto per-100g via `customFoodToMacrosPer100g`, then scale linearly via the same `scaleMacros` path USDA / OFF use (never invented, never divide-by-zero). Entries write to `nutrition_entries` through the existing insert path.
- Edit / Delete — web: overflow menu on the custom-food row, delete goes through the themed `DestructiveConfirmDialog` (audit M7, 2026-04-18) — focus-trapped, screen-reader friendly. Mobile: long-press the row, then pick Edit or Delete from the action sheet (double-confirmed for delete). Edit opens the same dialog pre-filled.
- Analytics: `custom_food_created` with `{ hasBrand, servingCount }` on save, `custom_food_updated` on edit, `custom_food_deleted` on delete. Logging a custom food fires `custom_food_logged` with `{ servingLabel?, grams }` alongside the normal `food_logged` event.

**Scan** — mobile camera (`apps/mobile/app/(tabs)/barcode.tsx`) / web dialog (`TodayBarcodeDialog`):
- **Mobile** scans EAN/UPC barcodes through the live camera (corner-bracket reticle), looks the product up via Open Food Facts, and presents a result card with the product name, macro tiles (kcal / P / C / F), a 4-segment meal-slot picker (defaults to time-of-day), a serving stepper + label presets, and a clear primary "Log to {slot}" CTA. Web has no camera path — the user types the barcode into the dialog and taps "Look up", then reviews the same product on the "Review & log" step.
- **Result-card design parity (ENG-737, 2026-06-17).** Both platforms render the scanned product in the same design language as the food-search result row: a **Verified / Estimated confidence chip**, a prominent kcal headline (tabular-nums), and the coloured P/C/F macro treatment (protein = `--destructive`, carbs = `--macro-carbs`, fat = `--warning`; fibre when present). The web "Review & log" step previously showed a flat muted-text paragraph ("looks awful") — it is now a `barcode-result-card` matching mobile. Tokens only; no flat paragraph.
- **Confidence is honest, never a UI default.** The tier comes from the single shared `barcodeConfidenceTier` rule (`src/lib/nutrition/barcodeConfidence.ts`, re-exported to mobile via `@suppr/shared/nutrition/barcodeConfidence`). A raw Open Food Facts lookup carries no `verified` flag, so it reads **Estimated**; a row whose per-100g basis we had to reconstruct (`basisCorrected`) also reads Estimated even if it was once verified — we no longer trust the published panel (CLAUDE.md trust posture).
- **Trust + correction.** Both surfaces run the per-100g-vs-per-serving plausibility guard before writing (`checkScaledLogPlausibility`) and offer an inline "edit and update" correction path. Barcode portion memory ("You usually log N g — using that") and per-meal HealthKit writes (mobile) carry across scans.
- **Not-found.** A miss surfaces a soft empty state ("We don't have this product yet.") with a clear CTA hierarchy: add the product / scan the label / try another barcode, rather than a transient toast.

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

**Quick add** — tabbed panel (Usual meals / Recent / Frequent / Favourites):
- Opens from the `Previous` FAB action on mobile; rendered inline above the Meals section on web. Ship M1 (2026-04-18) reorders the tabs so the primary re-log surface shows first and renames "My meals" → "Usual meals" (user-facing terminology fix: the old name was confusingly similar to the Recent / Frequent history tabs).
- **Usual meals** (canonical re-log surface) — user-saved meals from `public.user_saved_meals`, newest-re-logged first. Each row shows name, item count, and bundle totals. Tap `+` to log every item to the active slot in one action. Overflow (web) / long-press (mobile) exposes Rename / Delete.
- **Recent** — the last 20 unique meals from journal history.
- **Frequent** — most-logged meals across journal history, ranked by count. Source: `computeFrequentMeals()` from `src/lib/nutrition/foodHistory.ts`.
- **Favourites** — meals the user has starred. Source of truth: `public.user_favorite_foods`. Empty state copy: "Star meals you log often for one-tap re-logging."
- Each single-food row shows title, kcal · P/C/F summary, an `Nx` occurrence badge, a star toggle, and a `+` button that logs to the active slot.
- Star toggles are optimistic and revert on Supabase error; a unique-violation on add is treated as success (existing row is returned).
- **Default tab rule (Ship M1):** resolved via the shared `resolveQuickAddDefaultTab(hasSavedMeals)` helper in `src/lib/nutrition/usualMealHint.ts` — lands on `"saved"` when the user has ≥1 saved meal, else `"recent"`. Both platforms consume the helper so first-impression behaviour cannot drift. A caller-forced `defaultTab` prop always wins.

### Save a usual meal (Ship M1 primary surface; Batch 2.6 infrastructure)
A **usual meal** (internally `SavedMeal`) is a user-named bundle of 2+ foods the user habitually logs together — e.g. "My usual breakfast" = oats + berries + protein powder + almond butter. It is **not** a recipe (no ingredients list, no instructions, no servings) and **not** a single favourite (favourites are one food; usual meals are a bundle). Meal templates (whole-day plans) are a separate future concept.

- **Slot-header `Log usual` pill (primary re-log entry point, Ship M1).** When the user has ≥1 saved meal with matching `defaultMealSlot`, each meal-slot header (`Breakfast / Lunch / Dinner / Snacks`) renders a `[↻ Log usual: {name}]` primary-coloured pill at the top-right. Tap logs the saved meal directly. 2+ matches open a small picker sheet with the top 3 by `last_logged_at`. Fires `usual_meal_log_tapped { slot, itemCount }` alongside the canonical `saved_meal_logged` event so the slot-header vs Quick-Add split is measurable.
- **Full-width "Save {Slot} as a meal" row (primary save entry point, Ship M1).** Below the last food item in a slot, a full-width primary-colour row renders when the slot has ≥2 items AND no saved meal exists yet for this slot. Tapping opens the save UI — the web dialog (`suppr/SaveMealDialog`) or the mobile bottom sheet (`SaveMealSheet`). Replaces the old 10px "Save combo" pill metadata chip (deleted); the new row has the same visual weight as other primary row actions.
- **First-run hint (Ship M1).** A one-off dismissible inline card renders inside a slot when the shared `shouldShowUsualMealHint` gate passes (same-day ≥2 items in slot OR cross-day ≥2 distinct matches in 7d). Copy: **"Make this your usual {slot}. One tap to re-log it tomorrow."** Two buttons — `Save as usual` (opens save dialog pre-seeded with today's slot items) and `Not now` (dismisses for that slot only). Dismiss is persisted under `suppr-usual-meal-hint-dismissed-v1` (localStorage on web, AsyncStorage on mobile) so the same slot's hint never renders twice. Analytics: `usual_meal_hint_shown` / `usual_meal_hint_accepted` / `usual_meal_hint_dismissed` — all with `{ slot }`.
- **Save form:** name input (required, trimmed, cap 80 chars) + optional default-slot chips/dropdown (Breakfast / Lunch / Dinner / Snacks) + reorderable item list (up / down arrows + remove). The active slot is preselected as the default slot, and the name is pre-filled with `My usual {slot}`. Dialog title: **"Save as a usual meal"**. Description: **"One tap re-logs all of these items next time."**
- **Persistence:** parent row lands in `public.user_saved_meals` (name, optional `default_meal_slot`, `log_count`, `last_logged_at`); child rows land in `public.user_saved_meal_items` (one per food, ordered by `position`). If the items insert fails the parent is deleted (no zombie meals).
- **Re-log:** the `Log usual` slot-header pill (Ship M1) and the Quick Add panel's "Usual meals" tab both expand the saved meal into individual journal entries via the shared `buildMealEntriesFromSavedMeal` helper and insert each through the same `addLoggedMealForDate` (web) / `setByDay` (mobile) path as any manual log. Each re-log gets fresh ids per row, so past logs and the saved meal stay independent. Saved meals with a `default_meal_slot` log into that slot; otherwise they log into the active slot.
- **Rename / Delete:** web uses a row overflow menu; mobile uses long-press + action sheet. Rename trims + persists via `renameSavedMeal`; delete cascades child items via FK `on delete cascade`.
- **Analytics:** `saved_meal_created` (with `itemCount`, `defaultMealSlot`), `saved_meal_logged` (`itemCount`, `slot`), `saved_meal_deleted`, plus the four Ship M1 events: `usual_meal_log_tapped`, `usual_meal_hint_shown`, `usual_meal_hint_accepted`, `usual_meal_hint_dismissed`. All fire on both platforms.
- **Growth-loop recap line (Ship M1).** The weekly `WeeklyRecapCard` on the Progress dashboard now surfaces one additional line when the data supports it. Celebration path: "You logged {name} {n} times this week." when the user has ≥1 saved meal re-logged in the window. Prompt path: "Got a usual {slot}? Save it once, log it in one tap." with a `Save {Slot} as a meal` CTA when the user has zero saved meals AND ≥5 distinct logged days. The decision lives in the pure `buildUsualMealRecapInsight` helper in `src/lib/nutrition/weeklyRecap.ts`, consumed by both the web and mobile recap cards.
- **Edge cases:** signed-out users see a "Sign in to save a usual meal for one-tap re-logging" empty state. An empty saved meal never appears in the list (parent-without-items rows are cleaned up on failed insert). Concurrent double-taps on a row are guarded by an optimistic pending-ids set so the user sees one log even if they tap twice.

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

### Deficit-window mode (changed in Settings)

The Today deficit/burn summary sums energy over a 7-day window. Two
modes (`src/lib/nutrition/weekSummaryWindow.ts`):

- `rolling` — the 7 days ending on the selected date (default).
- `calendar_week` — the current calendar week, respecting `week_start_day`.

The mode hydrates from `profiles.notification_prefs.weekSummaryMode`
(normalised via `normalizeWeekSummaryMode` — any unknown value falls
back to `rolling`) and drives the Today summary window on both
platforms. The Today summary line itself is **read-only** — it shows the
current mode ("7-day avg" vs "Week avg") but is not tappable.

**The control to change the mode lives in Settings → "Burn / deficit
summary"** (2026-05-26 — moved off the Today card per Grace; a Settings
preference, not a per-screen toggle). A segmented "Last 7 days" /
"Mon–Sun" control on both platforms:

- **Web** — `src/app/components/Settings.tsx` (`SettingsSegmented`,
  `ariaLabel="Burn / deficit summary window"`). Writes via the shared
  `NotificationPrefs` setter, which auto-persists `notification_prefs`
  to the DB through `NotificationContext`'s save effect.
- **Mobile** — `apps/mobile/components/settings/SettingsBundleContent.tsx`
  (`settings-bundle-deficit-window-row` opening a bottom-sheet picker,
  mirroring the "Week starts on" row). On select it read-merge-writes
  `profiles.notification_prefs.weekSummaryMode` so sibling prefs
  (`reminder_time`, `activity_bonus_calories`, …) are preserved.

Both Settings controls share `normalizeWeekSummaryMode` from
`src/lib/nutrition/weekSummaryWindow.ts` for hydration and use the same
"Last 7 days" / "Mon–Sun" wording so the surfaces stay in lockstep.

> **History:** a flagged (`deficit_window_toggle`) in-place tappable
> control briefly lived on the Today summary itself (2026-05-26). It was
> removed the same day in favour of the Settings control — Grace's call:
> "the toggle should be in settings not here". The flag and its env
> override (`EXPO_PUBLIC_FLAG_FORCE_DEFICIT_WINDOW_TOGGLE`) are gone; the
> shared helpers (`weekSummaryDateKeys`, `normalizeWeekSummaryMode`) stay.

## Hydration & Stimulants Card (Batch 2.5)

> **Phase 2 update (2026-04-27, B1.4):** caffeine + alcohol rows are
> now off by default and behind a Settings opt-in. See
> `docs/journeys/tab-collapse-2026-04-27.md` for the full rationale
> (D-2026-04-27-08). The toggle lives in Settings → "Tracking
> extras"; defaults to off on both platforms. When off, the
> corresponding row is hidden but `extra_caffeine_by_day` /
> `extra_alcohol_g_by_day` data is preserved untouched. Hydration
> stays on by default — it's a near-universal target.
>
> The shared opt-in lib is at `src/lib/nutrition/trackingExtras.ts`;
> `TRACKING_EXTRAS_STORAGE_KEY = "suppr.tracking-extras.v1"` is
> AsyncStorage on mobile, localStorage on web (no DB schema change).
> The NutritionTracker host force-zeros `targets.caffeineMg` /
> `targets.alcoholGWeekly` to 0 when the corresponding toggle is
> off, which leverages the existing card-level row-hide rule
> documented below.

- Component: `src/app/components/suppr/hydration-stimulants-card.tsx` (web), `apps/mobile/components/HydrationStimulantsCard.tsx` (mobile).
- Shared pure helper: `src/lib/nutrition/hydrationStimulants.ts` — presets, `weeklyAlcoholG`, `sumWaterFromMeals`, `isOverTarget`, `parseDayNumberMap`, `formatWaterAmount`, `imperialWaterQuickAdds`.
- **Water target**: `profiles.target_water_ml` (existing). Storage is always millilitres on both platforms.
- **Measurement system (audit C3, 2026-04-18):** the water row, the "from logged food" sub-line, and the quick-add chips respect `profiles.measurement_system` on both platforms. Imperial renders in `fl oz` (chips at 4 / 8 / 16 / 20 fl oz — each stored as integer millilitres); metric renders integer ml up to 1 L, then one-decimal L. Caffeine stays in mg and alcohol in grams on both systems. Flipping measurement system on Settings and returning to Today re-renders the same logged water in the new unit — nothing is re-encoded.
- **Caffeine target**: `profiles.target_caffeine_mg`, default 400 mg (FDA upper bound for healthy adults). Set to `0` to hide the caffeine row entirely (post-TestFlight build 7 feedback, 2026-04-18 — parity with alcohol).
- **Alcohol target**: `profiles.target_alcohol_g_weekly`, default 0 (row hidden). Users set it in Settings; 196 g ≈ 14 UK units.
- **Card position (2026-04-18, post-TestFlight build 7):** the card sits at the bottom of Today on both platforms — after the Activity Bonus card, before the Complete Day button. Primary water quick-add still lives in the macro tile row at the top of Today; this card is the secondary detail surface plus the caffeine/alcohol quick-add.
- **Persistence**: `extra_water_by_day`, `extra_caffeine_by_day`, `extra_alcohol_g_by_day` on `profiles`. Each is a `{YYYY-MM-DD: number}` map. Writes are debounced to 300ms on web and awaited per-tap on mobile (matches the pre-existing water pattern).
- **Auto-tracking from food logs (F-13, 2026-04-19)**: every successful `nutrition_entries` insert whose food source publishes caffeine or alcohol per 100 g (USDA `262`/`221`, Edamam `CAFFN`/`ALC`, OFF `caffeine_100g`/`alcohol_100g`) scales the nutrient for the logged portion via the shared `scaleCaffeineAlcohol` helper and bumps `extra_caffeine_by_day[dateKey]` / `extra_alcohol_g_by_day[dateKey]` via `updateStimulantsForDay`. Delete decrements the same delta. The scaled values also land on the meal's `nutrition_micros.caffeineMg` / `alcoholG` so historical context survives without a schema change. Null per-100 g → 0 (never invent a fallback; project rule). Quick-add chips on the card remain the manual fallback for custom foods / recipes / meal plans (their schemas don't carry aggregated caffeine/alcohol yet).
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

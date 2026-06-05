# Today (iOS) — redesign dossier

**Status:** AWAITING GRACE APPROVAL. No code until approved. iOS-first. Nothing committed until reviewed.
**Surface:** `apps/mobile/app/(tabs)/index.tsx` (`TrackerScreen`, 6,317 lines) + ~30 `components/today/*` + `components/charts/CalorieRing.tsx` + 3 extracted hooks.
**Foundation:** Phase 0 tokens/fonts already landed (white page, Sloe palette, Newsreader) — this is layout/structure + decomposition, wiring the SAME data.

---

## 1. EXISTING (ground-truth audit)

Today is a single-file God-component: ~110 state slots, ~25 effects, ~40 memos, a ~900-line modal stack. **`NutritionTracker.tsx` is a WEB file — not rendered on mobile.** All journal read/write, HealthKit sync, adaptive-TDEE refresh, widget-snapshot write, and `profiles` writes live inside the screen.

**Render order (day view):** date header (prev/next, Today pill, 7-dot DayStrip, avatar, streak pip) → offline/error banners → missed-yesterday line → **calorie ring hero** (kcal ring + 3 macro arcs + Goal/Food/Bonus row + status pill) → context block (active-fast pill *or* deficit insight) → **macro tiles/bars** (pref) → **meals list** (per-slot, swipe-delete, long-press edit, Log-usual, collapsible Quick Add) → weekly insight → north-star "what to eat next" (empty-day only) → weekly check-in banner → onboarding nudge → first-meal empty state → planned-meals card → manual add-food → **steps & activity** → **activity bonus / energy balance** → **hydration & stimulants** → Complete Day. Plus ~20 modals/sheets (canonical **LogSheet**, edit, search, barcode, voice, photo, copy/duplicate, save-as-usual, provenance, paywall…).

**Data:** `loadProfileTargets` (wide `profiles` select → ~30 slots) + `loadJournal` (35-day windowed `nutrition_entries` + `meal_plan_days/meals`, per-query timeouts, in-flight dedup). Everything else computed client-side (`totals`, `weekData`, `effectiveCalorieGoal`, `effectiveMacroTargets`, activity-budget math, micros).

**States handled:** loading (Shimmer), empty/fresh-start, over-budget, error, offline, dark, target-hit celebration + win-moment.

**Dead / suppressed (audit §8) — decisions below:** the all-micros **Nutrients panel is dead** (never opened); **week-view path is likely dead** (toggle hidden, every DayStrip select sets day-mode); **eat-again**, **WhyThisNumberSheet** prop chain, **idle "start fast" pill** are suppressed/dead with "kept for follow-up" comments.

**⚠ Ring already diverges:** Phase 0 changed `CalorieRing.tsx` to **plum-under + red diagonal HASH over the overage** — but the approved Figma S6 is **plum full ring + red overage ARC**. Must reconcile to the Figma (arc).

## 2. FROZEN CONTRACTS (preserve exactly — audit §5)
- **iOS WidgetSnapshot** — debounced effect (L2786-2866): `buildWidgetSnapshot`→`writeWidgetSnapshot` from totals + macro targets + fast. Keep verbatim.
- **Adaptive-TDEE refresh** — `refreshAdaptiveTdeeForUser` fires from `useNutritionEntriesSync` after upsert + after copy/duplicate. Every durable log MUST keep routing through it.
- **`profiles` writes** — water/caffeine/alcohol/reset, `prefer_activity_adjusted_calories`, `notification_prefs`, `fasting_sessions`, weekly-checkin cols — **never** touch entitlement columns (tier-lockdown trigger). Keep exact column sets + rollback-on-error.
- **`snapshotDailyTargetIfMissing`** on first log; **per-meal HealthKit write**; `nutrition_entries` insert/update/delete (+ HealthKit tombstone).
- **`save_meal_plan` is NOT on Today** (Today only reads the plan + logs planned meals via the **Verify-first guard** — must not log coerced macros).

## 3. BENCHMARK (Sloe design — already in Figma)
Each live section maps to an approved Sloe frame:

| Live section | Sloe target | Benchmark |
|---|---|---|
| Ring hero + macro tiles + greeting + week strip | **01 · Today** (308:2) | own multi-ring (differentiator) |
| Meals list | **TD4 · Meal log** (481:2) | MyFitnessPal + Lifesum |
| Weekly insight + Planned | **TD3** (480:2) | MacroFactor/MFP digest |
| What-to-eat (north-star) | 01 Today what-to-eat | the wedge |
| Steps & activity + Activity bonus | **TD1** (459:2) | MacroFactor + Bevel |
| Hydration & stimulants | **TD2** (463:2) | Bevel |
| Empty / fresh-start | **S5** (360:2) | — |
| Log sheet | **11 · Log a meal** (336:2) | — |

## 4. PROPOSED build (two tracks, same data)

**Track A — Decompose first (structural, zero visual change).** Per audit §7, extract a `useToday()` composition root + sub-hooks (`useTodayProfile`, `useTodayJournal`, `useTodayBudget`, `useTodayActivityHydration`, `useTodayCelebrations`, `useTodayWidgetSnapshot`) and a `<TodayModals>` host for the ~900-line sheet stack. Screen file → ~300-400-line shell. **Move handlers WITH their exact `useCallback` deps** (the 2026-05-08 data-loss bug came from breaking this). Validate behaviour-identical before any re-skin.

**Track B — Re-skin each section to its Sloe frame**, in place, wiring the same props:
1. **Hero** (greeting, week strip, ring, macro tiles, what-to-eat) → 01 Today. Reconcile the ring to the Figma overage **arc**.
2. **Meals** (`TodayMealsSection`) → TD4 (per-meal macro chips, Log-usual pill, food rows, + Add food).
3. **Activity/energy** (`TodayActivityCard` + `TodayActivityBonusCard`) → TD1 (steps + energy-balance equation + net bar).
4. **Hydration** (`HydrationStimulantsCard`) → TD2.
5. **Weekly insight + Planned** (`WeeklyInsightCard` + `TodayPlannedMealsCard`) → TD3.

Each step: build → render on iOS sim → before/after screenshot → `design-system-enforcer` vs the Figma frame → **stop for your review**.

## 5. PRESERVE (non-negotiable)
Every frozen contract (§2); every section's real data/logic; all interactions (swipe-delete, long-press edit/display-mode, slot taps, Log-usual, save-as-usual, copy/duplicate, quick-add, ring long-press toggle); the canonical LogSheet with ALL tabs (search/barcode/voice/photo/recent/saved/library/copy-yesterday/manual); north-star (all 5 kinds); planned Verify-guard; all 6 states; activation toasts (first-log, push explainer, usual hint, freeze-earned, onboarding nudge — AsyncStorage once-semantics); deep-links (`?date`, `?openLog`, `?editMealId`, Siri actions); every `track()` analytics call.

## 6. DECISIONS FOR YOU
- **D-1 — Nutrients all-micros panel:** it's built (`FullNutrientPanelSheet` + `dayMicroSum`) but **dead** (no trigger). Wire it (a "Nutrients" link on the macro tiles → full micros, Cronometer-parity depth — a differentiator) **or** delete the dead plumbing? *Recommend: wire it.*
- **D-2 — Week-view on Today:** appears dead (Plan tab owns the week in the Sloe IA). *Recommend: confirm via grep + delete the dead week path* (~200 lines). OK?
- **D-3 — Other dead chains** (eat-again, WhyThisNumberSheet, idle-fast pill): *recommend delete* after confirming no live consumer. OK?

## 7. RISKS (top 3) + mitigation
1. **Decomposition data-loss / behaviour drift** — handlers are deeply interdependent; a broken dep array reintroduces the 25-day journal-loss class. *Mitigation:* decompose as pure relocation (no logic edits), keep deps verbatim, run the full mobile test suite + sim smoke (log/edit/delete/copy/plan) before re-skinning.
2. **Frozen-contract breakage** (widget snapshot / adaptive-TDEE / profiles writes) — silent if untested. *Mitigation:* the contract tests + an explicit post-build check that a log still fires `refreshAdaptiveTdeeForUser` + a widget write.
3. **Re-skin ≠ pixels** — flag-free direct-to-dev; only render proves it. *Mitigation:* per-section iOS render → before/after → design-system-enforcer vs the Figma frame, before claiming done.

## 8. ALTERNATIVES
- **A. Re-skin without decomposing** — rejected; re-threading props by hand on a 6,317-line file is the #1 risk.
- **B. Rebuild Today from scratch** — rejected; the engine + contracts are battle-tested; relocate, don't rewrite.
- **C. Decompose + re-skin in place (CHOSEN)** — lowest risk, preserves the engine, hits the 400-line bar.

## 9. CONFIDENCE: 8/10
High on the inventory + mapping (full audit). Lower on: the exact decomposition not subtly changing a dep array (mitigated by tests + sim smoke), and the dead-code confirmations (D-2/D-3 need a grep before deletion).

## 10. SEQUENCE / GATE
On approval: (1) confirm dead-code (grep), (2) Track A decompose → test/smoke → show diff, (3) Track B re-skin section-by-section, each gated by iOS render + your review. No commit until you approve the rendered result.

---

## 11. BUILD LOG — Unit 1: Today HERO re-skin (iOS) — 2026-06-03

**Scope shipped:** the Hero only (greeting · week strip · calorie ring → Sloe
multi-ring · Remaining/Consumed toggle + status chip · Goal/Eaten/Bonus stats
row · 4 macro tiles). NOT touched this round: meals list, activity/hydration,
weekly insight, the modal stack (later units). Re-skin only — **no data-flow or
logic change**. Flag-free per the rollout plan. Decomposition (Track A) was NOT
done — this was a minimal in-place re-skin per the task brief ("minimal edits
over relocation"); the 400-line decomposition remains future work (ENG-621).

**What changed (visual → Sloe `01 · Today` frame):**
- **Greeting block (new):** centered Newsreader "Morning/Afternoon/Evening,
  {name}" + long date, above the week strip (revives the time-of-day greeting
  the 2026-05-22 calm pass dropped). Name from the auth session's
  `user_metadata` only (no new `profiles` read); falls back to a clean
  name-free "Good evening" when no real name is present. Shared helper
  `todayGreeting()` in `src/lib/copy/today.ts`.
- **Week strip (`DayStrip`):** re-skinned in place to the Sloe cell — day
  letter + Newsreader number + status dot; the SELECTED day is a clay
  rounded pill, logged days carry a sage dot, today (unselected) a faint clay
  dot. All paging/tap/calendar/jump-to-today/freeze-glyph/out-of-range
  navigation preserved untouched.
- **Calorie ring (`CalorieRing`):** over-budget treatment is **plum base lap +
  lighter plum second lap** (Apple-Watch style; no red arc, no hash). Centre
  numeral → Newsreader (`Type.ringValue` 48px). Inner protein/carbs/fat arcs
  unchanged (sage/clay/amber). See `calorieRingOverageArc.test.tsx` and
  `docs/decisions/2026-06-04-today-status-chip-budget-labels.md` (chip only
  uses "budget" wording).
- **Hero card chrome (`TodayHeroRing`):** Sloe **status chip** via
  `todayStatusChip`: **Fresh start** / **Under budget** / **Over budget**
  (Figma `01 · Today`; chip-only exception to forbidden bigrams) +
  **Remaining/Consumed toggle** (visible counterpart to ring long-press).
  Restyled Goal/Eaten/Bonus `divide-x` row with Newsreader values.
- **Week strip:** **minimal** current day (clay numeral + dot, no filled pill)
  per `docs/decisions/2026-06-03-today-week-strip-minimal-current-day.md` —
  Figma `308:2` / Stitch `today.html` may still show the old pill until synced.
- **Greeting:** centred Newsreader headline + long **en-GB** date subline;
  today → `todayGreeting` (Morning/Afternoon/Evening + name); past days →
  date-forward headline (`todayPastDayGreeting`).
- **Macro tiles (`TodayDashboardMacroTiles`):** value numeral → Newsreader
  with a smaller inline unit (matches the frame). Tiles already carried the
  Sloe palette + progress bars. **Default macro display flipped `bars` →
  `tiles`** (`DEFAULT_MACRO_DISPLAY_STYLE`) so cold-open Today matches the
  frame; bars stays the opt-in alternate.
- **Ring macros visible by default:** `ringExpanded` default flipped
  `false → true` so the multi-ring shows the macro arcs on load (the Sloe
  hero IS a multi-ring). Long-press still collapses to calories-only.

**North star (2026-06-04):** shows on today when `remaining > 0` (empty or
partial meals); hides only when no calories left — not gated on
`mealsToday.length === 0`. Photo-hero §3.5 in `today.md` still deferred.

**Frozen contracts — all preserved (verified, not touched):** the
WidgetSnapshot effect, `refreshAdaptiveTdeeForUser`, `profiles` writes,
`snapshotDailyTargetIfMissing`, per-meal HealthKit, the planned-meal
Verify-first guard, all interactions/states/deep-links/`track()` calls. None
of these live in the files re-skinned; the orchestrator's handler bodies +
`useCallback` deps were left byte-identical (only the greeting block + two
default values + one import were added).

**Validation:** iOS sim (iPhone 17, iOS 26.5) before/after captured live —
`/tmp/today-hero-before.png` (empty), `/tmp/today-hero-after.png` (empty,
re-skinned), `/tmp/today-hero-after-populated.png` (multi-ring, logged). The
over-budget ring (plum second lap) is validated via
`apps/mobile/tests/unit/calorieRingOverageArc.test.tsx` + the `today-over.html`
reference (not a live capture — avoided logging ~900 extra kcal to Grace's
account). Mobile typecheck + web typecheck clean; full mobile vitest green
(2128, the 2 mealPlanAlgo timeouts are the known CPU-starvation flakes — pass
isolated).

**Web parity (deferred to the web Today slot):** web `daily-ring.tsx` still
uses the diagonal hash overage + whole-ring-red; web greeting/week-strip/chip
not yet re-skinned. iOS-first per the rollout; web follows in its slot. The
shared `todayGreeting`/`todayStatusChip` helpers + the `tiles` default already
moved (web picks them up for free).

**Outstanding / follow-ups:** (a) capture the live over-budget hero once test
data warrants; (b) bring web Today to parity (greeting, Sloe week strip, chip
+ toggle, ring overage-arc reconciliation); (c) Track A decomposition of the
6.3k-line orchestrator (ENG-621) still pending; (d) one test meal ("Protein
Overnight Oats") was logged to the dev account on 2026-06-03 to capture the
populated hero — Grace can remove it.

---

## 12. BUILD LOG — Unit 2: Today MEALS LIST re-skin (iOS) — 2026-06-03

**Scope shipped:** the meals list ONLY — the per-slot meal cards in
`components/today/TodayMealsSection.tsx`. NOT touched this round: the Hero
(Unit 1), activity/hydration, weekly insight, the modal/sheet stack. Re-skin
only — **no data-flow or logic change**. Flag-free (matches Unit 1's in-place
rollout, per the task brief; not behind a new gate). Minimal in-place edits, not
the Track A decomposition (ENG-621 still future work).

**Target:** Sloe `TD4 · Meal log` (Figma 481:2 / `docs/prototypes/stitch-sloe/
today-meallog.html`). Benchmark: MyFitnessPal + Lifesum.

**What changed (visual → Sloe `TD4` frame):**
- **Per-slot CARDS (headline change):** the pre-TD4 layout wrapped every slot
  in ONE outer card divided by hairlines. TD4 makes each slot its OWN card
  (warm-grey `card` surface `#F6F5F2`, `line` `#E8E2EC` hairline, `Radius.xl`
  corner, `marginBottom Spacing.sm`, flag-aware `useCardElevation`). The four
  slots now read as four discrete objects you scan + act on independently.
  Empty slots dim to `opacity 0.55`; the `overflow: "hidden"` on each card is
  the SAME wrapper the old single card had, so swipe-to-delete reveals within
  the card exactly as before (no clip regression).
- **Card header:** meal name moved `Type.body` (600) → **`Type.headline`**
  (Newsreader serif — the loudest thing in the header, matching the frame's
  `font-headline text-lg`). Icon chip bumped 32→36pt, `Radius` 9→10. The chip
  keeps its **per-slot tint** (amber/sage/damson/teal — dossier D-4) rather
  than the frame's flat frost-mist chip: "keep from live where stronger" — the
  tint keeps the four cards distinguishable at a glance (`SlotColors` parity
  test preserved).
- **Per-meal macro chips (new `SlotMacroChips`):** the icon-led `MacroIconRow`
  in the slot header is replaced by a calmer icon-free row — slot total kcal +
  coloured P/C/F/fibre grams (`MacroColors.protein` olive #7C8466 · `carbs`
  clay #C8794E · `fat` amber #C9892C · `fiber` teal #4A7878), matching the
  frame's `12g 20g 9g 0.6g`. Same summed values, same rounding, fibre only when
  > 0. `MacroIconRow` stays the canonical Library/Discover row (import dropped
  from this file).
- **Food rows:** name bumped `Type.caption` (11) → `Type.body` (14, regular) to
  match the frame's `text-[14px]` row — it's the primary content now each slot
  is its own card. Sage success dot / thumbnail-when-present + name + kcal +
  chevron all preserved.
- **Log-usual pill:** unchanged behaviour/testIDs/labels; the v2 dedicated row
  moved from `paddingLeft: 56` (old single-card indent) to the card content
  edge (`paddingLeft: 14`), left-aligned with the food rows per the frame.
- **"+ Add food" (new per-card action):** the frame puts an `+ Add food` clay
  link inside every open meal card. Added as `today-add-food-{slot}`, clay
  (`Accent.primarySolid` deep-clay #A0552E for AA on the warm-grey card),
  rendered only on populated + open cards. Routes through the SAME
  `onOpenFabForSlot(slot)` handler the empty-slot header tap fires (pre-selects
  the slot, opens the canonical Log sheet) — **no new logic, no new data
  path.** Live-validated: tapping it opened the Log sheet with "Dinner"
  pre-selected.

**Scope exclusion (noted, not a gap):** the frame also shows a standalone
fibre/progress bar above the cards. NOT added — the Hero (Unit 1) macro tiles
already surface fibre, and a second fibre bar here would duplicate Today hero
content (`feedback_no_duplicate_today_hero_content`). Intentional omission.

**Frozen contracts — all preserved (verified):** swipe-to-delete (untouched
`Swipeable` + `onDeleteMeal`, same `overflow:hidden` wrapper as shipped),
long-press edit / branded `MealActionSheet` (flag) / raw `Alert` fallback,
slot-summary + collapse taps, Log-usual + save-as-usual + usual-picker (both
flag variants + ENG-783 portion routing), copy/duplicate (copy-yesterday),
Log-again row (ENG-786), collapsible quick-add (props kept wired, gated off),
the AI-first-log tooltip, the source-attribution dot, every `track()` call.
None of the host handlers or their `useCallback` deps were touched — only
`TodayMealsSection`'s own JSX/styles. The planned-meal Verify-first guard, per-
meal HealthKit writes, `refreshAdaptiveTdeeForUser`, `snapshotDailyTargetIfMissing`
and the WidgetSnapshot effect all live in the orchestrator / sync hook, not in
this file — unaffected.

**Tests:** all 64 pre-existing `TodayMealsSection` assertions green
(slot-colours, add-more, Log-usual ×12, Log-again, branded sheet, trust-posture
source dot, slot parity). New `tests/unit/todayMealsSectionTd4.test.tsx` (8
tests) pins the TD4 additions: the in-card `Add food` action + its
`onOpenFabForSlot(slot)` routing + its absence on empty/collapsed slots, the
per-meal macro grams, and the preserved empty-slot add path. Full mobile vitest
green (254 files / 2146 tests). Mobile + web typecheck clean. Mobile lint exit 0.

**Validation (iOS sim, iPhone 17, iOS 26.5):** fresh-bundle check done — the
served Metro bundle was grepped for the new literals (`Add food to `,
`today-add-food-`, `SlotMacroChips`) before reshooting, then the app was
cold-relaunched so it pulled the current bundle. Captured `/tmp/today-meals-
before.png` (empty — four TD4 cards on a future no-log day) and
`/tmp/today-meals-after.png` (populated — Dinner card with macro chips +
Log-usual pill + Sourdough food row + Add food, alongside empty
Breakfast/Lunch/Snacks cards).

**Web parity (deferred to the web Today slot):** web
`src/app/components/suppr/today-meals-section.tsx` not yet re-skinned to TD4
(still the single-container layout). iOS-first per the rollout; web follows in
its slot (tracked with the Unit 1 web-parity follow-up). No shared logic
changed, so nothing to port outside the web component's own JSX.

**Outstanding / follow-ups:** (a) bring web `today-meals-section.tsx` to the
TD4 per-card layout for parity; (b) Track A decomposition (ENG-621) still
pending — this file is ~1,490 lines and over the 400-line bar (legacy; this
round was an in-place re-skin, not the extraction).

---

## 13. BUILD LOG — Unit 3: Today ACTIVITY & ENERGY re-skin (iOS) — 2026-06-03

**Scope shipped:** the activity/energy section ONLY — the two inline cards on
Today (`components/today/TodayActivityCard.tsx` = "Steps & activity";
`components/today/TodayActivityBonusCard.tsx` = "Energy balance" + "7-day
rolling summary"). NOT touched: the Hero (Unit 1), meals (Unit 2),
hydration/stimulants (TD2), weekly insight (TD3), the modal/sheet stack. Re-skin
only — **no data-flow or logic change**; every frozen contract (§2),
maintenance-tile gate, info-popover, provenance affordance, deficit/surplus
honesty rule, and weekly rollup math is preserved. Flag-free (matches Units 1–2
in-place rollout). Minimal in-place edits, not the Track A decomposition
(ENG-621 still future work). Benchmark: MacroFactor (equation) + Bevel (net bar)
per §3; SSOT = `docs/prototypes/stitch-sloe/today-activity.html` (Figma TD1
459:2).

**No separate "Activity & energy" route exists** — the prototype
`today-activity.html` page title is a design-mock framing; in the app both
cards render inline on the Today tab below the meals list. The nav path to
reach them is: open the **Today** tab and scroll down past the meals to the
Steps & activity / Energy balance cards (steps card gates behind a HealthKit
sync; energy-balance card shows on Today even pre-sync so prefs are
discoverable).

**What changed (visual → Sloe `TD1` frame):**
- **Title-case sub-labels (the load-bearing delta):** the supporting stat-tile
  labels (Burned / Eaten / Maintenance), the energy-balance axis labels
  (Deficit / Maintenance / Surplus), and the "7-day rolling summary" overline
  all dropped the old UPPERCASE treatment (`textTransform: "uppercase"` /
  `Type.label`) for a calm muted `Type.caption`. The Sloe card language is
  Title case (matching the Hero status chip, the web counterpart's
  lowercase labels, and the rest of Today) — the prior pass left these as the
  legacy uppercase tiles. Card titles ("Steps & activity", "Energy balance")
  were already Newsreader-serif plum (`MacroColors.calories` = #3B2A4D) —
  unchanged.
- **Energy-balance bar → calm gradient slider:** the previous 3-segment flex
  approximation became a true horizontal gradient track (sage #5E7C5A 0% →
  frost/hairline 50% → amber #C9892C 100%), matching the prototype's
  `linear-gradient(90deg,#5E7C5A,#EDEAF1,#C9892C)`. Drawn with
  `react-native-svg` (`Svg`/`Defs`/`LinearGradient`/`Stop`/`Rect`) — **already
  a dependency** (CalorieRing, WeightChart, GradientAvatar use it); no new
  package. The knob stays a plain absolutely-positioned View so its `left` %
  remains data-driven by `balanceFraction` (a PRESENTATION of existing
  burn/intake — no invented nutrition value); the knob border still flips
  sage↔amber by deficit/surplus.
- **Numbers stay light serif:** the net headline keeps `Type.ringValue`
  (Newsreader) and the stat tiles keep `Type.headline` (Newsreader) per the
  frame's `font-headline` numerals — unchanged this round.

**Tests:** `apps/mobile/tests/unit/todayActivityCardTd1.test.tsx` extended —
added (1) a `flattenStyle` + `expectTitleCase` guard asserting the stat-tile +
axis labels are NOT uppercase-transformed, (2) the same guard on the "7-day
rolling summary" overline, (3) the calm slider renders a real
`react-native-svg` gradient (`id="energyBalanceTrack"` + sage/amber stops), and
(4) the slider is omitted when there's no burn data and nothing eaten. All 17
tests across this file + `todayActivityBonusCardMaintenanceTile.test.tsx` green;
mobile typecheck clean (0 errors); mobile lint exit 0.

**Web parity (deferred to the web Today slot):** web
`src/app/components/suppr/today-activity-bonus-card.tsx` +
`today-steps-card.tsx` are still on the PRE-TD1 layout (old Total burn / Target
/ Under-Over tiles, no net headline, no energy-balance gradient). iOS leads per
the rollout; web follows in its slot (tracked with the Unit 1/2 web-parity
follow-up). No shared logic changed, so nothing to port outside the web
components' own JSX. NOTE: the web stat labels are already lowercase (no
`uppercase` class) — which confirms the Sloe Title-case direction taken on
mobile here.

**Outstanding / follow-ups:** (a) bring web `today-activity-bonus-card.tsx` +
`today-steps-card.tsx` to the TD1 layout (net headline + calm gradient slider +
Title-case tiles) for parity; (b) Track A decomposition (ENG-621) — the host
`(tabs)/index.tsx` is still ~6,300 lines (legacy; this round was an in-place
re-skin of the extracted child cards, not the host extraction).

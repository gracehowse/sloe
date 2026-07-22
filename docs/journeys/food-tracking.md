# User Journey: Food Tracking

**Audience:** Product / Design

## Scope

**In scope:** the Today/diary screen end to end — day view, week view, every
logging entry point (search, scan, voice, photo, quick-add, custom food),
meal-slot management (collapse/expand, edit/delete/copy/duplicate),
hydration/stimulants tracking, activity bonus (including the Burn Detail
screen), adaptive TDEE + weekly check-in triggers, complete-day, and
first-run/progressive-disclosure behaviour.

**Out of scope (linked, not duplicated):**
- The `<LogSheet>` component's own internals (composition, wiring contract,
  LogHub row, state coverage, tests) → [`log-sheet.md`](./log-sheet.md).
- The North Star "what to eat next" scorer and its render variants, plus the
  full `/coach` destination screen →
  [`what-to-eat-next.md`](./what-to-eat-next.md).
- Weekly review depth (streak freezes, weekly recap card design, push
  notification) → [`progress.md`](./progress.md).
- Plan-tab meal generation and shopping list → [`meal-planning.md`](./meal-planning.md).
  `shopping-list.md` is **not** relevant to this doc at all — shopping is
  downstream of Plan, not Today.
- Shared confidence/plausibility policy for AI-assisted and barcode logging
  → [`nutrition-approximation-policy.md`](../product/nutrition-approximation-policy.md).

## Loops this doc belongs to

This is the canonical Today/diary doc — home of the **Daily Logging Loop**
and the **AI-Assisted Logging & Trust Loop**.

- **Daily Logging Loop (primary, owned here).** Open Today → tap the Log
  button → search / scan / voice / photo / quick-add inside the sheet →
  portion picker → commit → the macro spine (ring, macro tiles, meal
  slots) updates → repeat for the next meal or day. Every section below is
  a step in, or a branch off, this loop.
- **AI-Assisted Logging & Trust Loop (owned here).** The barcode / voice /
  photo entry points inside the Log sheet — every result routes through the
  shared `verifyIngredients` / plausibility pipeline before it can touch a
  logged entry; low-confidence results are always surfaced, never silently
  guessed. See "Scan", "Voice log", and "Photo log" below.
- **Forward links** — loops this doc feeds into, owned elsewhere:
  - **What to eat next (North Star / Coach)** → [`what-to-eat-next.md`](./what-to-eat-next.md).
    Rendered inline on Today, second thing the eye lands on after the
    ring — the differentiator moment. Also owns the staged over/under-budget
    coach line and the full `/coach` destination screen.
  - **The Log sheet itself** → [`log-sheet.md`](./log-sheet.md). This doc
    covers what leads into the sheet and what happens after it commits;
    log-sheet.md covers the sheet's own composition and wiring.
  - **Planned meals** → [`meal-planning.md`](./meal-planning.md).
    `TodayPlannedMealsCard` surfaces the active plan's meals on Today;
    logging one writes to `nutrition_entries` through the same path as a
    manual log.
  - **Weekly review** → [`progress.md`](./progress.md). A week of logging
    feeds the weekly check-in and the Progress dashboard — see "Weekly
    recap screen (mobile-only)" below for the current platform gap.
  - **Target math** — *why* the numbers this doc displays are what they are
    → [`how-your-calorie-target-works.md`](../user/how-your-calorie-target-works.md),
    linked again from "Hydration & Stimulants Card" below.
  - `shopping-list.md` is **not** relevant here — do not cross-link it.

## Overview
User logs food throughout the day, tracks progress against their calorie and macro targets, and reviews weekly trends.

**Next in this loop:** pick an entry point below, or jump straight to Day View for the canonical Today layout.

## Entry Points
- **Mobile:** Today tab (leftmost bottom tab, testID `tab-today`) — default landing screen after auth/onboarding.
- **Web:** `/today` (also `/`, `/home`, and any legacy `?view=` link — all redirect here); default landing after auth/onboarding.

**Next in this loop:** land on Day View, below.

## Day View

### First-run Today
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

**Next in this loop:** user taps the Log button (see "Log entry point" below) → "Adding Food" below.

### Layout

> **History:** A 2026-04-27 redesign locked the hero ring as the single
> canonical variant — the 3-variant picker (ring / bar / number) is retired.
> That same change introduced a persistent side `<LogFab>` (56pt circle,
> `right: 18, bottom: 100`) as the sole logging-entry affordance; **that FAB
> is itself now historical** — see "Log entry point" below for the current
> shape on both platforms. The `TodayQuickLogStrip` (a Search/Scan/Voice/Snap
> chip row that briefly lived above Meals) was **deleted outright**, not
> just hidden — those launchers now live inside the canonical `<LogSheet>`
> (see [log-sheet.md](./log-sheet.md)). The **Eat-again card** described in
> earlier revisions of this doc was retired on 2026-04-28 — see
> "Retired: Eat-again card" below.

```
┌─────────────────────────────┐
│           [🔥 5 days]       │  ← StreakPip (right-aligned), day-view only
│                              │     tap opens weekly-recap (mobile only, see below)
│  Day | Week  toggle         │
│  ‹  Today  ›  (date nav)   │
├─────────────────────────────┤
│  1,240 kcal left            │  ← hero ring (canonical; picker locked)
│  ███████░░░░ Food / Goal    │     over budget → AMBER arc + numeral, never
│                              │     red (red carve-out retired 2026-07-01)
├─────────────────────────────┤
│  PROTEIN  ███████░ 60g/93g  │
│  CARBS    █████░░░ 80g/124g │
│  FATS     ████░░░░ 30g/41g  │
├─────────────────────────────┤
│  KCAL   PROTEIN  CARBS  FAT │  ← RemainingMacrosBar
│  1,240  33g left 44g   11g  │    (+ FIBER column when fiber target set)
│  left   /93g     /124g /41g │    over-budget → "+N over" in AMBER, never red
├─────────────────────────────┤
│  What to eat next →         │  ← NorthStarBlockHost, see what-to-eat-next.md
│  [suggested recipe]         │
├─────────────────────────────┤
│  Breakfast  ▾  120 kcal     │  ← tap header to collapse/expand
│  ├─ Protein Oats  506 kcal  │  ← overflow / long-press to edit or remove
│  ├─ [↻ Log usual: {name}]   │  ← slot-header re-log pill, when a saved meal matches this slot
│  └─ [+ ADD FOOD]            │  ← opens the canonical LogSheet, seeded to Breakfast
│  Lunch ▾ / Dinner ▾ / Snack ▾  (same shape as Breakfast)
├─────────────────────────────┤
│  Planned meals (if a plan exists) │  ← TodayPlannedMealsCard, see meal-planning.md
├─────────────────────────────┤
│  Steps & Activity Bonus     │  ← optional; earns in once Health/steps sync;
│                              │     tap the burn row → Burn Detail screen,
│                              │     see "Activity Bonus card & Burn Detail
│                              │     screen" below
├─────────────────────────────┤
│  Hydration & Stimulants     │  ← see "Hydration & Stimulants Card" below
├─────────────────────────────┤
│  [Complete day]              │  ← see "Complete day" below
└─────────────────────────────┘

                          ⊕  ← centered raised Log button — see "Log entry
                              point" below. NOT a corner FAB, NOT a 5th tab.
```

**Next in this loop:** tap the Log button → "Log entry point" below → "Adding Food" below.

### Internal QA tooling: ring + NET-tile state harness (not a user-facing step)

> Not part of any user journey — included here because it's the visual
> reference for the hero ring and NET-tile states described in Layout
> above, and this is the doc a reviewer would reach for when checking they
> render correctly.

**Route:** `/dev/daily-ring-states` (`app/dev/daily-ring-states/page.tsx`).
Renders the standalone `<DailyRing>` and `<TodayHeroStats>` components with
fixed mock props — not live account data — in a grid of controlled states so
a reviewer (Playwright or Grace) can check each one by eye against its
expected behaviour, side by side, without needing a seeded account to hit
every edge case:

- **`<DailyRing>` (remaining mode), 4 states:** empty (0 consumed → "Start
  your day" copy, not a bare "1,832 REMAINING"), partial (800/1,832 →
  "1,032 REMAINING", comma-formatted), at-goal (1,832/1,832 → "0
  REMAINING"), over (2,338/1,832 → "506 OVER" — the true overage, never
  clamped to "0 OVER").
- **`<TodayHeroStats>` NET tile, 4 states:** empty (`loggedKcal: 0` → neutral
  grey), under target (food logged, under target → success green), at
  target (logged exactly equals target → neutral, since hitting target
  exactly is not a deficit), over target → warning amber. This NET-tile
  colour rule is distinct from the ring's own colour mapping (ring: empty =
  gradient, under = green, over = amber — see the "Calorie ring colour
  mapping" rule in `.claude/agents/_project-context.md`); the tile reasons
  about logged-vs-burned-vs-target, the ring reasons about consumed-vs-target.

**Origin:** built to validate a specific set of launch-readiness fixes — the
empty-state copy, thousands-separator formatting, over-budget-not-clamped-
to-zero, and NET-tile-colour behaviour described above — so those exact
regressions can be re-checked at a glance on every future ring/NET-tile
change.

**Access:** unlinked from any nav — reachable only by direct URL. It is
**not** gated by an in-component check; `middleware.ts`'s `isDevPreview()`
keeps every `/dev/*` route out of the public allowlist once
`VERCEL_ENV === "production"` (the live suppr.club/suppr.app deployment), so
in production it falls back to the same Supabase-session gate as any other
authenticated page — an unauthenticated visitor is redirected to `/login`,
same as hitting any other in-product URL cold. In local dev, CI's
`next start`, and Vercel preview deployments (no `VERCEL_ENV=production`) the
route is public with no auth required, which is what lets the paired
Playwright spec below run unauthenticated. Renders mock data only — no PII,
no live user state, no writes.

**Test coverage:** `tests/e2e/screenshots/bundle-1a-validation.spec.ts`
drives this route with Playwright, captures a full-page screenshot plus one
crop per state (`daily-ring-<state>.png`, `hero-net-<state>.png`), and writes
them to `docs/screenshots/launch-bugs/bundle-1a-after/`.

**Pattern:** this is the web half of the repo-wide "dev screen + Maestro/
Playwright screenshot" visual-validation pattern — full mechanics, the
mobile equivalent (`apps/mobile/app/dev/calorie-ring-states.tsx`), and *when*
to reach for it are documented in
[`docs/development/mobile-visual-validation.md`](../development/mobile-visual-validation.md).

### Log entry point (both platforms, since 2026-04-30)

The persistent side `<LogFab>` (56pt circle, `right: 18, bottom: 100`)
described in older revisions of this doc is retired. As of 2026-04-30, both
platforms replaced it with a **centered raised Plus button** injected into
the visual middle of the primary navigation — same intent, same position,
shipped in the same change so neither platform drifted ahead of the other:

- **Mobile:** `<SupprTabBar>` (`apps/mobile/components/tabs/SupprTabBar.tsx`)
  + `<LogTabBarButton>` (`apps/mobile/components/tabs/LogTabBarButton.tsx`)
  render the button between the 2nd and 3rd visible tabs. It is purely a UI
  element, not a 5th screen route — the 4-tab IA is unchanged. Tapping it
  navigates to `/(tabs)?openLog=1`; the Today screen consumes the `openLog`
  param via `useFocusEffect`, opens the canonical `<LogSheet>`, then clears
  the param so back-navigation doesn't re-open it.
- **Web, mobile-web only (`md:hidden`):** the bottom `<nav>` in
  `src/app/App.tsx` mirrors the same pattern — a centered raised button
  (`data-testid="mobile-web-tab-log-button"`, `aria-label="Log a meal"`)
  between the 2nd and 3rd visible tabs, calling `openLogSheetFromTabBar`.
  **Desktop web (≥1024px, `md:` breakpoint) has no Log button at all** —
  daily logging is treated as a phone activity; logging on desktop happens
  through the inline surfaces (Quick Add panel, meal-slot "Add food" rows,
  search CTAs) documented below.

Both buttons open the same component: the canonical `<LogSheet>`. See
[log-sheet.md](./log-sheet.md) for the sheet's own composition and wiring
contract.

**Next in this loop:** tap the button → "Adding Food" below.

### Retired: Eat-again card

Earlier revisions of this doc described a one-tap "Eat again" banner above
the meal slots — triggered by `computeEatAgainForSlot(byDay,
currentSlotFromTime, now)`, dismissible per day, persisted under
`suppr-eat-again-dismissed`. **It was retired on 2026-04-28**, in favour of
prioritising the fasting-window feature over the eat-again suggestion — see
`NutritionTracker.tsx`'s inline comment and
`docs/ux/teardown-2026-04-28-daily-loop.md` for the full reasoning.

The shared helpers it depended on — `computeEatAgainForSlot` /
`computeEatAgainCandidatesForSlot` (`src/lib/nutrition/foodHistory.ts`) and
`eatAgainDismiss` (`src/lib/nutrition/eatAgainDismiss.ts`, re-exported at
`src/lib/nutrition-core/eatAgainDismiss.ts`) — sat as dead code for months:
nothing called them from either host, but they stayed shipped and covered
by a live test (`tests/unit/eatAgainDismiss.test.ts`). Confirmed unused on
both platforms and deleted 2026-07-21 (ENG-1604), along with their test
and the barrel export.

**Next in this loop:** re-logging now happens via the slot-header "Log
usual" pill or the Quick Add panel — see "Save a usual meal" and "Adding
Food" below.

### Adding Food

**Quick Add** — manual entry form:
- Meal slot switcher (Breakfast/Lunch/Dinner/Snack tabs)
- Fields: food name, calories, protein, carbs, fat
- "Add to Today" button

**Search** — shared `<FoodSearch>` (web) / `FoodSearchModal` (mobile):
- Entry points on Today: the `Search` chip in the quick-log strip and the "Search foods" CTA inside the Add-meal dialog. Both open the same shared search modal. Opening from inside Add-meal closes the Add-meal dialog first (parity across platforms — the two dialogs never stack).
- Results merge: **Custom foods (user's own) → USDA → Open Food Facts**. Custom foods surface at the top with a "Custom" badge; USDA + OFF results render underneath, ranked by the shared relevance scorer.
- **Per-serving display** (shipped 2026-04-19). Every row that exposes a natural portion (Edamam `servingSizes[]`, USDA Branded `servingSize` + `householdServingFullText`, USDA Survey `foodPortions[]`, parsable OFF `serving_size`) shows `{kcal} kcal · P/C/F` for the portion as the primary line, an accent-coloured uppercase **`per serving`** badge, and a subdued secondary line of the form `{label} ({grams} g) · {per100gKcal} kcal / 100 g`. The right-rail big kcal number is the per-serving value. Rows with no natural portion (generic USDA, Edamam rows that expose only `"Gram"`, OFF free-text like `"1 piece"`) fall back to a muted `per 100g` badge with the per-100g kcal on the right rail unchanged. Inference lives in `src/lib/nutrition/primaryServing.ts`; the per-row headline + badge decision is resolved by the shared `resolveFoodSearchHeadline` in `src/lib/nutrition/foodSearchHeadline.ts`, imported by both platforms so the badge text and arithmetic can't drift.
- Select food → portion picker → Use this (single-tap log when a custom food has a default saved serving). When a natural portion exists, the picker prepends it as the first chip and seeds it as the default selection (matches MFP / LoseIt behaviour).
- When the caller supplies macro targets and today's consumed totals, the portion picker shows a fit-this-in preview row ("after: N kcal / Ng / Ng / Ng left") that updates as the user adjusts the portion. This uses `projectRemaining()` from `src/lib/nutrition/remainingMacros.ts`. Present on both web (`FoodSearch.tsx`) and mobile (`FoodSearchModal.tsx`).
- **Portion-fit hint** (flag `portion_fit_hint_v1`, **default-ON** since 2026-06-30 — registered in `REDESIGN_DEFAULT_ON` on both platforms) — a body-neutral line below the "If you log this" grid in the `FoodSearchPanel` preview that answers the inverse question: *how much of this fits what's left today?* The math is `solvePortionToFit(targets, consumed, basis, naturalUnit, confidence)` in `src/lib/nutrition/remainingMacros.ts` (re-exported to mobile via `@suppr/nutrition-core/remainingMacros`): for each tracked macro it computes the closed-form cap `remaining / perUnit` (macros scale linearly with quantity, so no iterative search is needed) and takes the smallest — the **binding macro** is the one that floors first. The copy reads "A 220 g serving fits your remaining 540 kcal." when calories bind (the common case + the tie-break default), or "About N servings fits — limited by carbs." when a macro target is the tighter constraint. The quantity is **floored**, never rounded up, so logging the suggested portion can't tip the binding macro over. **Nutrition-trust rule:** when the food has no metric grounding (`chosenPortion.gramWeight === 0`, e.g. a FatSecret count serving) or a low confidence tier, the solver returns a *qualitative* result and the copy falls back to "This can fit — adjust the amount to match what's left." — it never invents a fake gram/serving number. Both panels call the shared `portionFitHintForPreview()` wrapper so the platforms can't drift. On by default; removing the flag from `REDESIGN_DEFAULT_ON` (or a PostHog kill) hides the hint. Both web (`src/app/components/food-search/FoodSearchPanel.tsx`) and mobile (`apps/mobile/components/food-search/FoodSearchPanel.tsx`).
- Logged to the active meal slot with canonical `source`: `"Custom food"` / `"USDA FoodData Central"` / `"Open Food Facts"` in the journal row, and `food_logged.source: "custom_food"` (custom) or `"manual"` (USDA/OFF) in analytics — identical strings on both platforms (fixed 2026-04-18).

**Create custom food** — entry point inside the food-search panel:
- Can't find your food? **Create a custom food from FoodSearch.** Type what you're looking for, and when the results don't match — or when you already know the item only exists in your kitchen — tap "+ Create custom food" at the bottom of the results (or "Can't find it? Create your own." in the zero-results state). Fill in Name + macros + saved servings, hit Save, and the panel drops you straight into the portion picker for the food you just created so logging is one more tap. The same flow works on web (`FoodSearch.tsx` → `CreateCustomFoodDialog`) and mobile (`FoodSearchModal.tsx` → `CreateCustomFoodSheet`).
- Always visible as a "+ Create custom food" row at the bottom of the results list; promoted when the query returns zero results (for "homemade X" / "nana's Y" cases where USDA and OFF have nothing).
- Opens `CreateCustomFoodDialog` (web) / `CreateCustomFoodSheet` (mobile) with the typed search query pre-filled as the Name.
- Form fields (expanded 2026-04-19 to match MyFitnessPal / LoseIt without becoming a seven-section wall):
  1. **Name** (required), **Brand** (optional).
  2. **Natural serving row** — `Serving size` label + grams + optional `servings per container` — prominent above the macro grid so users reason in "1 slice" rather than grams. Persisted as the first entry of `servings jsonb`; servings-per-container lives in its own `servings_per_container numeric` column. Validation: both serving fields empty or both set.
  3. **Macros per `base_grams`** (default 100 — MFP / USDA convention): kcal / protein / carbs / fat / optional fibre. A live **"Per-serving preview"** below the grid shows `{label} ({grams} g) ≈ {kcal} · P/C/F` computed from the per-100g projection, so users can sanity-check label arithmetic before saving.
  4. Collapsed **"Add detailed nutrition"** disclosure — **sugar** (g), **saturated fat** (g), **sodium** (mg), plus an optional **barcode** text input. Disclosure auto-opens on edit when the food already has any detailed field set. Barcode is validated to 8 / 12 / 13 / 14 digits (EAN-8 / UPC-A / EAN-13 / GTIN-14); malformed input surfaces a soft inline error `"Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank."` and disables Save. No camera scanner yet — text input only.
- Save button is disabled until: name non-empty, `baseGrams > 0`, serving label + grams are paired correctly, barcode valid.
- A custom food with a saved natural serving renders in search with the same per-portion primary line as Pret / OFF hits — e.g. `"Homemade granola · 120 kcal · 1 slice (30 g)"` — via `customFoodToPrimaryServing`, matching the same per-serving display used elsewhere in search. Foods without a natural serving fall back to the existing "per 100 g" row.
- Save persists to `public.user_custom_foods` via `createCustomFood`, which now POSTs to the **server-enforced `POST /api/custom-foods`** route instead of writing directly to Supabase. The route runs the Atwater 4/4/9 `scaledMacrosPlausible()` gate before inserting; unique-violation on `(user_id, lower(name))` retries with " (2)", " (3)", … up to " (9)" appended (server-side now) so a quick rename is not required.
- **Plausibility gate:** an impossible macro set (e.g. 50 kcal with 40g P + 40g C + 40g F, implied ~700 kcal) previously saved silently — there was no client OR server check. The route returns **422 `implausible_macros`** for a failing set; the form (web dialog + mobile sheet) catches it, keeps open, and reveals an inline warning ("Macro values don't pass a basic sanity check. Please double-check the numbers.") plus a **"These numbers are correct — save anyway"** checkbox. Editing any macro clears the block; ticking the box resubmits with `acknowledgeImplausible: true`, which the server records on the row's `plausibility_overridden` column so an intentional override is distinguishable from an unguarded gap. Same behaviour + copy on both platforms (pinned by `createCustomFoodFormParity.test.ts`).
- After save, the custom food is searchable (`searchCustomFoods` runs `ilike` across name + brand) and surfaces at the top of search results with a "Custom" badge (accessibility label "Custom food").
- When the user picks a custom food, the portion sheet offers the standard grams path plus a segmented control of the food's saved servings. The default chip is the first saved serving so most custom foods log in one tap. Macros project onto per-100g via `customFoodToMacrosPer100g`, then scale linearly via the same `scaleMacros` path USDA / OFF use (never invented, never divide-by-zero). Entries write to `nutrition_entries` through the existing insert path.
- Edit / Delete — web: overflow menu on the custom-food row, delete goes through the themed `DestructiveConfirmDialog` (2026-04-18) — focus-trapped, screen-reader friendly. Mobile: long-press the row, then pick Edit or Delete from the action sheet (double-confirmed for delete). Edit opens the same dialog pre-filled.
- Analytics: `custom_food_created` with `{ hasBrand, servingCount }` on save, `custom_food_updated` on edit, `custom_food_deleted` on delete. Logging a custom food fires `custom_food_logged` with `{ servingLabel?, grams }` alongside the normal `food_logged` event.

**Scan** — mobile camera (`apps/mobile/app/(tabs)/barcode.tsx`) / web dialog (`TodayBarcodeDialog`):
- **Mobile** scans EAN/UPC barcodes through the live camera (corner-bracket reticle), looks the product up via Open Food Facts, and presents a result card with the product name, macro tiles (kcal / P / C / F), a 4-segment meal-slot picker (defaults to time-of-day), a serving stepper + label presets, and a clear primary "Log to {slot}" CTA. Web has no camera path — the user types the barcode into the dialog and taps "Look up", then reviews the same product on the "Review & log" step.
- **Result-card design parity (2026-06-17).** Both platforms render the scanned product in the same design language as the food-search result row: a **Verified / Estimated confidence chip**, a prominent kcal headline (tabular-nums), and the coloured P/C/F macro treatment (protein = `--destructive`, carbs = `--macro-carbs`, fat = `--warning`; fibre when present). The web "Review & log" step previously showed a flat muted-text paragraph ("looks awful") — it is now a `barcode-result-card` matching mobile. Tokens only; no flat paragraph. (Protein's `--destructive`/red token is a **macro-identity hue**, not an over-budget signal — unrelated to the amber-not-red rule below.)
- **Confidence is honest, never a UI default.** The tier comes from the single shared `barcodeConfidenceTier` rule (`src/lib/nutrition/barcodeConfidence.ts`, re-exported to mobile via `@suppr/shared/nutrition/barcodeConfidence`). A raw Open Food Facts lookup carries no `verified` flag, so it reads **Estimated**; a row whose per-100g basis we had to reconstruct (`basisCorrected`) also reads Estimated even if it was once verified — we no longer trust the published panel (CLAUDE.md trust posture).
- **Trust + correction.** Both surfaces run the per-100g-vs-per-serving plausibility guard before writing (`checkScaledLogPlausibility`) and offer an inline "edit and update" correction path. Barcode portion memory ("You usually log N g — using that") and per-meal HealthKit writes (mobile) carry across scans.
- **Not-found.** A miss surfaces a soft empty state — v3 copy behind the default-ON `eng1247_section_a_v1` flag ("New barcode" / "Add it once and it's saved for you — and everyone after you."), pre-flag copy "We don't have this product yet." — with a clear CTA hierarchy: **Add this product** (primary, save benefit) / **Snap the label instead** (secondary, AI photo fallback) / **Try another barcode** (tertiary dismiss), rather than a transient toast. "Add this product" continues into the save → contribution → confirmation sequence below.

#### Not-found → save → community contribution → saved confirmation

Tapping **Add this product** on a not-found barcode starts a 3-step sequence.
The steps exist on both platforms, but the first step's *effect* diverges
between them — described in full below.

1. **Save the product (private).**
   - **Web:** opens `CreateCustomFoodDialog` pre-filled with the scanned
     barcode (`initialBarcode`). The user fills in name/macros/servings and
     saves; this POSTs to `/api/custom-foods` (the same plausibility gate
     described above) and creates a row in `public.user_custom_foods` — a **reusable custom food**,
     not a diary entry. The next scan of the same barcode resolves it
     automatically.
   - **Mobile:** reveals an inline manual-entry form (name/calories/macros)
     on the barcode screen itself. Submitting (`handleManualLog`) writes
     **directly to `nutrition_entries`** (plus HealthKit) — the food is
     **already logged to today's diary** at this point, not just saved as a
     template.
   - Confirmation toast/label differs to match: web's `BarcodeShareOptIn`
     prompt reads "✓ Saved to your foods"; mobile's reads "✓ Logged to your
     tracker" — each is accurate to what actually happened on that platform.
2. **Community contribution opt-in (flag `barcode_community_contribution`,
   default OFF on both platforms as of 2026-06-27 — legal cleared it to ramp
   on 2026-06-28, but no ramp date has been set yet).** When on, `ShareCommunityDialog` + `BarcodeShareOptIn` (web) /
   `BarcodeShareOptIn` (mobile, `apps/mobile/components/barcode/`) offer an
   **explicit, default-OFF, discrete affirmative** opt-in to additionally
   share the same name + nutrition to the shared `user_foods` table via
   `submitFoodCorrection` — "Add this to Sloe's shared food database?" /
   **Share it** vs **Keep it private**, with a "How this is used" link to
   `/privacy#community-food-database`. Sharing runs the plausibility gate;
   a `block` result never shows a success card ("These numbers look off" +
   reasons instead) — honesty rule, no silent success. A successful share
   fires `food_contribution_opt_in { barcode, policy_version }`. Full
   consent/legal posture:
   [`docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md`](../decisions/2026-06-27-shared-food-db-contribution-opt-in.md).
   The opt-in's success copy promises "you can remove your version any
   time from your saved items" — the reachable surface it points to is the
   Barcode contributions row in Settings, covered in
   [`docs/journeys/settings-and-control.md`](./settings-and-control.md) §10.
3. **Saved confirmation (flag `eng1247_section_a_v1`, default ON on both —
   but only reachable when the opt-in dialog above has been shown and
   dismissed, so in practice this state needs BOTH flags on today).** After
   the opt-in dialog closes — whichever button was tapped, share or keep
   private — a final confirmation renders: **web** `BarcodeSavedAckDialog`
   (`src/app/components/suppr/BarcodeSavedAckDialog.tsx`, `data-testid="barcode-saved-ack-dialog"`);
   **mobile** an inline overlay in `apps/mobile/app/(tabs)/barcode.tsx`
   (`testID="barcode-saved-title"`). Both render the same
   `COMPLETE_DAY_V3_COPY` copy — headline "Saved to the database", body
   "{name} is now linked to that barcode — it'll come straight up next time
   you scan it. Thanks for improving Sloe for everyone." — with a single
   "Log it now" CTA.

**Documented platform divergence — "Log it now" does two different things.**
Because step 1 diverged, the same CTA label has a different real effect:
- **Mobile:** the food was already logged in step 1, so "Log it now" just
  calls `resetScan()` — it returns the scanner to its ready state so the
  user can log the *next* item. No further write happens (none is needed).
- **Web:** step 1 only created a reusable custom food, nothing was logged to
  today's diary. "Log it now" (`onLogNow`) only clears the dialog's open
  state — it does not log anything, reopen search, or reopen the barcode
  scanner. The user must independently search for the newly-created custom
  food (or rescan the barcode) to actually log it. The button's copy
  promises an action the web implementation doesn't perform — this is a
  real UX gap, not a documentation error. A fix (web auto-logging the saved
  custom food, or relabelling the CTA to "Done") hasn't been made yet.

No dedicated analytics event fires when the saved-confirmation state itself
renders or when "Log it now" is tapped (only the upstream `custom_food_created`
and `food_contribution_opt_in` events fire, both documented above / in
"Create custom food").

**Managing a contribution after the fact.** The opt-in's success copy
promises "you can remove your version any time" — the surface that makes
that true is Settings' **Barcode contributions** row, which lists every
`user_foods` row the signed-in user has submitted (through this flow or the
found-product correction path below) and lets them withdraw one. See
[Settings & Control journey §10](./settings-and-control.md#10-barcode-contributions--reviewing-and-withdrawing-shared-foods)
for the full withdrawal surface, its web/mobile divergences, and the
consent-integrity reasoning that made it a must-fix before this flag ramps.

**Files:** web — `src/app/components/suppr/today-barcode-dialog.tsx` (not-found
state), `src/app/components/suppr/use-barcode-logging.tsx` (sequencing/state),
`src/app/components/suppr/BarcodeSavedAckDialog.tsx`,
`src/app/components/suppr/ShareCommunityDialog.tsx`,
`src/app/components/suppr/BarcodeShareOptIn.tsx`. Mobile —
`apps/mobile/app/(tabs)/barcode.tsx`,
`apps/mobile/components/barcode/BarcodeShareOptIn.tsx`. Shared copy —
`src/lib/completeDayV3.ts` (`COMPLETE_DAY_V3_COPY`).

**Next in this loop:** mobile returns to the scanner ready state; web returns
to Today with the product saved as a custom food, findable via Search.

#### Known duplication: two mobile barcode-scanner implementations

Mobile ships **two separate camera-scanning implementations** that both
duplicate scan/lookup/correction/plausibility UI:

- **Standalone full-screen route** — `apps/mobile/app/(tabs)/barcode.tsx`
  (~1,255 lines). Reached via the `FoodSearchModal` "scan" push, plus
  deep-links and the iOS share extension.
- **`<BarcodeScannerModal>`** — `apps/mobile/components/BarcodeScannerModal.tsx`
  (~1,861 lines). Used inside the canonical `<LogSheet>` (the scan icon
  described above).

**What's shared, so nutrition trust doesn't drift:** the confidence tier
(`barcodeConfidenceTier`, `src/lib/nutrition/barcodeConfidence.ts`) and the
per-100g-vs-per-serving plausibility guard (`checkScaledLogPlausibility`,
`@suppr/nutrition-core/macroPlausibility`) are imported by both screens —
see [`nutrition-approximation-policy.md`](../product/nutrition-approximation-policy.md)
for the shared confidence/plausibility rules both implementations must
honour.

**What's NOT shared:** the UI shell, the review-card layout, and the
correction-flow copy are two independent copies. They can diverge in
presentation even though the underlying trust rules can't. This is an
**open product question, not yet resolved**: is the standalone route
still needed now that the canonical `<LogSheet>` covers scanning inline, or
should it be consolidated into `<BarcodeScannerModal>`?

**Next in this loop:** confidence chip renders → user reviews → "Log to
{slot}" → Today totals + Apple Health write (mobile).

**Voice log (Pro)** — `VoiceLogDialog` (web) / `VoiceLogSheet` (mobile):
- Entry point: "Voice" chip in the Today quick-log strip and in the FAB sub-sheet. Free + Base users see a lock icon and the factual paywall dialog ("Voice logging is a Pro feature. Upgrade to use it.") on tap — no countdowns, no dark patterns. Analytics: `voice_log_paywalled`.
- **Capture.** Press-and-hold the mic to record. Web uses the browser Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) when available; mobile uses `expo-speech-recognition` when a dev build exposes it. Both fall back to a typed input if native capture is unavailable.
- **Parse.** Transcript POSTs to `/api/nutrition/voice-log`. The route calls GPT-4o-mini to decompose the transcript into structured items (`name`, `amount`, `unit`), then runs each through the shared `verifyIngredients` pipeline to get verified macros. No nutrition values are invented by the LLM — per MacroFactor-style approach.
- **Review.** Each parsed item is rendered with an editable name, editable macros (kcal/P/C/F), a confidence dot (high ≥0.75 / medium ≥0.5 / low <0.5), and an "AI estimate" badge. Low-confidence items get an amber border + a `role="alert"` "Low confidence — please verify" note; the commit button becomes "Log anyway".
- **Commit.** "Log all" writes each reviewed item as a separate diary row with `source: "AI voice"`. Analytics: `voice_log_committed` with `{ itemCount, avgConfidence }`.

**Photo log (Pro)** — `PhotoLogDialog` (web) / `PhotoLogSheet` (mobile):
- Entry point: "Snap" chip in the Today quick-log strip. Same Pro gate as voice log (lock icon + factual paywall dialog for free + Base tiers; analytics: `ai_photo_log_paywalled`).
- **Capture.** Web uses `<input type="file" accept="image/*" capture="environment" />` for camera / library selection. Mobile uses `expo-image-picker` with both Camera and Library buttons. Local preview renders from the picked File / URI.
- **Analyse.** "Analyse" POSTs multipart to `/api/nutrition/photo-log`. GPT-4o identifies foods and estimates portions; each item is matched through `verifyIngredients` for verified macros. Max photo size 6 MB (enforced server-side).
- **Review + commit.** Same review UI as voice log (confidence + AI-estimate badges, inline macro edit, low-confidence amber styling). Commit writes rows with `source: "AI photo"`. Analytics: `ai_photo_log_started` / `ai_photo_log_committed`.

**AI-sourced row badge.** Rows in the Quick Add panel's Recent tab show a subtle "AI" badge when their `source` contains `"AI voice"` / `"AI photo"` / `"voice"` / `"ai_photo"`. This is informational (not shameful) so users can always tell a macro estimate came from an AI pass.

**Quick add** — tabbed panel (Usual meals / Recent / Frequent / Favourites):
- Opens from the `Previous` FAB action on mobile; rendered inline above the Meals section on web. As of 2026-04-18 the tabs are ordered so the primary re-log surface shows first, and "My meals" was renamed to "Usual meals" (the old name was confusingly similar to the Recent / Frequent history tabs).
- **Usual meals** (canonical re-log surface) — user-saved meals from `public.user_saved_meals`, newest-re-logged first. Each row shows name, item count, and bundle totals. Tap `+` to log every item to the active slot in one action. Overflow (web) / long-press (mobile) exposes Rename / Delete.
- **Recent** — the last 20 unique meals from journal history.
- **Frequent** — most-logged meals across journal history, ranked by count. Source: `computeFrequentMeals()` from `src/lib/nutrition/foodHistory.ts`.
- **Favourites** — meals the user has starred. Source of truth: `public.user_favorite_foods`. Empty state copy: "Star meals you log often for one-tap re-logging."
- Each single-food row shows title, kcal · P/C/F summary, an `Nx` occurrence badge, a star toggle, and a `+` button that logs to the active slot.
- Star toggles are optimistic and revert on Supabase error; a unique-violation on add is treated as success (existing row is returned).
- **Default tab rule:** resolved via the shared `resolveQuickAddDefaultTab(hasSavedMeals)` helper in `src/lib/nutrition/usualMealHint.ts` — lands on `"saved"` when the user has ≥1 saved meal, else `"recent"`. Both platforms consume the helper so first-impression behaviour cannot drift. A caller-forced `defaultTab` prop always wins.
- **LogHub quick-action row** (added 2026-06-27, flag `loghub_quick_actions_v1`, default OFF) adds a faster path above these tabs — `Log usual` / `Copy yesterday` / `Duplicate day`, only the resolvable buttons render. Not documented here; owned entirely by [log-sheet.md](./log-sheet.md)'s LogHub quick-action row section.

**Next in this loop:** commit writes a row to `nutrition_entries` → the
ring / macro tiles / meal slot update immediately → save the meal as a
"usual" for one-tap re-logging (below), or keep logging the next item.

### Save a usual meal
A **usual meal** (internally `SavedMeal`) is a user-named bundle of 2+ foods the user habitually logs together — e.g. "My usual breakfast" = oats + berries + protein powder + almond butter. It is **not** a recipe (no ingredients list, no instructions, no servings) and **not** a single favourite (favourites are one food; usual meals are a bundle). Meal templates (whole-day plans) are a separate future concept.

- **Slot-header `Log usual` pill (primary re-log entry point).** When the user has ≥1 saved meal with matching `defaultMealSlot`, each meal-slot header (`Breakfast / Lunch / Dinner / Snacks`) renders a `[↻ Log usual: {name}]` primary-coloured pill at the top-right. Tap logs the saved meal directly. 2+ matches open a small picker sheet with the top 3 by `last_logged_at`. Fires `usual_meal_log_tapped { slot, itemCount }` alongside the canonical `saved_meal_logged` event so the slot-header vs Quick-Add split is measurable.
- **Full-width "Save {Slot} as a meal" row (primary save entry point).** Below the last food item in a slot, a full-width primary-colour row renders when the slot has ≥2 items AND no saved meal exists yet for this slot. Tapping opens the save UI — the web dialog (`suppr/SaveMealDialog`) or the mobile bottom sheet (`SaveMealSheet`). Replaces the old 10px "Save combo" pill metadata chip (deleted); the new row has the same visual weight as other primary row actions.
- **First-run hint.** A one-off dismissible inline card renders inside a slot when the shared `shouldShowUsualMealHint` gate passes (same-day ≥2 items in slot OR cross-day ≥2 distinct matches in 7d). Copy: **"Make this your usual {slot}. One tap to re-log it tomorrow."** Two buttons — `Save as usual` (opens save dialog pre-seeded with today's slot items) and `Not now` (dismisses for that slot only). Dismiss is persisted under `suppr-usual-meal-hint-dismissed-v1` (localStorage on web, AsyncStorage on mobile) so the same slot's hint never renders twice. Analytics: `usual_meal_hint_shown` / `usual_meal_hint_accepted` / `usual_meal_hint_dismissed` — all with `{ slot }`.
- **Save form:** name input (required, trimmed, cap 80 chars) + optional default-slot chips/dropdown (Breakfast / Lunch / Dinner / Snacks) + reorderable item list (up / down arrows + remove). The active slot is preselected as the default slot, and the name is pre-filled with `My usual {slot}`. Dialog title: **"Save as a usual meal"**. Description: **"One tap re-logs all of these items next time."**
- **Persistence:** parent row lands in `public.user_saved_meals` (name, optional `default_meal_slot`, `log_count`, `last_logged_at`); child rows land in `public.user_saved_meal_items` (one per food, ordered by `position`). If the items insert fails the parent is deleted (no zombie meals).
- **Re-log:** the `Log usual` slot-header pill and the Quick Add panel's "Usual meals" tab both expand the saved meal into individual journal entries via the shared `buildMealEntriesFromSavedMeal` helper and insert each through the same `addLoggedMealForDate` (web) / `setByDay` (mobile) path as any manual log. Each re-log gets fresh ids per row, so past logs and the saved meal stay independent. Saved meals with a `default_meal_slot` log into that slot; otherwise they log into the active slot.
- **Rename / Delete:** web uses a row overflow menu; mobile uses long-press + action sheet. Rename trims + persists via `renameSavedMeal`; delete cascades child items via FK `on delete cascade`.
- **Analytics:** `saved_meal_created` (with `itemCount`, `defaultMealSlot`), `saved_meal_logged` (`itemCount`, `slot`), `saved_meal_deleted`, plus four dedicated events: `usual_meal_log_tapped`, `usual_meal_hint_shown`, `usual_meal_hint_accepted`, `usual_meal_hint_dismissed`. All fire on both platforms.
- **Growth-loop recap line.** The weekly `WeeklyRecapCard` on the Progress dashboard now surfaces one additional line when the data supports it. Celebration path: "You logged {name} {n} times this week." when the user has ≥1 saved meal re-logged in the window. Prompt path: "Got a usual {slot}? Save it once, log it in one tap." with a `Save {Slot} as a meal` CTA when the user has zero saved meals AND ≥5 distinct logged days. The decision lives in the pure `buildUsualMealRecapInsight` helper in `src/lib/nutrition/weeklyRecap.ts`, consumed by both the web and mobile recap cards.
- **Edge cases:** signed-out users see a "Sign in to save a usual meal for one-tap re-logging" empty state. An empty saved meal never appears in the list (parent-without-items rows are cleaned up on failed insert). Concurrent double-taps on a row are guarded by an optimistic pending-ids set so the user sees one log even if they tap twice.

**Next in this loop:** the saved meal shows up as the slot-header "Log usual"
pill and in the Quick Add panel's "Usual meals" tab next time — one tap
re-logs it. Growth-loop recap line surfaces in Progress at week's end — see
[`progress.md`](./progress.md).

### HealthKit-import fallback titles (2026-05-03)
When Suppr imports a meal from Apple HealthKit and the source app
(MyFitnessPal, Lose It!, etc.) didn't include a real food name in the
sample's metadata, the import writes a synthetic placeholder title rather
than leaving the row blank — `<Source> entry · NNN kcal` (e.g.
"MyFitnessPal entry · 250 kcal"). Imports written by builds before
2026-05-03 carry the legacy shape `Food log (NNN kcal)`; both shapes are
recognised forever since existing TestFlight histories still contain the
legacy rows.

These synthetic rows are filtered out of every "what have I logged before"
surface so they can't be mistaken for a real food or crowd out genuine
history:
- Quick Add's **Recent** and **Frequent** tabs (above)
- The Today screen's recent-meal suggestion chips (web
  `src/app/components/NutritionTracker.tsx`, mobile
  `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`)
- The 30-day milestone modal's "most-logged food" stat
  (`src/lib/nutrition/milestone30Day.ts`) — otherwise it could crown an
  MFP/Lose It! placeholder as the user's top food

Both the formatter (`formatHealthImportFallbackTitle`) and the filter
predicate (`isHealthImportFallbackTitle`) live in one shared module —
`src/lib/nutrition/healthImportLabels.ts`, re-exported for mobile at
`apps/mobile/lib/healthImportLabels.ts` — so the string format and the
filter rule can never drift between platforms. Full HealthKit-import test
coverage (connect → sync → dedupe → label rules) lives in
[`docs/testing/health-sync-functionality-matrix.md`](../testing/health-sync-functionality-matrix.md)
(case HS-09) and its
[device runbook](../testing/health-sync-device-runbook.md).

**Dev/QA validation harness (not user-reachable):** both platforms ship a
side-by-side before/after screen for eyeballing the format + filter against
hardcoded sample data — mobile `apps/mobile/app/dev/health-import-labels.tsx`
(deep link `suppr:///dev/health-import-labels`, captured by the Maestro flow
`apps/mobile/.maestro/00g_bundle_1b_validation.yaml`) and its web mirror
`app/dev/health-import-labels/page.tsx` (`/dev/health-import-labels`, used
for Playwright captures). Both render only the hardcoded sample rows shown
in the code — no real user data, no PII. Neither route is linked from
in-app navigation; production exposure is blocked at the Vercel routing
layer for `/dev/*` rather than an in-component auth gate (an in-component
gate broke Playwright's ability to capture the page in CI, so the block
moved to routing).

### Collapsing Meal Sections
- **Web:** tap/click anywhere on a meal header (Breakfast, Lunch, etc.) to
  collapse or expand that section.
- **Mobile (documented platform divergence, not drift):** once a slot has
  ≥1 logged item, tapping the header row opens that slot's combined-nutrition
  view (see "Viewing full meal nutrition" below) instead of toggling collapse
  — collapse/expand moves to a dedicated chevron icon at the right edge of the
  header (`today-slot-chevron-{slot}`). An empty slot's header still opens
  "+ Add food" directly (nothing to collapse). Web keeps the opposite split:
  the whole header stays the collapse toggle, and "View slot nutrition" is its
  own ghost icon-button with `stopPropagation` so it doesn't also collapse the
  slot. (`apps/mobile/components/today/TodayMealsSection.tsx` vs
  `src/app/components/suppr/today-meals-section.tsx`.)
- Collapsed sections still show the total kcal in the header.
- A chevron indicator rotates to show collapsed/expanded state.

**Next in this loop:** purely a display toggle — logging continues via "Add
food" inside any slot, or open the slot's combined nutrition (mobile: header
tap; web: the ghost "View slot nutrition" icon) — see "Viewing full meal
nutrition" below.

### Viewing full meal nutrition

Every logged item — and every populated meal slot as a whole — has a
dedicated nutrition-detail view: total kcal, the macro breakdown, and every
micronutrient the food's data source published. This is a **read surface** (a
deeper look at what's already logged), distinct from the Edit action that
changes it.

**Entry points:**
- **Mobile — single item:** tap a logged food row (not long-press — long-press
  opens the Edit/Copy/Delete action sheet, see "Deleting Food" below) to open
  `/meal-nutrition?id=<entryId>` (`onPressMeal` in `TodayScreen.tsx`).
- **Mobile — whole slot:** tap a populated slot's header row (see the mobile
  note in "Collapsing Meal Sections" above) to open the same screen in
  **slot-aggregate mode**, `/meal-nutrition?slot=<slot>&date=<day>`
  (`onPressSlotSummary`).
- **Mobile — from the edit-meal modal:** a **"Full nutrition"** row (chevron,
  opens the same single-item view) sits inside `TodayEditMealModal` itself —
  so a user already editing a meal can jump straight to its full breakdown
  without closing the modal and re-tapping the row. Gated behind
  `eng1247_section_a_v1` (default-ON, `REDESIGN_DEFAULT_ON` in
  `apps/mobile/lib/analytics.ts`) — off, the row doesn't render.
- **The Edit round-trip lands on Today, not back on meal-nutrition.** Tapping
  **Edit** on the single-item view (header action, see below) navigates
  *away* from `/meal-nutrition` to `/(tabs)` with `?editMealId=<id>`, and
  Today's edit-meal-on-return effect opens `TodayEditMealModal` there
  (`openEditOnToday` in `apps/mobile/app/meal-nutrition.tsx`). Saving
  (`saveEditMeal` in `TodayScreen.tsx`) only closes that modal — it does not
  navigate anywhere, so the user is left on **Today**, not back on the
  meal-nutrition screen they started from. A separate guard in the same
  codepath (pinned by
  `apps/mobile/tests/unit/weeklyCheckinEditMealGuard.test.ts`) stops the
  weekly check-in modal from popping on top of the edit modal on the same
  focus event — a different bug from the round-trip behaviour described
  here.
- **Web — single item:** a **"View nutrition"** item in the meal row's
  overflow (kebab) menu opens `MealNutritionDialog`
  (`src/app/components/suppr/meal-nutrition-dialog.tsx`) for that item.
- **Web — whole slot:** the "View slot nutrition" ghost icon-button described
  above opens the same dialog in aggregate mode.
- Both web affordances were gated behind `web_meal_nutrition_detail`
  (default-ON since 2026-06-22); the flag was **collapsed (ENG-1651,
  2026-07-22)** — it was permanently ON via `REDESIGN_DEFAULT_ON` with no
  live kill switch, so `NutritionTracker.tsx` now wires both affordances
  unconditionally. See the
  [web parity decision](../decisions/2026-05-31-web-meal-nutrition-detail-parity.md)
  for the shipping history and the slot-aggregate follow-up work. Mobile's
  screen predates this flag and was never gated by it — `onPressMeal` /
  `onPressSlotSummary` are wired unconditionally in `TodayScreen.tsx`. Both
  platforms are now symmetric: unconditional on both sides.

**Single-item view** (mobile `apps/mobile/app/meal-nutrition.tsx`; web
`MealNutritionDialog`):
- Header shows the food's name (falls back to "Meal nutrition"), a
  `{slot} · {date}` caption, and — **mobile only** — an **Edit** action that
  routes back to Today with the entry pre-loaded into the edit-meal modal.
  Web is **read-only**: it has no per-meal edit dialog to route to yet. This
  is an intentional, documented platform divergence, not a parity gap —
  wiring web meal-edit is separate, larger work.
- Meta line: `{slot} · {time}` plus the food's data source (e.g. "USDA
  FoodData Central", "Open Food Facts", "Custom food"), via
  `formatNutritionSourceLabel`.
- **Portion line** (`Portion ×N`) renders only when the logged portion
  multiplier isn't the default `×1` — hidden otherwise so it doesn't read as
  boilerplate (2026-05-07 decision).
- **Kcal headline**, then the macro breakdown — a 4-cell **Protein / Carbs /
  Fat / Fibre grid** (`MacroTotalGrid`), each cell tappable through to that
  macro's day-level breakdown at `/macro-detail?macro=<key>&date=<day>`. The
  grid is gated on the shared `macroSplitConfidence` policy (same policy the
  rest of the nutrition surfaces use — see
  [nutrition-approximation-policy.md](../product/nutrition-approximation-policy.md)):
  a source that published kcal but only one consistent macro (e.g. an Open
  Food Facts row with only a fat value) suppresses the misleading "100% of
  macro calories" framing in favour of a plain-language explainer instead of
  drawing a one-colour bar — closes the "chili crisp reads as 100% fat"
  failure mode. Fibre in the grid is always real per-entry data
  (`mealContributedFiberG`), never an estimate.
- **"Vitamins, minerals & more"** table: every populated micronutrient field
  the source published, source-attributed. A source that published nothing
  collapses to one quiet sentence instead of a wall of "—" rows; a source
  that published *some* fields shows "N of M fields published by {source}"
  plus a one-line "N more not published by {source}" instead of listing every
  empty row (2026-06-10 calm-empty-state decision — same pattern as the
  recipe-detail allergen collapse). Fibre is stripped from this table since
  the macro grid above is its single home (2026-05-05 decision, which also
  cut a separate Water line outright — water is a daily total, not a
  per-entry metric).

**Slot-aggregate view** (mobile `?slot=&date=`; web dialog's aggregate mode)
sums every logged item in one meal slot on one day into a combined breakdown,
for "how did Breakfast add up" rather than one item's detail:
- The header shows the slot name + item count in place of a food name, and a
  kcal value pill in place of Edit — there's no single entry to route an edit
  to, so **Edit never renders in aggregate mode** on either platform.
- A per-item line list precedes the combined breakdown: each logged item as a
  row (a dot sized by its share of the slot's kcal, item name, its own kcal)
  — tapping a row drills into that item's single-item view. A segmented
  distribution bar below the list visualises the same split.
- The combined macro grid + micros table reuse the exact same summing helpers
  on both platforms (`sumMicrosFromLoggedMeals`, `sumDayFiberFromMeals`) so
  mobile and web totals can't drift apart — see the decision doc above for
  the shared-helper detail.

**Empty / error states** (mobile screen; web dialog degrades similarly):
- A slot with zero logged items for that date shows "Nothing in {slot}" with
  a "Go back" CTA rather than an empty aggregate.
- A missing / deleted / malformed entry id shows "Meal not found" or
  "Couldn't load meal" with the same "Go back" recovery card, sharing chrome
  (`PushScreenHeader` + the elevated empty-state card) with the `/macro-detail`
  sibling screen — see the
  [header/token-unification decision](../decisions/2026-05-31-macro-meal-nutrition-detail-header-unify-and-tokens.md).

The day-level `/macro-detail` screen that `MacroTotalGrid` cells link to
(`apps/mobile/app/macro-detail.tsx`; web `src/app/components/MacroDetailPanel.tsx`)
doesn't have its own dedicated journey coverage yet — it's referenced here
only as a downstream tap target from the meal-nutrition macro grid. It needs
a proper home eventually, either as its own subsection here or inside
`progress.md`, since it's a day-level breakdown rather than a meal-level
one.

**Next in this loop:** tap Edit (single-item, mobile only) → the Today
edit-meal modal (see "Deleting Food" below for that modal's other entry
point); tap a macro-grid cell → `/macro-detail` for that day; tap a
slot-aggregate row → that item's single-item view; tap back → returns to
Today at the slot/date the user came from.

### Deleting Food
- **Mobile:** Long-press any logged entry -> action sheet with Edit / Copy / Delete -> removes from journal
- **Web:** Click the row overflow menu -> "Delete" -> `window.confirm()` dialog -> removes from journal
- Both platforms issue a `DELETE` against `nutrition_entries` so the removal persists across sessions and devices.

**Next in this loop:** the macro spine recomputes immediately; an adaptive TDEE refresh is scheduled in the background.

### Copying food to another day
- **Web:** On any logged meal row, the overflow menu exposes **Copy to another day…** which opens the `CopyMealDialog`. The day header above the Meals section has a **Duplicate day…** button when the day has meals.
- **Mobile:** Long-press on a meal row opens the action sheet with **Copy to another day**. The day view shows a small **Duplicate day…** chip above the meal-slots card when meals exist.
- **Target selector:** both platforms offer a single target day (date picker) plus optional quick-range chips (+2, +3, +7 days) on Copy, and a Single-day / Date-range toggle on Duplicate. The source day is always dropped and duplicate targets are deduped by the shared helper `sanitizeCopyTargets`.
- **Persistence:** each destination row is inserted through the same `nutrition_entries` insert path as a normal manual log, with a freshly minted `id`. The source row is never mutated.
- **Edge cases:** if the target list resolves to zero (e.g. only the source day was selected), both platforms show a factual **"Nothing to copy"** / **"Nothing to duplicate"** toast and make no writes. Duplicating a day with zero meals is also a no-op.
- **Analytics:** one `meal_copied` or `day_duplicated` event per confirmed action, with `{ source, batchSize, targetDayCount }`.

**Next in this loop:** each target day's macro spine updates on next visit.

### Date Navigation
- `‹` and `›` arrows to move between days
- Tap date label to jump to today
- Shows "Today", "Yesterday", or "Mon 7 Apr" format

**Next in this loop:** switch to Week View below for trend review, or keep logging on the selected day.

## Week View

### Layout
```
┌─────────────────────────────┐
│  Weekly Calories            │
│  Mon Tue Wed Thu Fri Sat Sun│
│  ▓▓▓ ▓▓▓ ▓   ▓▓            │  ← bar chart (AMBER bars = over target,
│                              │     never red — see the amber-not-red rule above)
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

Note: the 🔴 Protein legend swatch is a **macro-identity colour**
(`--destructive`, chosen for protein specifically), unrelated to
over/under-target status — do not read it as a "protein is over budget"
signal. The bar-chart amber is the only over-target colour in this view.

- Tap any day bar to drill into Day view for that date
- Week navigation with `‹` `›` arrows
- Weekly average calculated from days with logged food only
- Week boundary respects `profiles.week_start_day` (Monday or Sunday). In calendar-week mode the seven displayed days start on the user's chosen day. In rolling mode the window is always the 7 days ending on the selected date, ignoring week start.

**Next in this loop:** tap a day bar to return to that day's Day view above, or continue to "Deficit-window mode" below.

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

**Next in this loop:** the mode you pick drives both this Today summary
line and the weekly check-in window — see "Weekly recap screen
(mobile-only)" below.

### Weekly recap screen (mobile-only) — documented platform gap

Tapping the `<StreakPip>` (top-right of Day view, see Layout above) opens a
**dedicated mobile screen** (`apps/mobile/app/weekly-recap.tsx`): the
current-week check-in (adaptive-TDEE delta + a plain-English why-line + a
goal-pace re-tune CTA), a day-dot grid, a "closest to target" card, and a
calm streak/freeze ledger. Copy is observational only — no gamification
glyphs beyond the single `Flame` icon already inside the pip. Full
streak-freeze behaviour and the Weekly Recap Card design are owned by
[`progress.md`](./progress.md), not here.

**Web has no equivalent screen.** The weekly check-in itself is shared
across platforms (`shouldShowWeeklyCheckin` gates both — see
"Deficit-window mode" above and the Weekly Check-in banner/modal on Today),
but the standalone day-dot grid, closest-to-target card, and freeze ledger
only exist on mobile. This is a **documented, intentional-for-now gap**, not
accidental drift — the code's own header comment on `weekly-recap.tsx` notes
that these standalone views (the day-dot grid, closest-to-target card, and
streak/freeze ledger) are mobile-only today, with web parity for these
Progress rollups planned but not yet built.

Web's goal-pace re-tune CTA routes to Settings → Targets instead of a
dedicated recap screen.

**Next in this loop:** accept a goal-pace re-tune → new daily targets flow
back into the ring and macro tiles at the top of this doc's Layout section.
Full weekly-review detail → [`progress.md`](./progress.md).

## Activity Bonus card & Burn Detail screen

Two Today cards cover energy expenditure, both progressively disclosed (see
"First-run Today" above — first-run fallback is a "Connect health" link
until Apple Health / Google Fit has synced once):

- **`today/TodayActivityCard`** (mobile) / web equivalent — steps count +
  active-energy readout. Gated on `isStepsCardVisible`
  (`src/lib/nutrition/todayProgressiveDisclosure.ts`).
- **`today/TodayActivityBonusCard`** (mobile,
  `apps/mobile/components/today/TodayActivityBonusCard.tsx`) / web
  `suppr/today-activity-bonus-card.tsx` — the net-energy hero (burned −
  eaten, with a deficit↔maintenance↔surplus gradient slider), a
  Burned / Eaten / Maintenance stat row, a tappable **burn-breakdown row**
  (testID `today-burn-breakdown-card`: kcal-so-far headline + Active/Resting
  sub-lines + "+N bonus earned" chip when a bonus has been earned), and —
  when the trailing 7-day window has any burn — the weekly deficit rollup
  (`TodayWeeklyRollingCard`, respecting the "Deficit-window mode" setting
  above).

### Opening the Burn Detail screen (mobile only)

Tapping the burn-breakdown row calls `onOpenBurnDetail`, which
`TodayScreen.tsx` wires to `router.push({ pathname: "/burn-detail", params:
{ date: dayKey } })` — the viewed day's date, not always today. This lands
on **`apps/mobile/app/burn-detail.tsx`** (`testID="screen-burn-detail"`,
header title "Activity Summary" with a date caption reading "Today" /
"Yesterday" / a short weekday date).

**Web has no equivalent screen — a documented platform gap, not accidental
drift.** The web burn-breakdown row isn't a tap target. `src/app/components/
BurnDetailPanel.tsx` renders the same content and the same projected-EOD
math as the mobile screen, but it isn't imported or rendered anywhere in the
web app today — it's dead code, left in place rather than deleted. Wiring
`BurnDetailPanel` up on web, as a dialog matching its existing modal shape,
is the natural fix and hasn't been done yet.

### Screen content (mobile, top to bottom)

1. **Hero card** — a single serif kcal numeral (`testID
   burn-detail-hero-kcal`): for today, the **projected end-of-day total**
   (`restingBurn + activeBurn + projected future resting`); for a past day,
   the **actual final burn** (`restingBurn + activeBurn`, no projection).
   Caption: "kcal burned · {date}".
2. **"Breakdown" card** (`testID burn-detail-breakdown`) — one row per
   component, in this order:
   - **Active energy** — exercise, walking, movement above resting.
   - **Resting energy** — energy used while minimally active (BMR-adjacent).
   - **Estimated remaining** — today only, and only when the projected
     future-resting amount is > 0; "Based on your resting rate so far
     today."
   - **Steps** — `steps_by_day[date]` vs `daily_steps_goal` (falls back to
     10,000 when unset), with a thin progress bar. This is the day's
     single-day step count; the 30-day steps trend chart lives on Progress,
     not here (moved there on 2026-05-12 — Burn Detail is the canonical
     activity drill-down for a single day).
   - **One row per logged workout** (`workouts_by_day[date]`) — type,
     minutes (when > 0), calories (when > 0).
3. **"Activity bonus" card** (`testID burn-detail-bonus-card`) — the
   subtraction the reader can do themselves (Lose It!-style row order, per
   the decision doc below): **Final burn** (past) / **Projected burn**
   (today) → **Maintenance estimate** (subtracted, only rendered when a
   maintenance figure resolved) → **Bonus** (`testID
   burn-detail-bonus-result`): "**Bonus earned** +N kcal" in the activity
   accent colour when `bonus > 0`, else a muted "No bonus earned". When
   `bonus > 0`, an **"Add bonus to today's budget"** `Switch`
   (`testID burn-detail-activity-budget-toggle-switch`) appears — this is
   the same `profiles.prefer_activity_adjusted_calories` preference
   surfaced on Today; toggling writes to Supabase immediately (optimistic,
   reverts on error). A caption below the card reads "Burn above your
   maintenance estimate adds to your daily food budget."
4. A single primary **"Done"** button closes the screen (`router.back()`).

**Bonus formula.** `bonus = max(0, totalBurn − maintenanceKcal)`. For today,
`totalBurn` is the projected EOD figure above; for past days it's the
actual final burn. Full rationale (why projected-not-prorated, the industry
comparable, the "phantom budget" failure mode it replaced) lives in
[`2026-05-13-activity-bonus-projected-eod-model.md`](../decisions/2026-05-13-activity-bonus-projected-eod-model.md) —
this is the canonical formula doc; treat it as the source of truth if this
section and that doc ever disagree.

**Maintenance/TDEE resolution.** Behind the `energy_numbers_v1` flag
(`ENERGY_NUMBERS_V1_FLAG`), the screen calls the canonical
`selectMaintenance()` — the same input policy (latest weigh-in weight,
strict-null sex/height/age, no `?? 70` fallback) every other maintenance
surface uses; see
[`2026-07-11-canonical-energy-numbers.md`](../decisions/2026-07-11-canonical-energy-numbers.md)
for the full input-drift problem this closed. Flag OFF, it falls back to
the legacy `resolveMaintenance()` call with profile basics assembled
per-screen. If neither resolves a positive figure, the screen falls back
once more to `maintenanceIntakeFromTargetCalories()` — maintenance
back-derived from `target_calories` by reversing the goal/pace adjustment
baked into it (returns `null`, never a misleading `0`, when there's no
usable signal — `apps/mobile/lib/calcTargets.ts`).

**Loading / error / empty states.** Sign-in gate ("Sign in to see your
activity bonus.") when `userId` is missing; a load-error state with retry
copy ("Could not load activity data. Pull to retry.") on a Supabase error;
a "No profile found — complete onboarding" state when the profile row is
missing. While loading, the `deeplink_skeletons` flag swaps the legacy
centred spinner for a `BurnDetailLoadingSkeleton` silhouette of the loaded
layout (the cold-open deeplink pattern — see
[`mobile-visual-validation.md`](../development/mobile-visual-validation.md)).

**Analytics.** No dedicated event fires for opening the screen or for the
budget-toggle write — the toggle is a direct Supabase update, not an
instrumented action.

**Files:** `apps/mobile/app/burn-detail.tsx` (screen),
`apps/mobile/components/today/TodayActivityBonusCard.tsx` (Today card + tap
trigger), `apps/mobile/components/burn/BurnDetailLoadingSkeleton.tsx`
(loading state), `src/app/components/BurnDetailPanel.tsx` (web dialog,
currently unwired — see platform-gap note above).

**Next in this loop:** "Done" or back-nav returns to Today; the toggle
(if flipped) changes whether the bonus is already folded into the ring's
calorie target next time Today renders.

## Hydration & Stimulants Card

> **2026-04-27 update:** caffeine and alcohol rows are off by default and
> live behind a Settings opt-in. See
> `docs/journeys/tab-collapse-2026-04-27.md` for the full rationale. The
> toggle lives in Settings → "Tracking extras"; defaults to off on both
> platforms. When off, the
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
- **Measurement system (2026-04-18):** the water row, the "from logged food" sub-line, and the quick-add chips respect `profiles.measurement_system` on both platforms. Imperial renders in `fl oz` (chips at 4 / 8 / 16 / 20 fl oz — each stored as integer millilitres); metric renders integer ml up to 1 L, then one-decimal L. Caffeine stays in mg and alcohol in grams on both systems. Flipping measurement system on Settings and returning to Today re-renders the same logged water in the new unit — nothing is re-encoded.
- **Caffeine target**: `profiles.target_caffeine_mg`, default 400 mg (FDA upper bound for healthy adults). Set to `0` to hide the caffeine row entirely (added 2026-04-18 based on early tester feedback, for parity with alcohol).
- **Alcohol target**: `profiles.target_alcohol_g_weekly`, default 0 (row hidden). Users set it in Settings; 196 g ≈ 14 UK units.
- **Card position (since 2026-04-18):** the card sits at the bottom of Today on both platforms — after the Activity Bonus card, before the Complete Day button. Primary water quick-add still lives in the macro tile row at the top of Today; this card is the secondary detail surface plus the caffeine/alcohol quick-add.
- **Persistence**: `extra_water_by_day`, `extra_caffeine_by_day`, `extra_alcohol_g_by_day` on `profiles`. Each is a `{YYYY-MM-DD: number}` map. Writes are debounced to 300ms on web and awaited per-tap on mobile (matches the pre-existing water pattern).
- **Auto-tracking from food logs (since 2026-04-19)**: every successful `nutrition_entries` insert whose food source publishes caffeine or alcohol per 100 g (USDA `262`/`221`, Edamam `CAFFN`/`ALC`, OFF `caffeine_100g`/`alcohol_100g`) scales the nutrient for the logged portion via the shared `scaleCaffeineAlcohol` helper and bumps `extra_caffeine_by_day[dateKey]` / `extra_alcohol_g_by_day[dateKey]` via `updateStimulantsForDay`. Delete decrements the same delta. The scaled values also land on the meal's `nutrition_micros.caffeineMg` / `alcoholG` so historical context survives without a schema change. Null per-100 g → 0 (never invent a fallback; project rule). Quick-add chips on the card remain the manual fallback for custom foods / recipes / meal plans (their schemas don't carry aggregated caffeine/alcohol yet).
- **Reset today**: per-row overflow action (web dropdown / mobile modal) deletes the current day's key for that kind and persists, untouched other days.
- **Over-target copy** is factual and amber (`Accent.warning`), never red:
  - Caffeine: `Over <target> mg` when daily total exceeds `target_caffeine_mg`.
  - Alcohol: `Over limit` when the week-rolling sum exceeds `target_alcohol_g_weekly`.
- **Analytics**: `hydration_logged` (water) or `stimulant_logged` (caffeine/alcohol) with `{ type, amount, unit, preset }`. Reset fires `amount: 0, preset: "reset"`.
- **Apple Health (iOS)**: inbound caffeine import on the existing nutrition-import throttle; outbound caffeine written as a single `Suppr caffeine` food sample. Alcohol is not wired (see `docs/health-platform-phase-b.md` backlog).

For how the underlying calorie/macro **targets** these cards measure
against are actually calculated (not just displayed), see
[How your calorie target works](../user/how-your-calorie-target-works.md).

**Next in this loop:** "Complete day" below.

### Complete day

A **"Complete day"** button sits at the bottom of Today, below the
Hydration & Stimulants card. Tapping it opens a confirmation modal that
closes out the day — the trigger for the streak/freeze update and the
day-close celebration.

- **Web:** `src/app/components/suppr/today-complete-day-dialog.tsx`
- **Mobile:** `apps/mobile/components/today/TodayCompleteDayButton.tsx` +
  `TodayCompleteDayModal.tsx`

This is a ritual close, not a data lock — logging more food after
completing the day is still possible; Complete Day does not freeze or hide
the entry form. The modal's full close-out behaviour beyond the celebration
screen isn't fully documented here yet.

**Next in this loop:** streak/freeze updates → [`progress.md`](./progress.md)
for the weekly check-in and Progress dashboard; log tomorrow → back to the
top of the Daily Logging Loop.

## Data Storage

- **Primary and only path:** `nutrition_entries` relational table (one row
  per logged meal). Each entry: `{ id, name (slot), recipeTitle, time,
  calories, protein, carbs, fat, fiberG, waterMl, portionMultiplier }`.
- Additions: debounced upsert to Supabase (600ms delay).
- Deletions: immediate `DELETE` by entry ID on both web and mobile.

`nutrition_entries` is the sole source of truth for logged food — there is
no dual-write and no read fallback to any legacy table. The old
`nutrition_journals_legacy` table (a JSONB blob keyed by date) was dropped
via `supabase/migrations/20260421200040_drop_legacy_tables.sql` on
2026-04-21, after a 30-day rollback window following the 2026-04-13
relational split, and the client-side JSONB probe that used to read it was
removed from `src/context/appData/useNutritionJournalState.ts` shortly
after. Nothing in the app reads or writes that shape today.

**Next in this loop:** none — this is the storage layer every other
section in this loop writes to and reads from.

## Related Documents
- [Journey: Meal Planning](meal-planning.md) — `TodayPlannedMealsCard` → log planned meal
- [Journey: Log sheet](log-sheet.md) — the canonical `<LogSheet>` component this doc's Log button opens
- [Journey: What to Eat Next — North-Star / Coach Loop](what-to-eat-next.md)
- [Journey: Progress & Weekly Recap](progress.md) — weekly check-in, streak/freeze, weekly recap (mobile-only gap)
- [Product: Nutrition approximation policy](../product/nutrition-approximation-policy.md) — shared confidence/plausibility rules referenced throughout this doc
- [User: How your calorie target works](../user/how-your-calorie-target-works.md) — target math referenced from Hydration & Stimulants
- [Product: Overview — Feature areas](../product/overview.md#feature-areas)
- [Development: Mobile visual validation](../development/mobile-visual-validation.md) — the dev-screen + screenshot pattern behind the `/dev/daily-ring-states` QA harness (see "Internal QA tooling" under Layout above)
- [Decision: Shared food DB — barcode not-found contribution opt-in](../decisions/2026-06-27-shared-food-db-contribution-opt-in.md) — consent/legal posture for the "Scan → Not-found → save → community contribution → saved confirmation" sequence above
- [Journey: Settings & Control Loop](settings-and-control.md) §10 — where a user reviews/withdraws the `user_foods` rows this doc's contribution flow creates (the "remove your version any time" promise's reachable surface)
- [Decision: Web meal-nutrition detail parity](../decisions/2026-05-31-web-meal-nutrition-detail-parity.md) — the web `MealNutritionDialog` build (single-meal + slot-aggregate), referenced from "Viewing full meal nutrition" above
- [Decision: Macro-detail + meal-nutrition — header/token unification](../decisions/2026-05-31-macro-meal-nutrition-detail-header-unify-and-tokens.md) — shared chrome between `/meal-nutrition` and `/macro-detail`
- [Decision: Meal-nutrition — fiber into micros, drop water](../decisions/2026-05-05-meal-nutrition-fiber-into-micros.md) — why Fibre and Water moved/were cut from the per-entry breakdown
- [Decision: Activity bonus formula — projected-EOD model](../decisions/2026-05-13-activity-bonus-projected-eod-model.md) — the canonical burn/bonus formula behind "Activity Bonus card & Burn Detail screen" above
- [Decision: Canonical energy numbers](../decisions/2026-07-11-canonical-energy-numbers.md) — the `selectMaintenance()` input policy the Burn Detail screen resolves maintenance through when `energy_numbers_v1` is on

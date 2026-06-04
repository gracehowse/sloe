# Plan Tab / Meal Planner — Best-in-class Redesign Spec

**Surface:** Plan tab (iOS primary), web `/plan`, Move-meal sheet, Shopping sub-tab, Plan templates, Generate flow, Portion modal, Adherence layer
**Platforms:** iOS primary (`apps/mobile/app/(tabs)/planner.tsx`), web parity (`src/app/components/MealPlanner.tsx` via `/plan`)
**Author:** documentation-system
**Date:** 2026-06-02
**Status:** Spec — not yet implemented

---

## 1. Surface overview

### Purpose

The Plan tab is Suppr's macro-aware weekly meal planner. It answers the question "what should I cook this week so I hit my goals?" It auto-generates a scaled 1/3/7-day plan from the user's recipe library, fits each meal's portion to daily macro targets, and lets the user swap, move, re-portion, remove, log, and template meals — plus generates a household-aware shopping list from the plan. The deterministic macro-fit algorithm is the differentiator: every competitor in the space is either a recipe organiser (Recime, Julienne, Paprika) or a static prescriptive program (Lifesum, Centr). Suppr is the only product that *engineers* a real recipe plan against personal macro targets.

### Role in the product

- **Plan tab (tab 2 of 4):** sits between Today and Recipes. Today tells you where you are; Plan tells you where you're going; Recipes is the ingredient library.
- **Algorithm surface:** exposes the `mealPlanAlgo.ts` joint-fit sampler. The plan is not a suggestion — it is a nutritionally-computed artefact.
- **Shopping list generator:** downstream of the plan; the loop closes when the user shops and cooks the plan.
- **Win-moment canvas:** 7/7 target-hit rate is the highest-value positive feedback loop the product has after a new-low weigh-in.
- **Not:** a "what to eat next" oracle (that is Today's north-star, `northStarSuggestion.ts`; do not migrate it here).

### Navigation map (mobile — primary)

```
Bottom tab: Plan
  ├── Plan main (planner.tsx — continuous day list)
  │     ├── Week overview header
  │     │     ├── Summary headline "Hits your targets N of M days"
  │     │     ├── Weekday dot/pill row (hit/short per day)
  │     │     ├── 7-day stacked macro bar strip (P/C/F, scaled)
  │     │     └── Worst-short subtitle + worst-short day named
  │     ├── Plan slot switcher (pills, hidden at 1 slot)
  │     ├── Plan/Shopping sub-tab pill bar
  │     ├── Generate / Regenerate button (header)
  │     ├── Plan-length & start chip-sheet
  │     ├── Which-meals chip-sheet
  │     └── Day sections (stacked)
  │           ├── Day header (date, kcal vs goal, per-macro delta pills / band tracks)
  │           ├── Residual protein gap hint (conditional)
  │           ├── Meal rows (per slot: Breakfast / Lunch / Dinner / Snacks)
  │           │     ├── Recipe photo (hyperreal editorial food photography)
  │           │     ├── Slot label + recipe name
  │           │     ├── Estimated kcal + portion pill
  │           │     ├── Estimated-macros chip ("Estimated · verify")
  │           │     ├── Recipe-removed badge
  │           │     ├── Inline swap affordance (⇄)
  │           │     └── Row overflow (⋯ → action sheet)
  │           ├── Add-slot-back chips (per missing canonical slot)
  │           └── Leftover rows (visually subordinate)
  ├── Move-meal sheet (MoveMealSheet.tsx)
  ├── Portion-size modal (portionModal — ± stepper + live kcal)
  ├── Row action sheet (rowMenu)
  ├── Plan templates sheet (PlanTemplatesSheet.tsx)
  └── Shopping sub-tab (→ /shopping)
        └── Shopping list (grouped by recipe, household-scoped)

Web: /plan → MealPlanner.tsx (7-column kanban grid; intentionally reduced)
/planner → 308 redirect → /plan
```

---

## 2. Current design audit — weaknesses

### 2.1 Week overview header

**Current state:** The summary headline "Hits your targets N of M days" with a worst-short-day prose subtitle is informative but purely typographic. There is no visual encoding of *which* days hit and which fell short. The user reads a number and a sentence; they do not *see* the week at a glance.

**Weaknesses:**
- No per-day visual differentiation in the header — the user must scroll the full list to discover which days are short.
- The worst-short subtitle names one day and one fix ("Add a snack or swap the dinner") but gives no relative sense of how far short that day is versus others.
- No stacked-macro bar strip to communicate "this plan is engineered to your macros" — the algorithmic confidence is entirely invisible at first glance. MacroFactor shows this as a confidence artefact on post-generate; Suppr shows nothing.
- The win-moment headline colour (behind `redesign_winmoment`) is the only visual emphasis at 7/7 — there is no structural celebration, just a colour change and a haptic.

### 2.2 Per-day macro delta pills

**Current state:** P/C/F/Fi each rendered as text: `Ng ✓` (within 15% band) or `+N/-N g` diff. This is accurate but opaque — it requires the user to know the 15% band threshold, carry that number in their head, and interpret the signed delta. There is no visual representation of the band itself.

**Weaknesses:**
- The band threshold (15% for C/F, 5% for kcal, 10% for protein) is invisible — users do not know whether `+12g carbs` is fine or a failure.
- Text-only pills are not scannable at speed. MacroFactor and Lifesum both use track/bar forms for macro deviation — because that is legible in ~200ms; text requires ~1.5s of parsing.
- Fibre is included in the pills but visually indistinguishable from P/C/F. In the locked design system, fibre has its own identity (not tied to any of the macro colours).
- The check-mark icon for "within band" is too small and too similar to the diff text; users with any visual impairment may miss the distinction.

### 2.3 Meal rows

**Current state:** Recipe name + slot + estimated kcal + portion pill. Macros were removed from inline rows on 2026-05-22 (correct call). Food photography is not rendered inline on the row — the row is text-only.

**Weaknesses:**
- Text-only rows in a list this dense (up to 28 rows for a 7-day, 4-slot plan) are visually indistinguishable. A user scanning the week cannot identify meals by thumbnail.
- No inline swap affordance — swap lives only in the row action sheet (⋯ → 4 items deep). Swap is the primary planner verb and should be one tap.
- Row hierarchy is flat: recipe name and slot label have similar visual weight. On Recime and Lifesum, the slot label is a subtle caption above the recipe name, not a co-equal sibling.
- The portion pill ("0.5× portion") is readable but not immediately actionable. There is no visual affordance that it is tappable.
- Leftover rows are visually present but not visually subordinate — they sit at the same weight as primary meal rows, creating false parity.
- The "Estimated · verify" trust chip is correctly placed but uses the same weight as other text elements, risking being read as secondary or ignored.

### 2.4 Loading and empty states

**Current state:** Cold-start → SkeletonCards + "Building your plan…" with a 7-dot ribbon. Regenerate → shimmer overlay. Empty state is flag-laddered (`plan_empty_state_v2` → "Add a few recipes first → Browse library"). Both are functional.

**Weaknesses:**
- The skeleton does not preview the week-overview structure — it starts with a generic card shimmer that does not communicate "a macro-engineered plan is being built."
- The empty-state copy ("Add a few recipes first") is accurate but does not connect to the product's promise ("we'll build a plan that fits your goals"). It reads like a technical prerequisite rather than an invitation.
- The "Building your plan…" dot ribbon has no warmth; it is a spinner with a label. The generation is doing something remarkable (joint macro-fit sampling up to 2000 combinations) — the loading state should communicate that confidence.

### 2.5 Generate / Regenerate chrome

**Current state:** "Generate ▾" in the header; single-tap when `plan_import_enabled` is off. The regenerate diff toast ("N meals changed") is well-designed. The generate button has no visual distinction between "first generate" (blank state → plan) and "regenerate" (plan → updated plan).

**Weaknesses:**
- The post-generate state has no confidence reveal. MacroFactor shows a 7-day stacked-macro bar after generation as a "your program is ready" moment — it turns the algorithm output into a legible confidence signal. Suppr has the data; it just does not surface it.
- The win-moment at 7/7 is correctly gated on `redesign_winmoment` but is currently triggered by a headline colour change and haptic only. There is no structural moment — no visual pause, no full-bleed celebration card at the week-overview level.

### 2.6 Shopping list

**Current state:** A separate sub-tab; N items from this week; household-scoped; leftover-skipping. Correct and complete.

**Weaknesses:**
- The shopping list is grouped by recipe (functional) but not by aisle or category. Every best-in-class grocery comparable (Julienne, Apple Reminders, Recime) groups by produce/protein/dairy/etc. Users physically move through a store by category, not by recipe.
- The visual treatment does not match Julienne's standard (serif group headers, per-ingredient thumbnail, calm checkbox, "Clear" per group).
- The "· SHARED" household scope label is present but not visually prominent. For household users, shared vs personal is a primary concern.

### 2.7 Free→Pro gating chip

**Current state:** 3/7-day chips locked with a Lock icon → paywall Alert "Available with Pro" → `/paywall?from=meal_planner`. Correct mechanism.

**Weaknesses:**
- The Lock icon is functional but generic. Julienne uses a calm "Pro ☀️" badge that does not feel aggressive or punitive — it reads as aspirational.
- The locked chip does not preview what a 7-day plan looks like. Showing a blurred/muted 7-day layout behind the paywall CTA would dramatically increase conversion signal.

### 2.8 Web parity gaps (documented, not drift)

- Move-meal sheet does not exist on web (ENG-699).
- Portion stepper, Templates, Leftover rows, and per-day macro breakdown are explicitly cut from the web prototype rewrite per `MealPlanner.tsx:144-146`.
- Drag-drop reorder is listed in the web header as the web-native equivalent of Move, but the `moveMealInPlan` shared helper is listed as cut. Verify before implementing.
- Web swap is a Dialog; mobile is an Alert action sheet — mechanically equivalent, visually divergent (acceptable).

### 2.9 Silent save failure (weakness, not a feature)

`save_meal_plan` failures only `console.warn` in dev and are silent in production. A user who regenerates a plan on poor connectivity may lose it with no feedback. This is a correctness gap, not a UX gap, but any redesign spec must flag it so implementation does not treat the silent path as intentional.

---

## 3. Component-level redesign

---

### 3.1 Week overview header

**Current purpose:** Communicate the week's nutritional quality at a glance and surface the most actionable fix.

**Current weaknesses:** See §2.1.

**Benchmark:**
- Fitbit "Mindful days 0 of 6 this week" with S-S-M-T-W-T-F dot row: https://mobbin.com/screens/318ef228-8f35-4782-9683-6ffe48870cd3
- MacroFactor "Your macro program is ready" — 7-day stacked P/F/C bar with kcal target on top: https://mobbin.com/screens/8a6e223d-86b1-4522-be23-293dc631274f
- Noom "Today's Progress" coaching subtitle voice: https://mobbin.com/screens/e004b971-d306-498b-849a-c8c4e5ccb996

**Proposed redesign:**

The week overview header is a pinned card at the top of the plan list (not sticky — it scrolls with the content, remaining prominent on first load). It has four vertical layers:

**Layer 1 — Editorial headline**

```
Hits your targets   5 of 7 days
```

- Type: Fraunces (serif display), 28pt, weight 600, colour `#1B1814`
- "5 of 7" rendered as a display numeral in terracotta `#C2683E` — warm, not alarming
- At 7/7: full headline in terracotta, small upward-pulse animation (100ms, scale 1.0→1.04→1.0), success haptic via `Haptics.notificationAsync(SUCCESS)` — the existing `redesign_winmoment` gate
- At 0/7: muted ink `#1B1814` with sage tint, no haptic; copy changes to "No days on target yet — try a regenerate" in the subtitle layer
- Behind the `redesign_winmoment` flag: the colour/pulse/haptic behaviour. Flag OFF: static ink numeral, no haptic.

**Layer 2 — Weekday dot row (new)**

Seven pill-dots in a horizontal row, left-aligned under the headline. Labels Mon–Sun (abbreviated). Each dot:
- Hit (kcal within ±10% of target): sage `#5E7C5A`, 10pt diameter filled circle
- Short/over (outside band): amber `#C9892C`, 10pt diameter filled circle
- No plan (day has no meals): soft warm-grey `#ECEAE4`, 10pt, no fill — hollow ring
- The dot row is tappable: tap a dot scrolls to that day's section

```
● ● ○ ● ● ● ○
M  T  W  T  F  S  S
```

Label type: Inter 10pt, `#1B1814` at 60% opacity. Row height 28pt.

This is the Fitbit "mindful days" pattern applied to Suppr's per-day hit metric — purely visual encoding of existing `summaryScore` / `dayTotalVsGoal` data.

**Layer 3 — 7-day stacked macro bar strip (new)**

A horizontal bar strip with 7 bars, one per day. Each bar is a mini stacked chart: P (terracotta) / C (sage) / F (amber at base) segments stacked proportionally to the day's macro gram totals, capped at a max-height corresponding to ~120% of daily calorie target. A thin hairline at the target kcal level crosses all 7 bars.

- Bar width: screen width − 32pt margins, divided by 7 with 4pt gap
- Bar max height: 48pt (5 bars from the target line to the max, 3 bars below)
- Target kcal line: 1pt hairline, `#ECEAE4`, spans full width
- P segment colour: terracotta `#C2683E` (top of bar — protein is the highest-priority macro)
- C segment colour: sage `#7C8466`
- F segment colour: `#C9892C` (amber — not a warning here, just a tertiary colour; amber is reserved for *over-budget* signals; fat segment uses a muted version at 60% opacity to avoid false alarm reading)
- Over-target day: bar exceeds the hairline; the overflow portion renders in amber `#C9892C` at full opacity — visually reading as "over"
- Under-target day: bar is short of the hairline — no colour change (being under is better than over for the cutting bias in the algorithm)
- Bar corners: 2pt radius top
- No labels on bars (too dense at this scale); tooltip/press on a bar shows "Mon — 1,820 kcal / 1,850 target" in a small popover

This is the MacroFactor "program is ready" pattern: the algorithm's output rendered as a confidence artefact. The data comes from `fitDayToTargets` output already computed per day — this is zero new data, pure visual elevation.

**Layer 4 — Coaching subtitle**

```
Wednesday is ~240 kcal short — try swapping the dinner.
```

- Type: Inter 14pt, regular, `#1B1814` at 80% opacity
- One sentence. Names the worst-short day (existing `worstShort` logic) and the single most-actionable fix.
- At 7/7: "All 7 days land within range." in sage, Fraunces italic 14pt
- Separator: hairline `#ECEAE4` below the subtitle, above day sections

**States:**
- Generating (cold): skeleton placeholder for all 4 layers — 2 skeleton lines (headline + dots), 7 skeleton bars at random heights, skeleton subtitle line. No "Building your plan…" copy here — that lives on the generate button state.
- Regenerating: existing shimmer overlay, unchanged.
- Error: header renders in muted state with "Couldn't load plan summary" in 12pt Inter; regenerate CTA inline.

**Accessibility:**
- VoiceOver: header announces "Week summary: hits targets 5 of 7 days. Wednesday is 240 kcal short." Bar strip has `accessibilityElementsHidden={true}` (it is supplementary to the headline).
- Minimum tap target for dots: 44×44pt invisible hit area centred on each 10pt dot.

**User benefit:** Users understand the week's nutritional quality in under 2 seconds without scrolling. The bar strip communicates "this plan was engineered" — a trust signal unique to Suppr.

---

### 3.2 Per-day section header (day header + macro accounting)

**Current purpose:** Show each day's total kcal vs goal and per-macro deviation, gated by existing band logic.

**Current weaknesses:** See §2.2.

**Benchmark:**
- MacroFactor Nutrient Explorer — range-band track with target tick and % of target: https://mobbin.com/screens/91bff3df-c15e-4d96-ad5f-098b3cd4945f
- Lifesum "OFF TRACK / ON TRACK" per-macro bar with target midpoint line: https://mobbin.com/screens/86e3fefc-23e0-4072-94ef-9ab90af96c82

**Proposed redesign:**

Each day section opens with a day-header card. The card has two zones: an upper summary row and an expanded macro-band row.

**Upper summary row**

```
Wednesday  28 May                    1,825 / 1,850 kcal
```

- Day name: Fraunces 16pt semibold, `#1B1814`
- Date: Inter 12pt, `#1B1814` at 50%
- Kcal readout: Inter 14pt, right-aligned; neutral tone when within ±10%; amber `#C9892C` when over ±10% (existing `dayTotalVsGoal` tone logic, unchanged). Never red — over-budget on macros uses amber per locked rules.
- Row height: 44pt minimum.

**Macro band track row (new — replaces text-only pills)**

Four tracks, laid out as a 2×2 grid below the summary row (P/C top row, F/Fi bottom row), or as a single horizontal scroll row at narrow widths. Each track:

```
Protein   [──────●───────────────────]  156 g
                ↑ target tick
          |←────────────────────────→|
            acceptable band (±10% P / ±15% C,F)
```

Track anatomy:
- Full-width grey rail: `#ECEAE4`, 4pt height, fully rounded
- Acceptable-range fill: `#F6F5F2` with a 1pt border in `#ECEAE4` — the *band* rendered as a shaded region within the rail
- Actual value indicator: 8pt filled circle (terracotta for protein, sage for carbs/fibre, amber for fat). Positioned proportionally on the rail (0 = 0g, 1.0 = target, max = target × 1.5)
- Target tick: 1pt vertical rule in `#1B1814` at 30% opacity, at the target position
- When actual < lower band edge: circle sits left of the acceptable range; rail left-of-circle tinted in amber at 20%
- When actual > upper band edge: circle sits right of the acceptable range; rail right-of-circle tinted in amber at 40%
- When within band: circle within the shaded zone; no tint; sage circle at full opacity
- Label: macro name Inter 11pt left, gram value Inter 12pt semibold right; colour matches circle colour

This is the MacroFactor band-track pattern skinned in Suppr's warm palette. It visualises the `calorieBandPct:5 / carbFatBandPct:15 / protein ±10%` bands that are already computed but currently invisible.

**Residual protein gap hint (preserved)**

When `residualProteinGap < -10g`, a hairline-separated row below the macro tracks:

```
⚠  Library can't fully cover protein this week — the lowest-protein slot is Lunch.
```

- Inter 12pt, amber `#C9892C`, icon `alert-triangle` from lucide-react-native, 14pt
- Fully preserved from current implementation; only restyled to use the track-consistent amber.

**Collapsed/expanded state:**

The macro-band track row is collapsed by default (showing only the summary row). A `chevron-down` affordance at right of the summary row expands/collapses it. The expansion animates in 200ms (spring). First-time open auto-expands for the first day only (educational reveal).

**Accessibility:**
- VoiceOver for the track: "Protein: 156 g, target 165 g, within range" / "Carbs: 220 g, target 180 g, over by 40 g"
- Do not rely on colour alone — the signed gram value is always present as text.

**User benefit:** Users can scan per-day macro adequacy in ~300ms without mentally parsing signed deltas against invisible thresholds. The band track makes the algorithm's tolerance logic legible for the first time.

---

### 3.3 Meal row

**Current purpose:** Show each planned meal (recipe name, slot, estimated kcal, portion) within a day section.

**Current weaknesses:** See §2.3.

**Benchmark:**
- Lifesum "Keto Maintain" meal rows — photo + slot label + name + SWAP: https://mobbin.com/screens/279fafb4-20ed-4488-a5ef-bc7a9c030cc9
- Centr meal row — photo-led, per-row ⇄ glyph, prep time, cooked state: https://mobbin.com/screens/705eaf3c-a294-402a-abd2-730d1eb06136
- Recime "My Meal Plan" — serif recipe name, slot popover: https://mobbin.com/screens/d2bed700-7319-4df6-86a2-573417a53097

**Proposed redesign:**

Each meal row is a card with a 72pt fixed height (single-line recipe name) or 88pt (two-line name). Cards have:

**Card anatomy (left → right):**

1. **Recipe photo thumbnail** (56×56pt, 8pt radius, `#F6F5F2` background if no photo)
   - Meal photography: hyperreal editorial food photography per the locked imagery rule (natural/moody light, ceramic bowls, linen, wooden boards, shallow DoF — @thelittleplantation / @_foodstories_ style). Never flat stock, never watercolour for finished dishes.
   - If no photo: a slot-specific illustration placeholder (breakfast → soft egg illustration; lunch → grain bowl; dinner → plate; snacks → fruit) in the ingredient-illustration style (stylised-photoreal on clean white) — never a generic icon.
   - Recipe-removed badge: if `recipeId` is set but not in library, photo area renders with a `#F6F5F2` fill and a `alert-circle` icon in amber (ENG-766 fix preserved).
   - Leftover rows: photo at 60% opacity with a small "Leftover" label in the corner.

2. **Text block** (flex-1, vertical stack):
   - Slot label: Inter 11pt, `#1B1814` at 50%, uppercase letter-spacing 0.5pt. e.g. "DINNER"
   - Recipe name: Fraunces 15pt semibold, `#1B1814`. One line; ellipsis if overflow.
   - Kcal + portion: Inter 12pt, `#1B1814` at 60%. "~1,240 kcal · 1× portion". The `~` (tilde) prefix is mandatory — these are estimated values per the trust posture; never render kcal without the tilde.
   - "Estimated · verify" chip (when `macrosAreEstimated`): Inter 10pt, amber `#C9892C`, with a `circle-alert` icon 10pt. Tappable — opens the recipe detail for verification. Preserved exactly from current implementation.

3. **Inline swap affordance (new):**
   - A `⇄` glyph (lucide `arrow-left-right`, 16pt) in the top-right corner of the card
   - Colour: terracotta `#C2683E`, tap area 44×44pt
   - Tapping it triggers `swapMeal` directly (no intermediate action sheet step) — the same fit-scored candidate sort and over-target confirm as today, just fewer taps
   - On the action sheet (⋯), "Swap meal" remains as a secondary path

4. **Overflow button:**
   - `⋯` (`more-horizontal`, lucide, 16pt, `#1B1814` at 40%) at bottom-right
   - Opens the existing `rowMenu` action sheet: Log as planned / View recipe / Swap meal / Change portion size / Move to different meal / Remove from plan
   - No items removed from the action sheet

**Leftover rows:**
- Same card structure, photo at 60% opacity, recipe name prefixed "Leftover: " in Inter italic, kcal chip shows "~N kcal · leftover". No swap affordance (leftovers are not swappable — they are derived from parent servings).
- Visually indented by 12pt left margin to create subordination within the day section.

**Add-slot-back chips (preserved):**
- Rendered after the last meal row in each day, as a horizontal chip row: "+ Breakfast" / "+ Lunch" / "+ Dinner" / "+ Snack" for any canonical slot not present in that day.
- Chip style: Inter 12pt, `#1B1814` at 60%, border `#ECEAE4` 1pt, radius 16pt, height 32pt, leading `plus` icon 12pt in sage.

**Interactions (all preserved):**
- Tap row → opens recipe detail (existing behaviour).
- Tap ⇄ → `swapMeal` (new inline path).
- Long press → `rowMenu` action sheet (existing).
- Tap ⋯ → `rowMenu` action sheet (existing).
- Tap portion pill → opens `portionModal` (existing; pill now has a visible underline affordance to signal tappability).
- Tap "Estimated · verify" chip → recipe detail.

**States:**
- Loading: skeleton card (grey rectangle, 72pt height, 8pt radius) × N for each slot.
- Empty slot: dashed-border card, `#ECEAE4` border, `+ Add [SlotName]` centred in Inter 12pt terracotta. Tapping opens the swap candidate picker.
- Logged: a small `check-circle` (sage, 14pt) appears at the top-right of the card alongside the ⇄, replacing it once logged.

**Accessibility:**
- Each card row: `accessibilityRole="button"`, label "{recipe name}, {slot}, estimated {N} kcal, {portion}".
- Swap button: `accessibilityLabel="Swap {recipe name}"`.
- Overflow: `accessibilityLabel="More options for {recipe name}"`.

**User benefit:** Food photography makes the plan feel real and appetising before the user has cooked anything — the primary emotional job of a planner. Inline swap reduces the most-used planner verb from 3 taps to 1.

---

### 3.4 Move-meal sheet (MoveMealSheet)

**Current purpose:** Relocate a meal to a different slot/day; two-way swap if destination is occupied; leftover-aware confirm.

**Current weaknesses:** Functional but no comparable on the market does cross-day macro-aware move — the chrome deserves to match the depth of the feature.

**Benchmark:**
- Recime slot picker popover — labelled icon list, no modal weight: https://mobbin.com/screens/d2bed700-7319-4df6-86a2-573417a53097

**Proposed redesign:**

The move sheet is a bottom sheet (existing `MoveMealSheet.tsx`). Visual changes only:

- Sheet drag handle: 4×36pt pill, `#ECEAE4`, centred
- Sheet header: "Move {recipe name}" in Fraunces 18pt semibold, `#1B1814`. Sub-label: "Select a destination slot" in Inter 13pt, `#1B1814` at 60%.
- Destination slot rows: each row shows slot icon (lucide: `sunrise` for Breakfast, `sun` for Lunch, `moon` for Dinner, `apple` for Snacks), slot name (Inter 14pt), day label (Inter 12pt, muted), and — if occupied — the occupant recipe name in Inter 12pt italic with a `↔ Will swap` badge (terracotta, 10pt).
- The two-way swap logic is preserved exactly. The "Will swap" badge makes it legible that moving to an occupied slot is a swap, not a push.
- Leftover-aware confirm preserved: if clearing N leftovers is required, the existing Alert fires before the move.
- Settle haptic preserved (`Haptics.impactAsync(LIGHT)` on successful move), behind `redesign_winmoment`.

**User benefit:** The "Will swap" badge surfaces the two-way-swap semantics that currently require the user to know the behaviour — it turns a hidden capability into a legible feature.

---

### 3.5 Portion-size modal

**Current purpose:** Re-scale a meal's portion (0.2–2.5 by 0.1 steps) with a live kcal preview. Display snaps to {0.5, 1, 1.5, 2} for legibility.

**Current weaknesses:** Functional; the stepper UI is generic.

**Benchmark:**
- Recime "Confirm serving size" — centred big-numeral ± stepper, "Revert to original": https://mobbin.com/screens/3e18a59e-6e67-4159-bee0-d7116104764d
- Recime "Add items / servings" — live rescale of every ingredient quantity: https://mobbin.com/screens/c0365bb5-38c0-43f6-a5ff-3c1cbe61b229

**Proposed redesign:**

Modal (existing bottom-sheet frame):

- Large centred numeral display: the current multiplier value (e.g. "1.5×") in Fraunces 48pt semibold, terracotta `#C2683E`
- − and + buttons flanking the numeral: 44×44pt circles, border `#ECEAE4` 1pt, radius 22pt; the `minus` and `plus` lucide icons at 20pt in `#1B1814`
- Live kcal preview: "~1,240 kcal estimated" in Inter 14pt, `#1B1814` at 70%, centred below the numeral. Updates on every step. The `~` prefix is mandatory.
- "Revert to original (1×)" secondary button: Inter 13pt, `#1B1814` at 50%, text-only, centred below the preview. Only shown when multiplier ≠ 1.
- Primary CTA: "Apply" — full-width, radius 12pt, terracotta background, Inter 15pt semibold, white label.
- Fine-print: "Portion steps: 0.5× · 1× · 1.5× · 2× in plan view" in Inter 10pt, `#1B1814` at 40% — explains the snap to display values.

**Preserved:** 0.1-step internal granularity (0.2–2.5 range), live kcal calculation from base macros, `snapDisplayMultiplier` logic for display.

**User benefit:** The Recime-style big-numeral ± stepper is the clearest serving control on iOS — it makes the current multiplier unambiguous and "Revert to original" removes a point of anxiety for uncertain users.

---

### 3.6 Generate / Regenerate flow

**Current purpose:** Auto-build a scaled multi-day plan from the library; diff the regenerated plan; communicate progress.

**Current weaknesses:** See §2.5.

**Benchmark:**
- MacroFactor "Your macro program is ready" — 7-day stacked-bar confidence reveal: https://mobbin.com/screens/8a6e223d-86b1-4522-be23-293dc631274f

**Proposed redesign:**

**Generate button (header chrome):**

The generate button lives in the navigation bar header. Two states:
- First-generate (no plan): labelled "Build plan" with a `sparkles` lucide icon (terracotta, 16pt). Label Inter 14pt semibold, terracotta.
- Regenerate (plan exists): labelled "Regenerate" with a `refresh-cw` icon (16pt). Label Inter 13pt, `#1B1814` at 70%.

**Loading state (cold-start):**

Replace the generic "Building your plan…" with a two-phase loading experience:
1. Immediate (0–200ms): the week-overview header shows a skeleton (4 layers greyed out). The day sections show 3 skeleton cards per slot per day.
2. After `InteractionManager` completes (200ms–complete): a small, non-intrusive status chip appears below the header: "Sampling up to 2,000 recipe combinations…" in Inter 12pt, `#1B1814` at 50%, with an indeterminate thin progress line (terracotta, 2pt height, animated across the full chip width). This communicates that computation is happening without being heavy.

The "Building your plan…" 7-dot ribbon is retired. The skeleton structure is more communicative because it previews the plan's layout.

**Post-generate confidence reveal (new, behind `redesign_winmoment`):**

After generation completes and the skeleton resolves:
- The 7-day stacked macro bar strip in the week-overview header populates in a staggered left-to-right animation (each bar fades + scales up with a 40ms stagger, total 280ms).
- The weekday dot row populates simultaneously.
- If 7/7: success haptic fires, headline pulses to terracotta (existing behaviour preserved).
- The diff toast ("N meals changed") remains for regenerate.

Flag OFF (`redesign_winmoment` false): all animations suppressed; bars appear without animation; no haptic; headline is static.

**Regenerate (shimmer overlay):**
The existing shimmer overlay is preserved. Transition: on complete, the shimmer fades out (200ms), the bars re-animate (same stagger).

**Error state:**
Existing Alert ("Couldn't generate plan") preserved. No visual change to the error handling.

**User benefit:** The staggered bar reveal turns plan generation into a product moment — the user sees the algorithm's output assemble itself. It justifies the computational cost visually and builds trust that the plan is engineered, not random.

---

### 3.7 Plan templates sheet

**Current purpose:** Save the current week as a named template; apply a template (replaces week, confirm); delete a template.

**Current weaknesses:** No visual redesign issues in the current implementation — functionality is well-designed. The sheet UI is generic.

**Proposed redesign (visual only, no functional change):**

- Sheet header: "Plan templates" in Fraunces 20pt semibold.
- Template rows: template name in Inter 14pt, creation date in Inter 11pt muted. Apply CTA: terracotta text button "Apply". Delete: `trash-2` icon 16pt, `#1B1814` at 40%, confirming via existing Alert.
- "Save current week as template" CTA at the bottom: full-width card with `bookmark` icon and Inter 14pt label. Tapping opens an `Alert.prompt` for the name (existing).
- Empty state: Fraunces italic 15pt "No saved templates yet. Save a week you like and reuse it anytime." + "Save current week" CTA.

**User benefit:** Visual coherence with the rest of the Plan surface; no functional change.

---

### 3.8 Weekly summary win-moment (redesign_winmoment = true, 7/7)

**Current purpose:** Celebrate when the generated plan hits all 7 targets.

**Benchmark:**
- Cal AI "You're making progress—now's the time to keep pushing!" inline encouragement: https://mobbin.com/screens/dcb0d642-775c-4b72-b651-c1f3954da6db
- Noom "You're done logging — Good work!" coaching card: https://mobbin.com/screens/e004b971-d306-498b-849a-c8c4e5ccb996

**Proposed redesign (gated on `redesign_winmoment`):**

When `summaryScore` first reaches 7/7 (rising edge, same trigger as today):
1. The headline animates to terracotta (existing colour change).
2. The 7 weekday dots all pulse to sage simultaneously (scale 1.0→1.2→1.0, 200ms, spring).
3. The subtitle changes to: "All 7 days land within range. Your week is built." in Fraunces italic 14pt, sage.
4. Success haptic fires (existing `Haptics.notificationAsync(SUCCESS)`).
5. No full-bleed overlay, no confetti. The win-moment is in the data — the bars, the dots, the colour. The product's own visualisation *is* the celebration.

Flag OFF: none of the above. Static text, no haptic, no pulse.

**User benefit:** Celebrates the user's planning achievement in a calm, confidence-building way — consistent with the "calm warm coach" voice. Does not infantilise with confetti; the week-overview bar chart is the evidence of success.

---

### 3.9 Shopping list

**Current purpose:** Auto-generated grocery list from the plan; leftover-skipping; household-scoped; checkable.

**Current weaknesses:** See §2.6.

**Benchmark:**
- Julienne "Shopping List" — serif group headers, per-ingredient thumbnail, "Cooking for 2", checkbox, Clear per group: https://mobbin.com/screens/27a77111-4b82-4982-aec9-e723051f0ce0
- Centr "Create shopping list" — per-meal serve steppers before generating: https://mobbin.com/screens/0cd1ab6d-34d8-4eac-a656-a45d2cc04eb0

**Proposed redesign:**

**List header:**

```
Shopping list
14 items from this week · Household
```

- "Shopping list" in Fraunces 22pt semibold, `#1B1814`
- Subtitle: Inter 12pt, `#1B1814` at 60%. "· Household" in terracotta when `shoppingScope` = household, plain muted when personal.

**Group headers:**

Today groups by recipe. This is preserved as the primary grouping (it is the existing correct behaviour and ties back to the plan). The header for each recipe group:

```
Spaghetti Carbonara   (Mon · Dinner)
[3 ingredients]
```

- Recipe name: Fraunces 15pt semibold
- Meal context: Inter 11pt muted "(Mon · Dinner)"
- "Clear" text button, right-aligned, Inter 12pt, `#1B1814` at 40% — existing behaviour preserved

**Ingredient rows:**

```
[thumbnail] Eggs                    6 large      [checkbox]
```

- Thumbnail: ingredient illustration (stylised-photoreal on clean white — the ingredient rule, not the meal-photography rule), 40×40pt, 6pt radius, `#F6F5F2` background
- Ingredient name: Inter 13pt, `#1B1814`. Checked items: Inter 13pt, `#1B1814` at 40%, strikethrough
- Quantity: Inter 12pt, `#1B1814` at 60%, right-aligned before checkbox
- Checkbox: 22×22pt, radius 11pt (circle), border `#ECEAE4` 1pt unchecked; terracotta fill with white `check` icon 12pt when checked
- Row height: 52pt

**Household "· SHARED" indicator (preserved):**
When `household_id` is set and >1 member: a "SHARED" chip (Inter 10pt, terracotta, border terracotta 1pt, radius 4pt) appears in the list header, and a faint terracotta left-border stripe runs the full height of the list card.

**Empty state:**
"Your shopping list will appear here once you build a plan." with a `shopping-cart` icon (sage, 32pt) and a "Build plan" CTA.

**Deferred / deliberate-or-ticket:**
Aisle/category grouping (produce / protein / dairy / pantry) is a genuine user-experience improvement that every comparable (Julienne, Apple Reminders, Tasty) supports. Today's recipe-based grouping is logical but not how users navigate a store. This is a product call — not pure aesthetics — and is filed separately. It is **not** in scope for this visual redesign pass; it requires a deliberate decision on whether recipe-grouped is a principled choice or a gap. Ticket this: deferred, see ENG-NNN (ticket to be opened).

**User benefit:** Julienne-quality visual shopping list treatment that feels premium and is fast to scan. The per-ingredient illustration rule means no generic icons — the list feels like the recipe, not a spreadsheet.

---

### 3.10 Empty state (no plan or empty library)

**Current purpose:** Guide the user to their first plan generation.

**Current weaknesses:** See §2.4.

**Benchmark:**
- MFP illustrated empty state with warm copy + triple-path CTA: https://mobbin.com/screens/133a7f94-495b-4ee4-82b2-d9f29365c488
- Recime structured-scaffold empty (shows week with empty slots): https://mobbin.com/screens/d2bed700-7319-4df6-86a2-573417a53097

**Proposed redesign (maps to existing `plan_empty_state_v2` flag):**

Two cases:

**Case A: Has library (≥5 recipes), no plan yet:**

Centered card in the plan area:
- A single illustrative image: an empty ceramic bowl on linen, in the hyperreal editorial food-photography style (aspirational, not cartoonish — this is the meal photography rule)
- Headline: "Your week, built for your goals" in Fraunces 22pt semibold, `#1B1814`, centred
- Body: "Add a few recipes and we'll build a week that fits your macros — automatically." in Inter 14pt, `#1B1814` at 70%, centred, 2-line max
- CTA: "Build my plan" — full-width terracotta button

**Case B: Empty library (< threshold):**

Same structure but:
- Headline: "Add recipes to get started"
- Body: "We build your plan from your recipe library. Save a few recipes first, then we'll do the maths."
- CTA: "Browse recipes" → navigates to Recipes tab

**Loading state (cold-start, existing + improved):**
Skeleton preview of the week-overview header (4 layers) + 2 skeleton day cards with 3 skeleton meal rows each. This is more communicative than a generic spinner because it previews where content will appear.

**User benefit:** Warm, goal-referencing empty state that positions the plan as a value proposition ("fits your macros — automatically") rather than a technical prerequisite ("add recipes first").

---

### 3.11 Free→Pro gating (3/7-day chip)

**Current purpose:** Lock 3-day and 7-day plan lengths for Free users; route to paywall.

**Current weaknesses:** See §2.7.

**Benchmark:**
- Julienne "Pro ☀️" badge — calm, aspirational premium signifier: https://mobbin.com/screens/27a77111-4b82-4982-aec9-e723051f0ce0
- MFP crown badge on locked control: https://mobbin.com/screens/7fb7f8b7-b998-4c3f-988a-d1bddb85d674

**Proposed redesign:**

- Replace the generic Lock icon with a calm "Pro" text badge: Inter 10pt semibold, terracotta `#C2683E`, background `#FBF0E9` (very light terracotta tint), radius 4pt, 4×8pt padding. Sits in the top-right corner of the locked 3-day and 7-day chip.
- The chip itself is not greyed out — it is fully visible and styled, with the Pro badge as the only lock signal. This is Julienne's approach: show the value, badge the gate.
- Tapping the chip shows the existing Alert "Available with Pro" + route to `/paywall?from=meal_planner`. Alert copy: "7-day plans are a Pro feature. See what else Pro unlocks →" — warmer than "Available with Pro."
- Optional (consider for implementation): a `~` preview of a 7-day plan beneath the chip-sheet, rendered at 20% opacity behind a frosted glass overlay — "blurred preview" paywall pattern. This is a product call; flag it here but do not require it.

**User benefit:** Calmer, more brand-consistent Pro signal that does not read as punitive. The terracotta badge is consistent with the rest of the Plan surface's accent usage.

---

### 3.12 Plan slot switcher (named plans)

**Current purpose:** Create / rename / delete / switch between named plan slots; switcher hidden at 1 slot.

**Current weaknesses:** Generic pill styling; rename/delete uses `Alert.prompt` which is correct for iOS but could use slightly more polish.

**Proposed redesign (visual only):**

- Switcher pills: horizontal scroll row, pills in Inter 13pt, `#1B1814`. Active pill: terracotta background, white text, no border. Inactive: `#F6F5F2` background, `#ECEAE4` border, `#1B1814` text.
- "+" add-plan pill: same inactive style with a `plus` icon 12pt, label "New plan".
- Long-press on active pill: contextual menu (native iOS) with "Rename" and "Delete" — replacing `Alert.prompt` with a UIContextMenuInteraction is a minor polish upgrade. Preserve the confirm-before-delete behaviour.

**User benefit:** Consistent with the overall Plan surface's pill/chip language; no functional change.

---

### 3.13 Plan sub-tab pill bar (Plan / Shopping)

**Current purpose:** Switch between the plan view and the shopping list.

**Proposed redesign:** No structural change. Restyle to match the plan's pill language: active = terracotta background + white Inter 13pt; inactive = `#F6F5F2` background + `#1B1814` at 70%. Add a `shopping-cart` icon (14pt) to the Shopping tab label.

---

## 4. Visual specification (design tokens)

### Colour

| Token | Hex | Role in Plan surface |
|---|---|---|
| `--ink` | `#1B1814` | All body text, headings |
| `--ink-muted` | `#1B1814` at 60% | Secondary text, dates, labels |
| `--ink-subtle` | `#1B1814` at 40% | Tertiary text, overflow icons |
| `--surface` | `#FFFFFF` | Page background |
| `--card` | `#F6F5F2` | Card and chip backgrounds |
| `--border` | `#ECEAE4` | Hairlines, rails, card borders |
| `--primary` | `#C2683E` | Terracotta — CTAs, active chips, inline swap icon, protein macro track, Pro badge, display numerals |
| `--secondary` | `#7C8466` | Sage — hit-day dots, within-band track fills, carb macro track, success states |
| `--amber` | `#C9892C` | Over-budget day total, short-day dot, out-of-band macro indicator, fat macro track, residual-protein hint |
| `--success` | `#5E7C5A` | (Reserved for Today tab calorie ring under-budget state; not used in Plan) |

### Typography

| Role | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Screen title | Fraunces | 28pt | 600 | Week-overview headline |
| Day name | Fraunces | 16pt | 600 | Day section header |
| Recipe name in row | Fraunces | 15pt | 600 | Meal row recipe title |
| Section header / sheet title | Fraunces | 20–22pt | 600 | Templates, shopping, modals |
| Portion stepper numeral | Fraunces | 48pt | 600 | Portion modal display |
| Win-moment subtitle | Fraunces | 14pt | italic | "All 7 days land within range" |
| Body / labels | Inter | 12–14pt | regular | All secondary text |
| Macro labels | Inter | 11pt | regular | Track labels |
| Gram values | Inter | 12pt | 600 | Track values |
| Kcal readout in day header | Inter | 14pt | regular | Daily kcal vs goal |
| Estimated · verify chip | Inter | 10pt | regular | Trust chip |
| Slot label on row | Inter | 11pt | regular uppercase | Slot name above recipe |

### Spacing and radius

| Element | Radius | Padding |
|---|---|---|
| Meal row card | 12pt | 12pt horizontal, 10pt vertical |
| Macro band tracks | 4pt (rail) | none |
| Pro badge | 4pt | 4×8pt |
| Generate button pill | 8pt | 8×16pt |
| Shopping ingredient row | 8pt (thumbnail) | 12pt horizontal |
| Bottom sheet drag handle | 2pt | 16pt top |
| Day header card | 0pt (inline, no card background) | 16pt horizontal |

### Imagery rules (plan-specific application)

- Meal row thumbnails: hyperreal editorial food photography — natural/moody light, ceramic, linen, wooden props, shallow DoF. Source from `recipe.image_url` when available; placeholder ingredient illustrations when not.
- Empty state illustration: a single editorial food composition (ceramic bowl on linen, from above, soft natural window light).
- Shopping list ingredient thumbnails: stylised-photoreal ingredient illustrations on clean white (the ingredient rule, not meal photography). These are the same `FoodImageThumbnail` components used elsewhere.
- Never: flat stock photography, cartoon food icons, loose watercolour for either meal rows or shopping list.

---

## 5. Web parity notes

The web `/plan` is a 7-column kanban grid (mobile is a continuous list). These structural divergences are intentional and documented in `MealPlanner.tsx:144-146`. The redesign applies the following to web:

- **Week overview header:** apply the 7-day stacked macro bar strip as a week-header banner across all 7 columns. The weekday dot row collapses into the column header (each day's column header shows the dot colour behind the day label).
- **Macro band tracks:** apply the same track design in each day column's header area (collapsible).
- **Meal card thumbnails:** same photography/illustration rules apply.
- **Inline swap affordance:** apply the ⇄ inline affordance to web cards (currently swap is a Dialog button — keep the Dialog, promote it to a visible icon on the card).
- **Move-meal gap (ENG-699):** this spec does not close ENG-699 (web lacks MoveMealSheet entirely). The redesign spec preserves the mobile feature and explicitly does not remove it. The web gap remains open per ENG-699.
- **Per-day macro breakdown on web:** `MealPlanner.tsx:144-146` explicitly cuts this from the prototype rewrite. This redesign spec recommends **restoring** the per-day macro breakdown on web as part of this pass — the parity gap weakens the web product. File as an implementation note for executor.
- **Portion stepper on web:** `MealPlanner.tsx:144-146` cuts this. Recommend restoring in the same pass as macro breakdown. Implementation note only.
- **Typography:** Fraunces is the web serif stack (already in use on landing); apply to the Plan kanban headers and recipe card names.

---

## 6. Motion and haptics

| Event | Mobile motion | Haptic |
|---|---|---|
| Plan generated (first time) | Staggered bar strip reveal (280ms, 40ms per bar) | None |
| 7/7 win-moment | Weekday dots pulse (200ms spring), headline colour transition | `Haptics.notificationAsync(SUCCESS)` |
| Meal swapped | No structural animation | None |
| Move completed | None | `Haptics.impactAsync(LIGHT)` — settle |
| Portion applied | None | `Haptics.selectionAsync()` |
| Regenerate diff | Shimmer fade-out (200ms), bars re-animate | None |
| Tab switch (Plan ↔ Shopping) | Horizontal slide (native iOS tab) | None |

All motion and haptics gated on `redesign_winmoment`. Flag OFF = no animation, no haptic.

Web: no Haptics API. Motion: CSS transitions only (200ms ease-out). Respect `prefers-reduced-motion` — all animations disabled.

---

## 7. Microcopy guide (calm warm coach voice)

| Context | Current copy | Proposed copy |
|---|---|---|
| Week-overview headline (7/7) | "Hits your targets 7 of 7 days" | "Hits your targets 7 of 7 days" (unchanged — it works) |
| Week-overview subtitle (7/7) | "All 7 days land on target." | "All 7 days land within range. Your week is built." |
| Week-overview subtitle (short day) | "Wednesday is ~240 kcal short. Add a snack or swap the dinner." | "Wednesday is ~240 kcal short — try swapping the dinner." (shorter, same intent) |
| Residual protein hint | (existing) | "Your recipe library can't fully cover protein this week — the lowest-protein slot is Lunch." |
| Generate button (no plan) | "Generate ▾" | "Build plan" |
| Generate button (plan exists) | "Generate ▾" | "Regenerate" |
| Loading status chip | "Building your plan…" | "Sampling recipe combinations…" |
| Post-generate diff toast | "Plan updated — N meals changed" | "Plan updated — N meals changed" (unchanged — it works) |
| Empty state (has library) | "Add a few recipes first" | "Your week, built for your goals" + "We build your plan from your recipe library — automatically." |
| Empty state (no library) | "My library is empty" | "Add recipes to get started" + "Save a few recipes, then we'll do the maths." |
| Locked plan-length chip | "Available with Pro" alert | "7-day plans are a Pro feature. See what else Pro unlocks →" |
| Portion modal revert CTA | (none / existing varies) | "Revert to original (1×)" |
| Swap action sheet item | "Swap meal" | "Swap meal" (unchanged) |
| Move action sheet item | "Move to different meal" | "Move to different meal" (unchanged) |
| Shopping list header | "N items from this week" | "N items from this week · Household" (when household-scoped) |
| Estimated kcal prefix | (no prefix / varies) | "~" prefix mandatory on all estimated kcal values per trust posture |
| "Estimated · verify" chip | "Estimated · verify" | "Estimated · verify" (unchanged — correct) |

All copy follows the trust posture: "~" on all kcal, no health claims, no prescriptive language about outcomes.

---

## 8. Accessibility checklist

- [ ] All meal row cards meet 4.5:1 contrast ratio for recipe name text against `#F6F5F2` card background (Fraunces 15pt semibold #1B1814 on #F6F5F2: passes AA, verify AAA).
- [ ] Macro band tracks do not rely on colour alone — gram values are always present as text alongside the track.
- [ ] Day header kcal amber tint (#C9892C on #FFFFFF): verify 3:1 minimum for non-text elements (track dots and bar segments are non-text, requiring 3:1 per WCAG 2.1 1.4.11).
- [ ] VoiceOver labels on all interactive elements: meal rows, swap button, overflow button, portion pill, add-slot chips, weekday dots, bar strip (hidden from VoiceOver — supplementary to text headline).
- [ ] Minimum tap target: 44×44pt on all interactive elements.
- [ ] Portion modal ± buttons: 44×44pt, labelled "Decrease portion" / "Increase portion".
- [ ] `prefers-reduced-motion`: all animations and bar-strip reveals disabled on web.
- [ ] Dynamic Type: Fraunces and Inter scale with iOS Dynamic Type. Test at Accessibility XL (headline will wrap — test wrap behaviour for "Hits your targets 7 of 7 days").

---

## 9. FUNCTIONALITY PRESERVED checklist

Every feature, data point, algorithm constant, and interaction from the functional audit (Input A) is accounted for below. Items marked **IMPROVED** have an aesthetic or accessibility upgrade. Items marked **PRESERVED** are unchanged. Nothing is marked REMOVED.

### Algorithm (mealPlanAlgo.ts)
- [x] `ALL_MEAL_SLOTS` = Breakfast/Lunch/Dinner/Snacks — **PRESERVED**
- [x] `SLOT_WEIGHTS` (0.25/0.30/0.35/0.10) — **PRESERVED** (not exposed in UI; algorithm unchanged)
- [x] `MEAL_PLAN_SAMPLER_CAP` = 2000 — **PRESERVED**
- [x] 60% top-half bias — **PRESERVED**
- [x] `MEAL_PLAN_RECENCY_PENALTY` / `RECENCY_RESET_DAYS` — **PRESERVED**
- [x] `DEFAULT_PLANNER_BANDS` (calorieBandPct:5, carbFatBandPct:15) — **PRESERVED AND VISUALISED** (bands now rendered as range-band tracks in day header)
- [x] `scoreMealSet` asymmetric calorie penalty (×3 over / ×1.5 under) — **PRESERVED**
- [x] Protein ×4 priority — **PRESERVED**
- [x] Same recipe twice in a day → Infinity hard reject — **PRESERVED**
- [x] `PORTION_MULTIPLIER_CLAMP` {min:0.5, max:2.0, step:0.5} — **PRESERVED**
- [x] Deviation-from-1 penalty ×18 — **PRESERVED**
- [x] `fitDayToTargets` protein→calories→carbs→fat→fibre priority — **PRESERVED**
- [x] `snapMultipliersTowardOneWhileFeasible` — **PRESERVED**
- [x] `coerceMacrosWhenCaloriesButNoGrams` → `macrosAreEstimated` flag → "Estimated · verify" chip — **PRESERVED**
- [x] Zero-signal filter (0 kcal + 0 P/C/F dropped) — **PRESERVED**
- [x] Independent-slot fallback, 3× retry — **PRESERVED**
- [x] Duplicate-day rejection, 3× retry — **PRESERVED**

### Data points and metrics
- [x] `fetchPlanTargetsFromProfile` — **PRESERVED**
- [x] `summaryScore` "Hits your targets N of M days" (±10% calorie band) — **PRESERVED AND VISUALISED** (headline + dot row)
- [x] `worstShort` / worst-short subtitle — **PRESERVED**
- [x] `planWeekHeadlineTone` (win/progress/calm) + colour + pulse + haptic behind `redesign_winmoment` — **PRESERVED**
- [x] `dayTotalVsGoal` day-header kcal display — **PRESERVED**
- [x] Amber for over-budget day total (never red per locked rules) — **PRESERVED**
- [x] Per-day P/C/F/Fi delta — **IMPROVED** (text pills → range-band tracks; signed gram values preserved as text layer)
- [x] `planMealFiberG` fibre sum — **PRESERVED AND VISUALISED** (fibre track in the 2×2 macro grid)
- [x] Residual protein gap hint (< −10g threshold, lowest-protein slot named) — **PRESERVED**
- [x] Per-meal estimated kcal on row — **PRESERVED** (with mandatory `~` prefix)
- [x] Portion pill {0.5×, 1×, 1.5×, 2×} display snap — **PRESERVED**
- [x] Shopping item count subtitle — **PRESERVED**

### Interactions
- [x] Generate / `generatePlan` — **PRESERVED AND IMPROVED** (loading state improved; post-generate bar reveal added behind flag)
- [x] Shopping list auto-rebuild on generate — **PRESERVED**
- [x] `meal_plan_generated` event emit — **PRESERVED**
- [x] Regenerate diff toast "N meals changed" — **PRESERVED**
- [x] Cold-start skeleton — **IMPROVED** (structure-preview skeleton replaces generic shimmer)
- [x] Regenerate shimmer overlay — **PRESERVED**
- [x] Over-budget day → amber kcal + amber macro deltas — **PRESERVED**
- [x] Swap over-target confirm "Over calorie target" — **PRESERVED**
- [x] `rowMenu` actions: Log as planned / View recipe / Swap meal / Change portion size / Move to different meal / Remove from plan — **PRESERVED** (all 6 actions)
- [x] Empty slot → only Swap/Move/Remove in rowMenu — **PRESERVED**
- [x] `logAsPlanned` → `nutrition_entries` insert + `fetchPlannedMealMicros` — **PRESERVED**
- [x] `swapMeal` → `recipeSlotFitScore` sort + re-fit day + over-target confirm — **PRESERVED AND IMPROVED** (also accessible via inline ⇄ without action sheet)
- [x] Portion-size modal (0.2–2.5 by 0.1, live kcal preview) — **PRESERVED AND IMPROVED** (Recime ± stepper styling + "Revert to original")
- [x] `handleMove` / `moveMealInPlan` two-way swap — **PRESERVED**
- [x] Leftover-aware move confirm — **PRESERVED AND SURFACED** (now visible as "Will swap" badge in MoveMealSheet)
- [x] Add-slot-back chips for missing canonical slots — **PRESERVED**
- [x] Recipe-removed badge (ENG-766 fix, library-loaded gate) — **PRESERVED**

### Behavioural mechanisms
- [x] `redesign_winmoment` flag gate (colour/pulse/haptic at 7/7; generate/move settle haptics) — **PRESERVED AND EXTENDED** (dot pulse + bar reveal added behind same flag)
- [x] Leftovers: `distributeLeftovers`, "Leftover of X" rows, shopping-list skip, `plan_leftovers_generated` event — **PRESERVED AND VISUALLY DIFFERENTIATED** (subordinated by 12pt indent + 60% photo opacity)
- [x] Named plan slots: create/rename/delete/switch, switcher hidden at 1 slot — **PRESERVED AND IMPROVED** (UIContextMenu for rename/delete)
- [x] Templates: save/apply/delete, events `plan_template_created/applied` — **PRESERVED**
- [x] Household-aware shopping: `shoppingScope`, household_id, "· SHARED" indicator — **PRESERVED AND IMPROVED** (terracotta left-border stripe in shopping list for household scope)
- [x] Free→Pro gate: 1-day free, 3/7-day locked chips → paywall `/paywall?from=meal_planner` — **PRESERVED AND IMPROVED** (Pro badge styling + warmer Alert copy)
- [x] `cachedUserTier` free-flash prevention — **PRESERVED**

### AI / coaching surfaces
- [x] Deterministic macro sampler (no LLM) — **PRESERVED** (always stated as "algorithm" not "AI" in microcopy)
- [x] Worst-short-day coaching subtitle — **PRESERVED AND IMPROVED** (shorter, clearer copy)
- [x] Residual-protein-gap hint — **PRESERVED**
- [x] "Estimated · verify" trust chip — **PRESERVED**
- [x] Regenerate diff toast — **PRESERVED**
- [x] North-star "what to eat next" (`northStarSuggestion.ts`) stays on **Today** — **CONFIRMED NOT MOVED**

### Persistence
- [x] `save_meal_plan` atomic RPC — **PRESERVED**
- [x] `meal_plan_days` + `meal_plan_meals` nested embed load — **PRESERVED**
- [x] Fibre backfill via `enrichPlanDaysFiber` — **PRESERVED**
- [x] **Silent save failure** (`console.warn` only, no prod alert) — **FLAGGED** as a correctness weakness in §2.9; not a feature; implementation should add a user-visible error state on save failure (recommend a non-blocking toast: "Changes couldn't be saved. Check your connection." — file as ENG-NNN)

### Dead code (not carried forward)
- [x] `{false && plan && (…)}` ~180-line dead block (planner.tsx:3611–3792) — **NOT CARRIED FORWARD** (redesign does not reference it; should be deleted in implementation pass)
- [x] Plan import (`plan_import_enabled`, flag-OFF) — **NOT SURFACED** (spec does not include import UI; remains flag-gated)

---

## 10. Items to ticket (not in scope for this spec, require separate decisions)

1. **Silent save failure in prod** — `save_meal_plan` fails silently in production; should surface a non-blocking toast. File: ENG-NNN (silent deferral rule: must be ticketed, not left as a code comment).
2. **Shopping list aisle/category grouping** — every grocery comparable groups by produce/protein/dairy/pantry; Suppr groups by recipe. This is a product call. File: ENG-NNN.
3. **Blurred 7-day plan preview behind Pro paywall gate** — optional conversion lift; requires visual mocking first. File: ENG-NNN.
4. **Web macro breakdown and portion stepper restoration** — `MealPlanner.tsx:144-146` explicitly cut these; this spec recommends restoring both as part of the parity push. File: ENG-NNN (ties to ENG-699 move-meal web gap).
5. **Web move-meal gap** — ENG-699 remains open. This spec documents the mobile feature as preserved; web implementation is separate.

---

*Spec written against functional audit as of 2026-06-02. Implementation must run a full diff against `planner.tsx` at implementation time to confirm no algorithm changes have shipped since audit.*

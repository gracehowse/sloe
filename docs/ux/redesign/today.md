# Today / Home Dashboard — Best-in-Class Redesign Spec

**Version:** 1.0  
**Date:** 2026-06-02  
**Author:** documentation-system (from audit by executor + Mobbin benchmark)  
**Status:** ⚠️ **LARGELY IMPLEMENTED as of 2026-06-08** — most of this spec shipped across May–June 2026 (serif ring numeral, visible Remaining/Consumed toggle pill, forward "Plan your day… No rush." coach line, single-letter week strip, greeting line, serif macro tiles, north-star photo hero with "Fits your day" chip, "Fresh start" empty chip). **Verify against the LIVE iOS app before treating any item as "to build" — do not re-implement shipped work.** Remaining gaps are detail-level, not structural. All flag paths must be preserved during any implementation. (Verified via sim capture 2026-06-08: `apps/mobile/screenshots/agent/today-current-state-2026-06-08.png` + `today-current-scrolled-2026-06-08.png`.)  
**Cross-ref:** `apps/mobile/app/(tabs)/index.tsx`, `src/app/components/NutritionTracker.tsx`, `docs/ux/mobbin-refs/warm-coaching-direction.md`

---

## 1. Surface overview

**Purpose:** The product's primary surface. Everything the user needs to know about today — how much they have eaten, how much budget remains, what to eat next, and how their week is tracking — in a single scrollable view that opens every session.

**Role in the product:** The spine. Plan, Recipes, and Progress are branches off Today. Today holds the north-star moment ("what to eat next"), the macro engine, the streak ritual, and the adaptive coaching layer. It is the surface most likely to be the *only* screen a returning user opens.

**Navigation position:** Bottom tab 1 (`(tabs)/index.tsx`). testID `screen-today`. Deep-link `?openLog=1` opens the log sheet directly.

**Platform notes:**
- iOS is the primary surface (Grace's rule — iOS leads, web follows in parity).
- Web route: `src/app/components/NutritionTracker.tsx` (legacy 2,671-line file; web Today lives here).
- Documented intentional divergences retained in this spec; undocumented divergences flagged for resolution.

---

## 2. Current design audit — weaknesses across the full surface

### Information architecture
- **Week mode is undiscoverable.** The Day/Week toggle was removed 2026-05-22. Week view still renders but is only reachable via the day-strip or calendar picker. From a cold-open, week mode is invisible. No best-in-class comparable hides a full view mode behind calendar-only selection. This must be resolved: either restore a visible affordance or delete the week branch entirely.
- **Section ordering is inconsistent.** The north-star "what to eat next" block appears below meals for empty-day state, but the deficit insight, fasting pill, and macro display all appear above meals. The logical reading order (hero → context → log → what-to-do-next) is interrupted.
- **Activity and hydration cards appear below the log,** which is the right information hierarchy, but there is no visual signal to indicate the scroll-depth — a returning user who already knows their macros may never reach them.

### Visual
- **Consumed/remaining toggle is a hidden long-press.** Users who do not discover the long-press see only one mode. MacroFactor surfaces this as an explicit on-screen pill — the most important budget signal in the product should be one tap, not an undiscoverable gesture.
- **Inner P/C/F sub-rings are also long-press-gated.** Same problem: the macro sub-rings behind the calorie ring are a meaningful analytical differentiator, but they are hidden from users who never discover the gesture.
- **Hero stats row diverges between platforms.** Mobile shows Goal / Food / Bonus; web shows Logged / Target / Burned / Net. These are different stat sets for the same concept. The divergence is undocumented and creates platform inconsistency.
- **Macro tile typography is functional but not warm.** The 2×2 grid uses sans numerals throughout. The locked direction reserves serif display for big numerals. Macro values are exactly the "big numerals" the direction names — they should be in Fraunces or Newsreader.
- **Meal names are rendered in sans throughout.** Per the locked direction, recipe and meal names belong in the serif display face (editorial signature). The log is the primary daily-use surface and should carry the Julienne editorial warmth most visibly.
- **North-star block is styled as a utility card,** not as a hero suggestion. The "what to eat next" moment is Suppr's stated north-star product moment. It currently renders as a compact card with no photography. The locked direction specifies hyperrealistic editorial food photography for finished-dish imagery — this is the exact surface where that rule applies.
- **Streak pip is the sole streak surface on Today.** After removal of `TodayStreakInsightCard`, the streak is only visible as a small pip in the date header. The streak logic (freeze ledger, milestone thresholds, reset detection) is analytically richer than a pip. MacroFactor's habit-grid treats streak as consistency evidence, not a fragile chain — that framing is directly aligned with Suppr's freeze-ledger philosophy.

### Microcopy
- **Greeting was removed 2026-05-22.** No replacement warm opening. The locked "calm warm coach" voice is absent from the cold-open.
- **Empty meal slots show no guidance.** Lifesum renders "Recommended: 461–615 kcal" on empty slots. Suppr's empty slots are silent — a missed behavioural nudge aligned with the "permission, not restriction" positioning.
- **Deficit insight copy is functional but not coaching-voiced.** `NET_DEFICIT_LABEL` reads as a data label, not the calm-coach narrative that builds trust.

### Accessibility
- **Contrast must be verified on ring states.** Prior contrast-audit rounds (2026-05-18) found Tailwind v4 downstream failures. The calorie ring colour states (gradient / success green / destructive red) and the amber over-budget macro state must each pass 4.5:1 on white (#FFFFFF) and on card (#F6F5F2) backgrounds.
- **Long-press gestures have no accessible alternative.** The consumed/remaining toggle and inner sub-ring toggle both require long-press. These must have an accessible tap target (pill or chevron) as the primary affordance; long-press may survive as a power-user shortcut.

---

## 3. Component-by-component redesign

Each section: Current purpose → Current weaknesses → Best-in-class benchmark → Proposed redesign → User benefit.

---

### 3.1 Date header (`TodayDateHeader` + `StreakPip`)

**Current purpose:** Date navigation, avatar, calendar access, streak indicator.

**Current weaknesses:** Greeting removed with no replacement. Streak reduced to a single pip. The warm coach voice is absent from the top of screen.

**Best-in-class benchmark:**
- Lifesum: day-of-week + full date in the header, minimal chrome. [Diary header](https://mobbin.com/screens/36f22404-0afd-4eb9-ba7e-aa0d48c51b17)
- MacroFactor: clean date header, no greeting, streak lives in the habit-grid not the header.
- Oura: "Rise and shine" or "Rest Mode" as a single-line contextual opener tied to the user's current state.

**Proposed redesign:**

Replace the bare date with a two-line opener:

```
[Day, Date]          [avatar]
[Contextual greeting line — calm coach voice, 1 sentence]
```

The greeting line is dynamically generated from the user's current state:
- Empty-day, morning: "Good morning. Your targets are set — log your first meal when you're ready."
- Under-budget, afternoon: "You're on track. [N] kcal remaining for the day."
- Over-budget: "You've gone a little over. That's fine — just worth knowing."
- Streak milestone day: "Day [N]. You've been consistent."
- Goal hit: "Targets met. Good day."

All copy in the calm-warm-coach voice: encouraging, grounded in real numbers, no shaming, no exclamation marks.

**StreakPip redesign:** Retain the pip for at-a-glance streak length. Add a tap affordance: tapping the pip expands to a compact MacroFactor-style habit-grid inline (7 dots for the week, filled = logged, dashed = freeze-protected, hollow = missed), with the streak count. This replaces the need for a separate streak card and makes the freeze ledger visible without a separate screen. The expanded state collapses on a second tap or on scroll.

Typography: date in `text-sm` sans; greeting line in `text-base` sans (not serif — this is body copy, not a display numeral).

**User benefit:** The cold-open is warm and personalised rather than clinical. The streak is meaningful context rather than a decorative pip.

---

### 3.2 Calorie hero ring (`TodayHero` → `TodayHeroRing` → `CalorieRing`)

**Current purpose:** Primary budget signal. Consumed/remaining toggle (long-press). Inner P/C/F sub-rings (long-press). Goal/Food/Bonus stats row. 3-state colour mapping.

**Current weaknesses:**
- Toggle and sub-rings are behind a hidden long-press — undiscoverable.
- Hero stats row diverges between platforms (mobile Goal/Food/Bonus vs web Logged/Target/Burned/Net).
- Central numeral is rendered in sans — the largest number on the screen and the highest-priority opportunity for the editorial serif face.

**Best-in-class benchmark:**
- MacroFactor: explicit Remaining/Consumed pill beneath the ring, Remaining/Consumed/Target as flanking labels, instant readability. [MacroFactor dashboard](https://mobbin.com/screens/6fa1ba1e-263f-4153-a82c-5dbc3dfd1cac) · [Consumed view](https://mobbin.com/screens/6fa1ba1e-263f-4153-a82c-5dbc3dfd1cac)
- Lifesum: colour restate when over budget, 3-stat KCAL LEFT / EATEN / BURNED. [Lifesum over-budget](https://mobbin.com/screens/2b6433d3-b655-40b4-a9ab-9197331346b5)
- Cal AI: single flame ring, activity-bonus delta inline. [Cal AI home](https://mobbin.com/screens/928beeca-5bc5-4dfd-bc7a-d52753bb359a)

**Proposed redesign:**

**Ring:**
- Central numeral: Fraunces or Newsreader, weight 600+, `text-5xl`. The largest element on screen.
- Below the numeral: a label in `text-xs` sans — "remaining" or "consumed" — matching the current mode.
- Inner P/C/F sub-rings: always-visible by default (not hidden). Long-press expands them to show gram values inline. This is a display change only — the ring logic is unchanged.
- 3-state colour mapping: unchanged (gradient / success green #5E7C5A / destructive red). This is a locked canonical rule.

**Toggle:**
- Add a visible 2-state pill beneath the ring: "Remaining · Consumed". Both states are visible; active state is filled terracotta, inactive is outlined. Tapping switches mode. Long-press on the ring survives as a shortcut.
- The pill replaces the hidden long-press as the primary affordance. The long-press may remain but is not the primary discovery path.

**Stats row — unified across platforms:**

Resolve §16.1 divergence. Adopt a unified 3-stat row for both mobile and web, modelled on MacroFactor's ceiling of 3:

| Label | Value | Colour |
|---|---|---|
| Goal | `effectiveCalorieGoal` | neutral ink |
| Eaten | `consumed` | success green (#5E7C5A) |
| Bonus | `goal − baseGoal` (only when activity addon > 0) | amber #C9892C |

When there is no activity bonus, the Bonus tile is hidden and the row shows 2 stats (Goal / Eaten) — cleaner than forcing 3 tiles for users without health sync.

Web parity: `TodayHeroStats` on web adopts the same 3-stat model. The Burned/Net web-only tiles move to the Activity Bonus card (where they belong semantically — they are burn-derived, not ring-derived). The `aiSourcedCount` chip is retained on web as a small inline annotation on the eaten tile.

**Status pills** (`today-status-pills` flag, ENG-753): retain both pill variants. Restyle pills to the locked palette: "On track" in soft sage #7C8466 background, "Adaptive TDEE learning · N of 7 days" in terracotta/faint background. Both pills sit inside the ring card directly below the stats row.

**Spacing and container:**
- Ring card: `bg-white` (#FFFFFF), `rounded-2xl`, `shadow-sm`, `border border-[#ECEAE4]` hairline.
- Padding: `px-6 py-8`.
- Ring diameter: preserve current sizing (it is already generous and calibrated for readability).

**User benefit:** The primary budget signal is instantly readable without discovering a gesture. The serif numeral establishes the editorial register at cold-open. Stats row is consistent on both platforms.

---

### 3.3 Macro display (`TodayDashboardMacroBars` / `TodayDashboardMacroTiles`)

**Current purpose:** P/C/F progress bars or 2×2 tile grid. Tracked-macros Settings control. Net-carbs lens. Sugar/sodium reference. Water tile. "Nutrients" chevron to full micro panel.

**Current weaknesses:**
- Tile values in sans throughout — the locked direction names "big numerals" as the serif case.
- Card background and padding are functional but not warm.
- The "Nutrients" chevron to the full micro panel is the best Cronometer-parity feature Suppr has; it is currently styled as a secondary action and can be missed.

**Best-in-class benchmark:**
- Alma: soft pastel circles, generous padding, "of 2,100" secondary label, warm and approachable. [Alma maintain card](https://mobbin.com/screens/9fc66976-7977-491d-9b1b-32ba3dd1a77c)
- MacroFactor: per-macro 7-day mini-bars with consumed/target — analytically deepest in the set. [Weekly macro bars](https://mobbin.com/screens/77d90b65-1271-40a6-8cb9-4e0ae2565c3b)
- Cal AI: glyph macro tiles with mini progress rings. [Cal AI home](https://mobbin.com/screens/db75399f-1659-4e09-ba4f-926d12503319)
- Bevel: dot-matrix macro fill, ambient and beautiful but sacrifices readability of exact grams — instructive as a counter-example.

**Proposed redesign:**

**Default: 2×2 tile grid** (preserve `macroDisplayStyle` toggle — bars remain available per Settings).

Each tile:
- Container: `bg-[#F6F5F2]` warm-grey card, `rounded-xl`, `p-4`, no additional shadow.
- Top: `Lucide` glyph (Beef/Wheat/Droplets/Leaf + Candy/Gauge/Droplet per tracked set), `text-[#7C8466]` muted sage, size 18.
- Value: Fraunces/Newsreader, `text-3xl`, `font-semibold`, ink #1B1814.
- Unit: `text-xs` sans, `text-[#7C8466]`, inline after value: "g".
- Progress bar: full-width, height 3px, `rounded-full`, track `bg-[#ECEAE4]`, fill per macro colour (protein = terracotta #C2683E, carbs = sage #7C8466, fat = amber #C9892C, fibre = success #5E7C5A).
- Caption: `text-xs` sans — "X g remaining" (success green) or "X g over" (amber #C9892C — per locked over-budget rule for macros, not ring).
- Sugar/sodium: `text-xs` badge "ref" in muted sage. No personal target bar rendered for reference-only macros.
- Net-carbs: label reads "Net carbs" per `netCarbsLensEnabled`; badge "net" in muted sage.

**"Nutrients" chevron:** upgrade to a labelled row button below the tile grid — "Full nutrient breakdown" with a chevron-right. This gives the Cronometer-parity micro panel the discoverability it deserves without cluttering the tile grid. Same destination: `FullNutrientPanelSheet`.

**Pro enhancement (preserve existing tap-to-macro-detail):** tapping a tile routes to `/macro-detail?macro=&date=` as today. Optionally extend the macro-detail screen to show the MacroFactor-style 7-day mini-bar as the chart header — adds trend depth without adding complexity to the Today tile itself.

**Bars variant:** preserve exactly. No visual changes to `TodayDashboardMacroBars` beyond aligning the label typography to `text-xs` sans and adopting the same progress-bar colour tokens.

**All tracked macros preserved:** protein / carbs / fat / fibre / sugar / sodium / water per `tracked_macros` profile setting. Net-carbs lens preserved. Tap-to-detail preserved.

**User benefit:** The macro grid is immediately warmer and more legible. Serif values establish visual hierarchy. The micro-panel becomes a discoverable feature rather than a hidden affordance.

---

### 3.4 Meals section (`TodayMealsSection`)

**Current purpose:** Breakfast/Lunch/Dinner/Snacks slots. Per-slot collapse. Meal rows with source labels and dots. Saved meals. Quick-add accordion. All interactions (log, edit, copy, delete, log-again).

**Current weaknesses:**
- Meal names rendered in sans — the largest text in each row and the highest-value editorial moment in the log.
- Empty slots have no guidance — a missed behavioural nudge.
- Source dots are visible but the colour mapping is not obvious without context.

**Best-in-class benchmark:**
- Lifesum: per-slot recommended kcal range on empty slots — "Recommended: 461–615 kcal". [Empty slot guidance](https://mobbin.com/screens/0e5fbb2b-7323-4a53-9dce-cdc19482fae9)
- MacroFactor: coloured toolbar makes the four entry methods equally discoverable. [Food log with toolbar](https://mobbin.com/screens/495f0664-c3cd-4efd-9e72-6c49d9e1ac5d)
- MyFitnessPal: inline insight chips ("high in saturated fat") turn a passive log into coaching. [MFP diary](https://mobbin.com/screens/91bb25b0-efdf-421a-a03b-6ccb359617d2)
- Julienne: editorial card layout, warm typography, generous whitespace per item.

**Proposed redesign:**

**Slot header:**
- Slot label: `text-sm` sans, caps-locked, ink #1B1814, `font-medium`.
- Slot calorie total: `text-sm` sans, muted sage #7C8466, inline right.
- Collapse chevron: lucide `ChevronDown`/`ChevronUp`, muted sage.
- Empty slot guidance: when the slot has no meals and the user has logging history, render a guidance line in `text-xs` sans, muted sage: "Recommended for [slot]: ~[N] kcal" — derived from the user's targets split across typical meal distribution (breakfast ~25%, lunch ~35%, dinner ~30%, snacks ~10%). This is a nudge, not a target — never block or warn on it. Guidance line absent on first-ever use (too much chrome before first log).

**Meal rows:**
- Meal name: Fraunces/Newsreader `text-base font-medium`, ink #1B1814.
- Macro detail: `text-xs` sans, muted sage. `formatMealMacroDetail` output unchanged.
- Source label: `text-xs` sans, muted sage. `formatMealSourceLabelForRow` output unchanged.
- Source dot: 6px circle, colour per `mapMealSourceToDot`. Add a tooltip/label on long-press of the source dot that explains the source: "From OpenFoodFacts", "USDA database", "AI photo estimate", etc. This makes the provenance transparent (aligned with the trust posture) and reinforces Suppr's moat over trackers that hide sources.
- Timestamp: `text-xs` sans, muted sage, right-aligned. Unchanged (gated `showMealTimestamps`).

**Interactions:** all unchanged. Tap → meal-nutrition route; long-press → edit modal (gated); copy, delete, log-again all preserved.

**Quick-add accordion:** keep as-is. MacroFactor's Favorites toolbar validates the pattern. Typography polish only: section labels in `text-xs` sans caps.

**Saved meals per slot:** keep `hostSavedMeals` one-tap log. No structural change.

**Usual-meal hint:** keep `shouldShowUsualMealHint` per slot, accept/dismiss. Restyle hint as a soft inline card: light terracotta-tinted border, `text-sm` sans.

**User benefit:** Meal names gain the editorial warmth the design direction calls for. Empty slots become coaching moments. Source provenance becomes discoverable without cluttering the default view.

---

### 3.5 North-star "what to eat next" (`NorthStarBlockHost` → `NorthStarBlock`)

**Current purpose:** Algorithmic recipe-fit suggestion for empty days. Multiple kinds (over-budget, new-user, library-empty, no-fit, default suggestion). Per-day skip ledger. CTA routes to recipe.

**Current weaknesses:**
- Styled as a compact utility card with no photography.
- The north-star moment is Suppr's stated product differentiator — it deserves the most visually compelling card on the screen.
- The suggestion kinds other than the default receive the same visual treatment, which flattens their meaning.

**Best-in-class benchmark:**
- Oura: full-bleed image, serif headline, one explanatory sentence, single CTA, calm. [Oura readiness insight](https://mobbin.com/screens/146a11e1-f12f-4536-810a-029788d8a1ce) · [Healthy-habits card](https://mobbin.com/screens/9606969d-6f33-4cc7-8ef9-33d1f56cebbc)
- Lifesum: "Eat more healthy carbs to boost your day rating" — single sentence, goal-connected. [Day rating](https://mobbin.com/screens/f83bc9d1-ad58-4821-9d63-3941e2520488)

**Proposed redesign (default kind — algorithmic suggestion):**

Card container: full-width, `rounded-2xl`, `overflow-hidden`, no external padding (image bleeds to edge inside the card).

Layout:
1. **Image area** (top, ~180px on mobile): hyperrealistic editorial dish photo per the locked meal-photography rule (@thelittleplantation / @_foodstories_ aesthetic — natural/moody light, ceramic bowls, linen, wooden boards, shallow depth of field). Image is the recipe's cover photo; fallback is a curated still-life placeholder. No watercolour, no flat stock.
2. **Content area** (`bg-white`, `px-5 py-4`):
   - Fit chip: `text-[10px]` sans, terracotta-tinted badge, `bandLabel` value (e.g. "Close fit · 94%"). Top-left.
   - Recipe name: Fraunces/Newsreader `text-xl font-semibold`, ink #1B1814, 2-line max then ellipsis.
   - Why-line: `text-sm` sans, muted sage, `whyLineForSuggestion` value. 1 line.
   - CTA: full-width terracotta button, `text-sm font-medium`, "Cook this" or `ctaForSlot` value.
   - Skip: `text-xs` sans link, muted sage, right-aligned — "Show me another". Fires skip ledger write.

**Non-default kinds:**

| Kind | Visual treatment |
|---|---|
| `over-budget` | No image. Warm-grey card. Serif line: "You've hit your target for today." Sans sub-line: "Log more tomorrow if you're hungry." No CTA (already over). |
| `new-user` | No image. Terracotta-tinted card. Serif: "Build your recipe library." Sans: "The more recipes you save, the better your suggestions." CTA: "Browse recipes" → library. |
| `library-empty` | Same as new-user but copy reflects the threshold rule (≥5 recipes / ≥2 for accounts <30 days). |
| `no-fit` | No image. Muted card. Serif: "Nothing fits today's remaining budget exactly." Sans: "Browse your library for something close." CTA: "Browse" → library. |

**All suggestion logic preserved:** fit scoring, `whyLineForSuggestion`, `bandLabel`, `ctaForSlot`, per-day skip ledger (AsyncStorage on mobile, localStorage on web), library threshold (≥5 / ≥2), `showBelowMealsNorthStar` empty-day gate, `userCreatedAt` age check.

**User benefit:** The north-star moment is the most beautiful card on the screen. The hyperrealistic food photography is the viral/retention surface where the locked imagery rule pays off most. The suggestion becomes an aspiration, not a utility prompt.

---

### 3.6 Under-ring coach line (`TodayDeficitInsight`)

> **Shipped 2026-06-04 (Sloe `01 · Today`, Grace "room for dinner is missing"):** this line flipped from BACKWARD ("deficit so far today") to FORWARD ("Room for {meal}…"). The history below the rule is kept for context; the live behaviour is the forward line.

**Current purpose:** Mobile-only. The quiet, centred Newsreader-italic line directly under the ring's stat row. Forward-looking, permission-framed: it answers "what's there room for next?" — the product's positioning (`project_suppr_positioning`: love food *and* have goals → permission, not restriction).

**Copy (shared, `src/lib/copy/today.ts` → `todayRoomForMeal`):**
- Headroom + a next slot → **"Room for {meal} — about {remaining} kcal to play with. No rush."** (e.g. "Room for dinner — about 620 kcal to play with. No rush."). Snacks reads as the singular "a snack".
- Every meal logged but budget remains → **"About {remaining} kcal left for today. No rush."**
- `remaining` is `goal − consumed` (the same number the ring shows as REMAINING, so the line can never contradict the ring).

**HONESTY guardrails:** `todayRoomForMeal` returns `null` (→ render nothing) when `remaining` is below `TODAY_ROOM_MIN_KCAL` (50 kcal) — at/over budget we never claim room the user doesn't have. The call site also only mounts it when `remaining > 0`; the helper owns the floor so the component is correct in isolation.

**Next slot:** `nextUnloggedMealSlot` (shared) walks the canonical eating order Breakfast → Lunch → Dinner → Snacks and returns the first slot today with no logged meal (case-insensitive on `JournalMeal.name`, which *is* the slot on Today). Returns `null` → the all-logged fallback copy above.

**No duplication:** the backward energy-balance TREND (today's net `burn − consumed` + the logged-days rolling average with its 50 kcal noise floor) was REMOVED from this component and now lives ONLY in the Energy balance section (`TodayActivityBonusCard`, §3.x below the ring). The de-card flip (2026-06-03) had already dropped the tinted card chrome; this change replaces the *content* with the forward line while keeping the muted-italic-centred treatment.

**Best-in-class benchmark:**
- Headspace / Fitbit: forward, calm coaching microcopy that frames the day as headroom, not a ledger.
- Oura: one-sentence insight card with grounded reasoning, calm tone. [Healthy-habits card](https://mobbin.com/screens/9606969d-6f33-4cc7-8ef9-33d1f56cebbc)

**Web parity:** still mobile-only (documented carve-out, §16.3). Web never rendered an equivalent under-ring banner (removed 2026-04-18 Pass 7 cleanup); the Net tile + Activity Bonus card cover the energy-balance trend there. The copy + slot helpers already live in `@suppr/shared/copy/today` so web can adopt the forward line identically when it reaches Today parity — no reimplementation.

**User benefit:** The first thing under the ring is now permission-framed and actionable ("you still have room for dinner") rather than a backward audit of a deficit — matching the warm-coaching direction and the "what to eat next" north-star.

---

### 3.7 Weekly check-in ritual (`WeeklyCheckinModal` / `WeeklyCheckinCard`)

**Current purpose:** MacroFactor-grade adaptive coaching. Adaptive-vs-formula TDEE delta. Suggested new daily target. Confidence band. Accept / decline paths. Both flag paths (modal flag-off, inline card `redesign_winmoment` on). Weekly cadence gating.

**Current weaknesses:**
- The analytical content matches MacroFactor but the visual treatment is utilitarian.
- The confidence band and the adaptive-vs-formula delta are the most powerful trust signals on the product — they are not visually prominent enough.

**Best-in-class benchmark:**
- MacroFactor check-in: 7-day stacked macro columns as evidence, "Average Change −55 kcal" header, numbered rationale list, Accept / Decline and Silence. [MacroFactor check-in](https://mobbin.com/screens/2e16f77f-b217-47f5-8630-80ad9945ef83) · [Program design](https://mobbin.com/screens/a854d938-6f50-404f-8c72-ecf9316e5d21)

**Proposed redesign:**

**Analytical content: match MacroFactor exactly** (non-negotiable per the functionality-preservation gate):
- 7-day stacked columns showing per-day consumed vs target.
- Adaptive-vs-formula delta in plain kcal.
- Confidence band displayed.
- Accept / decline with the decline path explicitly "dismiss and silence for this week."
- `shouldShowWeeklyCheckin` gate logic: unchanged (≥ `MIN_DAYS_LOGGED_FOR_CHECKIN` + weekly cadence + weight datapoints).

**Visual treatment — warm skin over MacroFactor depth:**
- Modal header: Fraunces/Newsreader `text-2xl`, "Your week, recalibrated."
- Sub-line: `text-sm` sans, muted sage — dynamically composed: "Based on [N] days logged and [M] weigh-ins, your adaptive target has [changed/held steady]."
- Evidence chart: 7-day columns per MacroFactor. Chart colours per locked tokens: under-budget bars in success green, over-budget bars in amber, target line in terracotta.
- Delta callout: Fraunces `text-xl font-semibold`, signed and coloured (negative = success green "−55 kcal · below target"; positive = amber "+80 kcal · above target").
- Accept CTA: full-width terracotta button — "Update my target."
- Decline: `text-sm` sans link, sage — "Keep current target."

**Flag paths preserved:** modal (flag-off) and inline card (`redesign_winmoment` on) both retain their rendering paths. The inline card uses the same visual tokens at a smaller size.

**WeeklyInsightCard** (`ENG-754`): keep as a separate, lighter card for the "Planning for you this week" summary. The check-in modal/card is the actionable ritual; the insight card is the ambient week-status read. `householdSize={1}` hardcoded note retained (ENG-758 for real household count).

**User benefit:** The analytical crown jewel — Suppr's strongest competitive differentiator against consumer trackers — is now visually proportionate to its depth. The warm skin reduces friction on the accept path.

---

### 3.8 Activity and burn cards (`TodayActivityCard` + `TodayActivityBonusCard`)

**Current purpose:** Steps, steps goal, activity burn. Burn breakdown (total/basal/active/workouts). Adaptive-budget discoverability banner + enable toggle. Maintenance TDEE + source + confidence. Week-window deficit. Provenance sheet.

**Current weaknesses:**
- The activity-bonus math (projected-EOD model, surplus-only, double-counting avoidance) is more sophisticated than any comparable — but it is housed in a plain card with no visual expression of the model learning.
- The `WhereThisComesFromSheet` provenance is valuable but hidden. Users who do not discover it miss Suppr's transparency moat.

**Best-in-class benchmark:**
- Apple Fitness: intraday burn histogram. [Summary with histogram](https://mobbin.com/screens/42ffbbaf-8979-4433-b71f-2b5441a8394a)
- MacroFactor: Expenditure sparkline on the dashboard — the model learning is visible as a live trend. [Dashboard with expenditure](https://mobbin.com/screens/6fa1ba1e-263f-4153-a82c-5dbc3dfd1cac)
- Oura: trend cards with last-value + 7-day avg — 7 data points make the pattern readable instantly. [Oura trend cards](https://mobbin.com/screens/92c03d1b-2437-41ce-866b-fa77d55cd404)

**Proposed redesign:**

**`TodayActivityCard`:**
- Keep existing data: `stepsCount`, `dailyStepsGoal`, `activityBurnKcal`.
- Add intraday step histogram (Apple-style): 24 micro-bars for the hours of the day, filled in terracotta proportional to steps per hour, empty hours in #ECEAE4. This makes the burn feel alive rather than a static number.
- Fallback "Connect health" link: keep exactly; gating logic unchanged.

**`TodayActivityBonusCard`:**
- Add a small MacroFactor-style **maintenance TDEE sparkline**: 7 dots (one per logged day in the window), connected, showing the adaptive maintenance estimate over the week. This makes the model learning visible — directly tied to the "Adaptive TDEE learning · N of 7 days" hero pill.
- Surface `profileMaintenanceSource` and `profileMaintenanceConfidence` as a `text-xs` badge: "Adaptive estimate" (terracotta) or "Formula estimate" (sage). This is the `WhereThisComesFromSheet` summary surfaced inline — the sheet still opens on tap for full provenance.
- Discoverability banner + enable toggle for `prefer_activity_adjusted_calories`: unchanged.
- All burn math unchanged: `computeActivityBonusKcal`, projected-EOD model, surplus-only, fallback to logged workout kcal.

**User benefit:** The activity-bonus model — Suppr's most sophisticated analytical feature — becomes visually legible. Users can see the adaptive estimate updating over the week, which builds trust and reinforces the check-in ritual.

---

### 3.9 Hydration and stimulants card (`HydrationStimulantsCard`)

**Current purpose:** Water (ml, goal, from meals). Caffeine (extra today, target, gated). Alcohol (by day, weekly target, gated). Quick-add presets. Reset per kind. Caffeine/alcohol from per-meal micros (canonical SoT).

**Current weaknesses:** Functional but visually undifferentiated from other cards. The ingredient-illustration style (stylised-photoreal single-subjects on white) could warm the water prompt.

**Best-in-class benchmark:**
- Lifesum: illustrated glass-fill water row — playful, tactile, warm. [Lifesum water](https://mobbin.com/screens/8efe37ce-ce97-4957-9b55-8eeb8ed34b33)

**Proposed redesign:**
- Keep gating logic exactly: card only visible when enabled in Settings. "Track hydration?" fallback link unchanged.
- Water progress: replace the plain progress bar with a soft illustrated fill — a single glass icon (lucide-react-native `GlassWater`) that fills from bottom to top proportional to `totalWaterMl / waterGoalMl`, in the locked success-green token. Not a full Lifesum illustration — the locked imagery rule for ingredients specifies "stylised-photoreal on clean white", which means a clean icon, not a loose watercolour.
- Caffeine / alcohol: unchanged. The per-meal micros canonical SoT is preserved.
- Quick-add presets: unchanged.

**User benefit:** The water progress is more tactile and immediately readable. The overall card is warmer without adding visual complexity.

---

### 3.10 Win-moment overlay (`WinMomentPlayer`) + streak celebration

**Current purpose:** One reserved celebration per calendar day at a landmark. Priority: streak milestone (3/7/30/100) > calorie goal-hit > macro hit. Rising-edge gate. AsyncStorage once-per-day gate. Success haptic. Analytics event.

**Current weaknesses:**
- The celebration must be warm and calm, not bubbly. The current implementation (pre-`redesign_winmoment` flag) may not match the locked voice.
- Alma's "Baby Carrot streak level" is the exact counter-example for Suppr's voice: no animal characters, no gamification labels, no confetti.

**Best-in-class benchmark:**
- Oura: calm headline over imagery, never confetti, haptic is the reward. [Oura rest mode](https://mobbin.com/screens/e9b7815f-8a3e-4774-a777-f0b121901b21)
- MacroFactor: habit-grid reframes streak as consistency — directly matches Suppr's freeze-ledger philosophy. [Nutrition habits grid](https://mobbin.com/screens/6da40b24-2de7-431e-8527-4c102a9330a6)

**Proposed redesign (flag `redesign_winmoment`):**

**Streak milestone win-moment:**
- Full-screen overlay, `bg-white`, centre-aligned.
- Large serif numeral (the streak count) in Fraunces, `text-8xl`, terracotta #C2683E.
- Below: `text-xl` sans — "days consistent." (no exclamation mark)
- Sub-line: `text-sm` sans, muted sage — context-aware copy e.g. "Freeze protection has saved your streak [N] time(s)." or "That's your longest run yet." Never shaming copy on freeze use.
- Haptic: success (already implemented).
- No confetti, no animated characters.
- Dismiss: tap anywhere.

**Goal-hit win-moment:**
- No full-screen overlay. A soft inline card at the top of screen, `bg-[#F6F5F2]`, `rounded-xl`, 3s auto-dismiss.
- Icon: `lucide CheckCircle`, success green.
- Serif headline: "Targets met." Sans sub-line: "Calories and protein on target today."

**Macro hit:**
- Same inline card treatment as goal-hit. Serif headline names the macro: "Protein hit." or "All macros on target."

**Landmark priority logic:** unchanged (`winMomentLandmark.ts`). Once-per-day gate: unchanged. `redesign_motion` haptic on ordinary logs: unchanged.

**User benefit:** The celebration is proportionate to the voice — a streak of 30 days deserves a moment, not a cartoon. The calm treatment makes the celebration feel earned rather than manufactured.

---

### 3.11 Complete Day button

**Current purpose:** Appears today + meals logged. Auto-exports to HealthKit if `health_export_nutrition=true`. Triggers `TodayCompleteDayModal`.

**Proposed redesign:** No structural change. Style as a full-width terracotta outlined button (not filled — the filled terracotta is reserved for primary log CTAs). `text-sm font-medium`. This reduces visual weight at end-of-scroll; "complete day" is a ritual, not the primary action.

---

### 3.12 Planned meals card (`TodayPlannedMealsCard`)

**Current purpose:** Planned meals from Plan tab for the day. One-tap log with portion.

**Proposed redesign:** No structural change. Restyle header to match meal-section slot header treatment. Meal names in serif. Source label "From your plan" in muted sage.

---

### 3.13 Empty, loading, error, and over-budget states

| State | Current | Proposed |
|---|---|---|
| Loading | `Shimmer`/`SkeletonRow` | Retain shimmer; align skeleton height to new card proportions. |
| Empty — brand new | `TodayFirstMealEmptyState` (isBrandNew variant) | Keep. Restyle tip card to warm-grey card with terracotta CTA. Dismiss gesture unchanged. |
| Empty — returning, no meals | North-star + copy-yesterday in Log sheet | North-star becomes the Oura-style hero card (§3.5). Copy-yesterday in Log sheet unchanged. |
| Offline | Offline banner | Keep. Restyle to `bg-[#F6F5F2]` inline banner, `text-sm` sans, sage icon. |
| Error | Load-error banner, tap-to-retry | Keep. Restyle to same inline banner treatment as offline. |
| Over-budget calorie ring | Destructive red (canonical locked rule) | Unchanged — this is the only surface where the prototype's "amber-for-over-budget" rule is overridden. |
| Over-budget macros | Amber `#C9892C` (per prototype rule) | Unchanged. |
| Over-budget sodium | Orange (per prototype rule) | Unchanged. |
| No burn data | Deficit + activity cards self-suppress, "Connect health" link | Unchanged. |
| Goal hit | Win-moment overlay + "Goals hit" toast | Redesigned per §3.10. |

---

## 4. Visual specification — full design token reference

### Colour tokens

| Token | Hex | Use |
|---|---|---|
| Base | #FFFFFF | Page background, card content areas |
| Ink | #1B1814 | All primary text, numerals |
| Card | #F6F5F2 | Secondary card backgrounds, macro tile backgrounds |
| Hairline | #ECEAE4 | Card borders, dividers, skeleton tracks |
| Terracotta (primary CTA / active) | #C2683E | Primary buttons, active states, fit chips, filled CTAs |
| Sage (secondary) | #7C8466 | Secondary text, labels, inactive states, secondary buttons |
| Amber (over-budget / alerts) | #C9892C | Over-budget macros, activity bonus stat, alert states |
| Success green | #5E7C5A | Calorie ring (logged + under), macro fill (protein), goal-hit states |
| Destructive red | token `--destructive` | Calorie ring (logged + over) ONLY |

### Typography

| Role | Face | Weight | Size | Use |
|---|---|---|---|---|
| Display numeral | Fraunces or Newsreader | 600 | `text-5xl` | Calorie ring central numeral |
| Display heading | Fraunces or Newsreader | 600 | `text-3xl` | Macro tile values |
| Section heading | Fraunces or Newsreader | 500 | `text-xl` | North-star recipe name, check-in modal header, win-moment numeral |
| Meal name | Fraunces or Newsreader | 500 | `text-base` | Log meal rows, planned meal rows |
| Body | Inter | 400 | `text-sm` | Insight copy, guidance lines, why-lines, coaching sentences |
| Label | Inter | 400 | `text-xs` | Source labels, macro captions, badge text, secondary data |
| CTA | Inter | 500 | `text-sm` | Button text |

### Spacing and radius

| Token | Value | Use |
|---|---|---|
| Card radius | `rounded-2xl` (16px) | Hero ring card, north-star card, check-in modal |
| Tile radius | `rounded-xl` (12px) | Macro tiles, insight cards, deficit card |
| Small radius | `rounded-lg` (8px) | Pills, badges, quick-add items |
| Page horizontal padding | `px-4` | Screen edge margin |
| Card internal padding | `px-5 py-4` (body), `px-6 py-8` (hero ring) | Per card type |
| Section gap | `gap-3` | Between cards |

### Shadow and border

- Cards on white base: `border border-[#ECEAE4]` hairline + `shadow-sm` (1px 2px 4px rgba(0,0,0,0.05)).
- Tiles on card background: no shadow, no border — the background token provides separation.
- No elevation hierarchy beyond one level: cards float on the page background. No "card on card on card" layering.

### Motion (flags `redesign_motion` and `redesign_winmoment`)

- **Entrance animation** (`useEntranceAnimation`): preserve staggered slide+fade per section (hero → context → macros → meals). Timing unchanged — this is already best-in-class.
- **Win-moment overlay**: fade-in 200ms ease-out. No spring physics on the confetti (there is no confetti). Haptic on appear.
- **Ring state transitions**: colour transition 300ms ease-in-out when ring state changes (empty → green, green → red). This is motion-reduced safe (opacity-only fallback when `prefers-reduced-motion`).
- **Ordinary log confirmation** (`redesign_motion`): quiet selection haptic on `confirmLog()`. Unchanged.
- **All motion must respect `prefers-reduced-motion`**: entrance animation reduces to opacity-only (no translate); ring transition reduces to instant.

### Imagery

- **North-star recipe card** and any finished-dish photo: hyperrealistic editorial food photography — @thelittleplantation / @_foodstories_ aesthetic. Natural/moody light, ceramic bowls, linen, wooden boards, shallow depth of field. Never flat stock, never loose watercolour.
- **Ingredient single-subjects** (anywhere on Today): stylised-photoreal on clean white — the current eggs/blueberries style. Do not change.
- **Icons**: lucide-react-native throughout. No SF Symbol substitutions without cross-referencing the Claude Design bundle.

---

## 5. Information architecture — revised section order

The proposed render order (day view, canonical):

```
1. Activation overlays (FirstLogAcknowledgment, PostOnboardingPushExplainer)
2. TodayDateHeader (date, greeting line, avatar, streak pip → expandable habit grid)
3. Offline / error banners
4. Missed-yesterday line (when applicable)
5. Hero ring card (CalorieRing, toggle pill, stats row, status pills)
6. Macro tiles / bars (tracked macros, "Full nutrient breakdown" chevron)
7. Context block — mutually exclusive, priority order:
   a. Fasting pill
   b. Deficit insight card (when burn data available and in deficit)
8. Meals section (slots, rows, quick-add accordion)
9. North-star card (empty-day-only)
10. WeeklyInsightCard
11. WeeklyCheckinBanner / compact onboarding nudge (when applicable; max one interruption, ENG-1183)
12. TodayFirstMealEmptyState (brand-new, no meals)
13. TodayPlannedMealsCard
14. Activity card (steps histogram)
15. Activity bonus card (burn breakdown, TDEE sparkline, toggle)
16. Hydration & stimulants card
17. Complete Day button
```

**Changes from current order:**
- Deficit insight moved up to position 7 (before meals) so the user sees budget context before the log.
- North-star moved to position 9 (below meals on empty day) — unchanged from current.
- ENG-1183: onboarding/check-in prompt chrome stays below meals and is capped to one compact interruption so the hero ring, status chip, and maintenance rationale remain reachable on cold open.
- Week mode branch: pending resolution of the undiscoverable-toggle issue (see §6.1 below). The week view is not redesigned here until a decision is made on whether it survives.

---

## 6. Cross-platform parity resolutions

The following divergences (from audit §16) are resolved by this spec:

| Divergence | Resolution |
|---|---|
| Hero stats mobile Goal/Food/Bonus vs web Logged/Target/Burned/Net | Unified 3-stat row (Goal/Eaten/Bonus) on both platforms per §3.2. Web's Burned/Net move to the Activity Bonus card. |
| Under-ring coach line mobile-only | Forward "Room for {meal}" line is mobile-only (§3.6). Web has no under-ring banner (removed 2026-04-18); copy + slot helpers live in `@suppr/shared/copy/today` so web can adopt the identical line at Today parity. |
| Eat Again web renders, mobile suppresses | Decision: kill the web banner too, move "eat again" into the Log sheet on both. Mobile's suppression was the correct call (confirmed by MacroFactor/Lifesum pattern — re-log belongs in the log sheet). Implement parity change when Log-sheet-slot-selector ENG-773 ships. |

The following divergence remains intentional (documented carve-out):
- Today dark surface tone: mobile `#0a0a0f` vs web `#101014`. Not changed.

---

## 7. Accessibility requirements

Every redesigned component must meet:
- Minimum 4.5:1 contrast ratio for all text on its background (WCAG AA). Apply `tests/e2e/verify/contrast-audit.spec.ts` pattern across all new token combinations.
- Calorie ring 3 states: gradient (on white — gradient must contain a readable textured section for central numeral), success green #5E7C5A on white #FFFFFF (contrast 3.8:1 — **flag for review**, may require a darker green variant for the numeral's immediate background), destructive red on white #FFFFFF (verify token value meets 4.5:1).
- Amber #C9892C on white #FFFFFF: contrast ~3.5:1 — amber is used only for non-text over-budget indicators (progress bar, badge background), not for text-on-white. If amber appears as text, switch to ink #1B1814 on amber background.
- All interactive affordances have a minimum 44×44pt touch target.
- Long-press gestures: all must have a primary tap-accessible equivalent (no gesture-only interactive features).
- Entrance animations: must respect `prefers-reduced-motion` (opacity-only fallback, no translate).
- Screen reader labels: all lucide icons must carry `accessibilityLabel` props. Source dots must carry `accessibilityLabel` with the full source name (not just the colour).

---

## 8. Feature-flag gate map

All existing flag paths must be preserved. No redesign element may break the flag-off path.

| Flag | Gate | Flag-off behaviour |
|---|---|---|
| `today-status-pills` (ENG-753) | Hero status pills (On-track, TDEE-learning) | Pills hidden — ring and stats row only. |
| `today-edit-entry-v2` | Edit-meal modal, saved-meal portion sheet, portion requests | Long-press → no-op; saved-meal portion sheet absent; portion request absent. |
| `today_log_again` | "Log again" on meal rows | Row action absent. |
| `log-sheet-slot-selector` (ENG-773) | Slot picker in Log sheet | Log sheet opens without slot selector. |
| `redesign_winmoment` (ENG-798/805) | Win-moment overlay, weekly-checkin-as-card | Win-moment absent; check-in renders as modal. |
| `redesign_motion` | Confirm haptic on ordinary logs | No haptic on ordinary log confirm. |

---

## 9. FUNCTIONALITY PRESERVED — complete checklist

Every audited feature, data point, chart, insight, and gate confirmed present in the redesign. No item may be removed in implementation without a separate explicit decision.

### Screen + navigation
- [x] Mobile route `(tabs)/index.tsx`, testID `screen-today`
- [x] Web route `NutritionTracker.tsx`
- [x] Day/week view modes (week branch retained; visible affordance TBD per §6 open item)
- [x] `selectedDate` / `dayKey` date scope; `clampJournalDate` no-future; `MAX_JSONB_DAYS = 90` history cap
- [x] Deep-link `?openLog=1` → log sheet
- [x] Staggered entrance animation (`useEntranceAnimation`)

### Sheets and modals (all 22 surfaces)
- [x] LogSheet (search-first)
- [x] FoodSearchModal
- [x] BarcodeScannerModal (mobile)
- [x] VoiceLogSheet (Pro-gated)
- [x] PhotoLogSheet
- [x] AiPaywallSheet (`voice_log` / `photo_log`)
- [x] CreateCustomFoodSheet
- [x] SaveMealSheet
- [x] SavedMealPortionSheet (gated `today-edit-entry-v2`)
- [x] TodayEditMealModal (gated `today-edit-entry-v2`)
- [x] CopyMealSheet
- [x] DuplicateDaySheet
- [x] PortionPickerSheet / PortionStepper
- [x] FullNutrientPanelSheet (Cronometer-parity)
- [x] WhereThisComesFromSheet (activity / burn)
- [x] WhyThisNumberSheet (Settings → Targets)
- [x] JournalDatePickerModal
- [x] QuickAddPanel (`showPrevious`)
- [x] TodayCompleteDayModal
- [x] WeeklyCheckinModal / WeeklyCheckinCard (both flag paths)
- [x] WinMomentPlayer (flag `redesign_winmoment`)
- [x] Macro detail route, Meal nutrition route, Burn detail route, Health sync route, Fasting route, Weekly recap route

### Hero ring — all data points
- [x] Central numeral: remaining ↔ consumed toggle
- [x] `consumed` = `totals.calories`
- [x] `goal` = `effectiveCalorieGoal` = `max(0, targets.calories + dayActivityBudgetAddon(...))`
- [x] `baseGoal` = `targets.calories` (shown only when activity addon > 0)
- [x] Inner P/C/F sub-rings (`proteinPct`/`carbsPct`/`fatPct`)
- [x] Stats row (unified Goal/Eaten/Bonus)
- [x] 3-state colour mapping: gradient / success green / destructive red
- [x] Status pills (`today-status-pills` flag): On-track pill, Adaptive TDEE learning pill with real `countWeighInDaysInWindow` count

### Macro display — all data points
- [x] 2×2 tile grid default + bars alternative (Settings `macroDisplayStyle`)
- [x] `trackedMacros` from profile Settings
- [x] `dashboardMacroTargets` = base targets scaled by `effectiveMacroTargets`
- [x] Protein / carbs / fat / fibre / sugar (reference-only) / sodium (reference-only) / water tiles
- [x] Net-carbs lens (`netCarbsLensEnabled`): "Net carbs" label, fibre-unknown guard
- [x] Progress bars per macro
- [x] "X g remaining" / "X g over" captions
- [x] Tap → `/macro-detail?macro=&date=`
- [x] "Nutrients" chevron → `FullNutrientPanelSheet`

### Meals section — all data points and interactions
- [x] `MEAL_SLOTS` = Breakfast / Lunch / Dinner / Snacks
- [x] Per-slot collapse (`collapsedSlots`)
- [x] Meal row: title, `formatMealMacroDetail`, `formatMealSourceLabelForRow`, `mapMealSourceToDot`, timestamp (`showMealTimestamps`)
- [x] Tap → meal-nutrition; slot summary tap → slot-nutrition; long-press → edit (gated)
- [x] Copy meal, delete, log-again (gated), portion request (gated)
- [x] `hostSavedMeals` one-tap log
- [x] `shouldShowUsualMealHint` per slot, accept/dismiss
- [x] `AiFirstLogTooltip` (first AI meal row, once)
- [x] `QuickAddPanel` (Favourites / Frequent / Recent / My meals), collapse key

### North-star — all kinds and logic
- [x] `over-budget` / `new-user` / `library-empty` / `no-fit` / default algorithmic kinds
- [x] `whyLineForSuggestion`, `bandLabel`, `ctaForSlot`
- [x] Per-day skip ledger (AsyncStorage mobile / localStorage web)
- [x] Library threshold (≥5 / ≥2 for accounts <30 days, `userCreatedAt`)
- [x] `showBelowMealsNorthStar` empty-day gate (ENG-690)
- [x] CTA routes `/recipe/<id>`

### Under-ring coach line (`TodayDeficitInsight`) — forward "Room for {meal}" (2026-06-04)
- [x] `remaining = goal − consumed` passed from the host (same number as the ring's REMAINING)
- [x] Next unlogged slot via shared `nextUnloggedMealSlot` (Breakfast → Lunch → Dinner → Snacks)
- [x] Copy via shared `todayRoomForMeal` ("Room for {meal} — about {n} kcal to play with. No rush.")
- [x] All-logged fallback ("About {n} kcal left for today. No rush.")
- [x] HONESTY: suppressed below `TODAY_ROOM_MIN_KCAL` (50 kcal) / at / over budget — never claims room that isn't there
- [x] Backward deficit trend de-duplicated → lives only in `TodayActivityBonusCard` (Energy balance)

### Activity and burn
- [x] `stepsCount`, `dailyStepsGoal`, `activityBurnKcal` (`TodayActivityCard`)
- [x] `totalBurnKcal`, `basalBurnKcal`, `activityBurnKcal`, `dayWorkouts`, `todayActivityBudgetAddon` (`TodayActivityBonusCard`)
- [x] `computeActivityBonusKcal`: projected-EOD model, surplus-only, double-counting avoidance, fallback
- [x] `resolveMaintenance` → `maintenanceKcal`, fallback `maintenanceIntakeFromTargetCalories`
- [x] `profileMaintenanceSource` + `profileMaintenanceConfidence`
- [x] Discoverability banner + `prefer_activity_adjusted_calories` toggle
- [x] `WhereThisComesFromSheet` provenance
- [x] `isStepsCardVisible` gate (steps or burn map non-empty); "Connect health" fallback
- [x] Sloe TD1 Energy-balance re-skin (2026-06-04): stat tiles carry the Figma glyphs — Burned = lucide `Flame` (honey/`Accent.activity`), Eaten = `Utensils`, Maintenance = `Target` (muted ink) — as an icon + UPPERCASE label row above the value; the burn/bonus breakdown card re-skinned to Sloe (single calm lucide `Flame`, Newsreader headline number via `Type.headline`, Inter caption/breakdown via `Type.caption`, ≈20px-radius hairline `#F6F5F2` card). Active/Resting/+bonus breakdown, honey `+bonus`, chevron, and F-131 provenance Info icon all preserved. Pinned by `todayActivityCardTd1.test.tsx`.

### Hydration and stimulants
- [x] `totalWaterMl`, `waterFromMealsMl`, `waterGoalMl`
- [x] `extraCaffeineToday`, `targetCaffeineMg` (gated `trackCaffeine`)
- [x] `alcoholByDayMerged`, weekly target (gated `trackAlcohol`)
- [x] Quick-add presets, reset per kind
- [x] Caffeine/alcohol from per-meal `micros` (canonical SoT, not ledger)
- [x] `showHydrationCard` gate; "Track hydration?" fallback

### Behavioural mechanics
- [x] `computeProtectedStreak` + freeze ledger (`availableFreezes`, `readFreezeLedger`)
- [x] `streakResetCopyVisible` detection
- [x] Missed-yesterday nudge (`shouldShowMissedYesterday`)
- [x] `OnboardingNudgeBanner`
- [x] Win-moment: landmark priority (streak milestone > calorie goal-hit > macro hit), rising-edge, once-per-day AsyncStorage gate, success haptic, `day_target_hit_win_moment_shown` event
- [x] Target celebration toast (`targetCelebration` gate)
- [x] Weekly check-in: `shouldShowWeeklyCheckin`, adaptive-vs-formula delta, confidence band, suggested target, accept (persist new target) / decline (all dismiss paths persist decision)
- [x] Push token: `registerExpoPushTokenForUser`, `refreshExpoPushTokenIfChanged`
- [x] Complete Day: `TodayCompleteDayModal`, HealthKit nutrition export (`health_export_nutrition`)

### AI and coaching capabilities
- [x] AI photo log (free taster quota → `AiPaywallSheet` on 403)
- [x] AI voice log (Pro-only, server-enforced `voice_log`)
- [x] North-star algorithmic suggestion
- [x] Weekly check-in adaptive-TDEE coaching
- [x] WeeklyInsightCard "Planning for you this week"
- [x] Provenance sheets (WhereThisComesFromSheet, WhyThisNumberSheet)

### Free vs Pro gating
- [x] AI voice log: Pro-only, server-enforced (`userTier === "pro"`)
- [x] AI photo log: free quota → paywall
- [x] Calorie ring, macros, meals, barcode, manual log, recents, saved meals, hydration, activity, streaks, deficit, north-star, weekly check-in, complete-day: Free (no Today-surface Pro gate)

### Data sources
- [x] `nutrition_journal` JSONB by-day, 90-day cap, immediate persist
- [x] `profiles` (targets, tracked_macros, prefer_activity_adjusted_calories, notification_prefs, weight_kg_by_day, maintenance, pace, goal)
- [x] HealthKit sync (steps, active/basal burn, weight, workouts)
- [x] `savedMeals`, `user_custom_foods`
- [x] Plan tab planned meals (`fetchPlannedMealMicros`, `findPlanDayIdForCalendarDate`)
- [x] AsyncStorage (quick-add collapse, north-star skips, win-moment last-date, first-meal-tip, usual-meal-hint, checkin-banner-dismissal)

### Pull-to-refresh
- [x] `syncHealthDataThrottled(userId, { bypassThrottle: true })` + selection haptic

---

## 10. Open items requiring a decision before implementation

These are not design gaps — they are intentional decision points surfaced by the audit. Each needs a resolved decision before the implementation pass touches that surface.

**10.1 Week view branch**
The Day/Week toggle was removed 2026-05-22. The week view renders but is only reachable via calendar selection. Options: (a) restore a visible toggle affordance (e.g. a segmented control in the date header), (b) delete the week branch entirely and route week insights to the WeeklyInsightCard + WeeklyCheckinCard only, or (c) explicitly document week-view as calendar-only and call it intentional. None of these is the right default for a redesign spec — a product-lead decision is required.

**10.2 Eat Again parity**
This spec proposes killing the web Eat Again banner (§6) to match mobile's suppression and moving re-log into the Log sheet on both platforms. This aligns with MacroFactor/Lifesum patterns and with the dormant-mobile intent. Implementation should be coupled with ENG-773 (Log-sheet slot selector). A product-lead sign-off is needed before removing the web banner.

**10.3 Calorie ring success green contrast**
Calculated contrast of success green #5E7C5A on white #FFFFFF is approximately 3.8:1 — below the 4.5:1 WCAG AA text threshold. The ring fill is non-text (a graphical element, WCAG 3:1 threshold applies), so the fill itself passes. However, the central numeral in the ring renders on top of the ring background — if the ring background can be the success-green fill at full opacity, the numeral must be white or meet 4.5:1 on that green. The current implementation likely handles this (the numeral appears on the dark ring interior, not on the green fill), but this must be verified in the contrast-audit spec before the redesign ships.

---

## 11. Implementation guidance (for executor)

- This spec describes visual and IA changes only. All logic, gating, data pipelines, and analytical models are unchanged.
- Every visual change ships behind a feature flag per the CLAUDE.md non-negotiable rule (`isFeatureEnabled` / mobile equivalent).
- Do not implement a flag that touches visual structure without a before/after screenshot attached to the PR.
- The north-star card redesign (§3.5) requires real recipe cover-photo support in the recipe data model. If cover photos are not available for all recipes, the fallback placeholder must be a curated still-life, not a broken image or a placeholder icon.
- Under-ring coach line on web (§3.6) would be a new web component. It must match the mobile line exactly — do not reimplement the copy or slot logic; import `todayRoomForMeal` + `nextUnloggedMealSlot` from `@suppr/shared/copy/today` (the canonical shared source).
- Unified hero stats row (§3.2) is a cross-platform change. Mobile and web components must be updated in the same commit.
- Typography: if Fraunces or Newsreader is not yet loaded on mobile via Expo Fonts, the font load must be added before any serif numeral is rendered. Fallback: system serif (`Georgia` on iOS). The fallback must be verified in a sim capture before push.

---

## 12. TF57 cohesion fixes — implemented 2026-06-12 (ENG-1065)

Founder TestFlight 57 flagged three Today-scroll cohesion issues (tracker F-158 / F-159 / F-178 / F-179). All shipped in the Wave-2 launch visual program; web parity in the same change.

- **F-158 — "Complete Day button stylistically out of place / floating in dead space."** Root cause: it was the only scroll-body element that skipped the section grammar — an off-rhythm `marginTop: Spacing.lg` (20) where every sibling section uses `Layout.todaySectionBreak` (32), and no section wrapper. Fix (non-structural — no element added/moved/removed): the CTA is now the extracted `apps/mobile/components/today/TodayCompleteDayButton.tsx`, rendered inside a section `<View>` on the standard 32pt cadence so it reads as the day's terminal section. Outline tier + HealthKit nutrition auto-export behaviour preserved. Web twin: the `<button>` in `NutritionTracker` snapped from `mt-4` (16) to `mt-10` (40) to match the web section rhythm. Shipped unflagged (founder-requested spacing fix).
- **F-159 — "Spacing between cards inconsistent / too much."** Census of every page-ground section break in `index.tsx`: Meals / Weekly insight / Planned / Activity / Hydration now all use `Layout.todaySectionBreak` (32). The Planned card previously had NO section break (relied only on the scroll `gap: 8`) — snapped onto 32 to match its siblings. Shipped unflagged.
- **F-178 / F-179 — "Empty plan day styling should match populated days" / "review styling of planned section."** The Planned card used to vanish entirely on empty days (host hid it when `plannedMeals` was empty). It now carries an empty-state branch with the SAME card shell + "Planned" header, a calm "Nothing planned for today" one-liner, and a ghost "Plan your day →" affordance routing to the Plan tab (`/(tabs)/planner` mobile, `/plan` web). Gated behind `today_planned_empty_state` (flag OFF = prior hide-when-empty behaviour, preserved in the host `else`). Implemented in `apps/mobile/components/today/TodayPlannedMealsCard.tsx` + `src/app/components/suppr/today-planned-meals-card.tsx`.

Tests: `apps/mobile/tests/unit/todayPlannedMealsCardPortionPicker.test.tsx` (empty-state RNTL branch, both forks), `tests/unit/todayPlannedMealsCard.test.tsx` (web empty-state branch), `apps/mobile/tests/unit/todayCohesionWiring.test.ts` + `tests/unit/todayCohesionWiringWeb.test.ts` (host source-pins for the section rhythm + flag gates, since the screen files are too large to mount).

Out of lane (NOT touched here): F-160's white-slab meal cards (`TodayMealsSection.tsx`) — awaiting the ENG-1078 flat-card red-line.

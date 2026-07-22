# Weight Tracking — Best-in-class Redesign Spec

**Surface:** Weight logging, trend visualisation, forecasting, milestones, rate-of-loss, charts
**Platforms:** iOS primary (mobile), web parity
**Author:** documentation-system
**Date:** 2026-06-02
**Status:** Spec — not yet implemented

---

## 1. Surface overview

### Purpose
Weight tracking is the feedback loop between nutrition behaviour and body outcome. It closes the loop that every other surface in Suppr opens: "you planned this, you ate this — here is what is happening to your body." Without it, macro tracking is an accounting exercise; with it, it becomes a coaching relationship.

### Role in the product
- **Progress tab anchor** (mobile `(tabs)/progress`): the dominant content type on this tab, co-rendered with streaks, maintenance kcal, and narrative commentary.
- **Adaptive TDEE engine input**: every weigh-in refines the energy-balance estimate that drives calorie targets, "what to eat next," and the trajectory forecast. Weight is not a vanity metric — it is a model input.
- **Milestone and narrative engine**: the 30-day modal, new-low win moment, and journey card all depend on weight data being present and clean.
- **ED-safe surface mode**: `weight_surface_mode` (show / trends_only / hide) is a first-class feature. Any redesign must preserve and surface this control clearly.

### Navigation (mobile)
```
Bottom tab: Progress
  ├── Progress tab (canonical weight home)
  │     ├── Weight chart card (WeightChart.tsx)
  │     ├── Weight trend header (WeightTrendHeader.tsx)
  │     ├── Range toggle (WeightRangeToggle.tsx)
  │     ├── Weight sparse state (WeightSparseState.tsx)
  │     ├── Trajectory card (TrajectoryCard.tsx)
  │     ├── Journey card
  │     ├── Maintenance card
  │     ├── Range-stat tiles (2×2 grid)
  │     └── Apple Health card
  ├── Log Weight sheet (LogWeightSheet.tsx) — 4 entry points
  ├── All-weight-data sheet (AllWeightDataSheet.tsx) — list icon
  ├── 30-day milestone modal (Milestone30DayModal.tsx) — auto-fires
  └── Win-moment overlay (WinMomentPlayer.tsx) — post-save

Stack screen: /weight-tracker (legacy standalone — Phase 3 redirect pending)
Deep link: progress-metric?metric=weight → redirects to Progress tab (no-op screen)
```

### Navigation (web)
```
/account → Progress dashboard (ProgressDashboard.tsx)
  ├── Weight chart (computeWeightTrend + SVG)
  ├── Journey card
  ├── Maintenance card
  ├── Trajectory card (trajectory-card.tsx)
  ├── 30-day milestone dialog (milestone-30-day-dialog.tsx)
  └── Steps + Body Fat inputs (present on web, removed from mobile — documented parity gap)

/account → Targets (Targets.tsx) — current/goal weight + projected reach-date
```

---

## 2. Current design audit

### Global weaknesses

| ID | Weakness | Severity |
|----|----------|----------|
| W1 | The MA smoothing is invisible — users see one line and assume it is their literal weigh-in, not a 28-day calendar-aware moving average. The analytical sophistication is hidden. | High |
| W2 | The range-stat delta tile sits in a 2×2 grid corner, disconnected from the chart it describes. MacroFactor places the stat header *above* the chart, creating a direct read-path. | Medium |
| W3 | Range pills (Week/Month/Quarter/Year/All) have no disabled state for insufficient data. A user with 3 weigh-ins can tap "Year" and see a broken sparse chart with no explanation. | Medium |
| W4 | The scrubber tooltip is functional but unstyled — it does not match the editorial serif-numeral direction. | Low |
| W5 | The log sheet opens with a numeric keyboard but no "current weight" reassurance subline, making it feel cold and transactional. | Medium |
| W6 | `AllWeightDataSheet` rows show no source provenance (manual vs Apple Health). Users cannot tell which rows came from HealthKit and cannot understand why deleting a row sometimes re-syncs back. | High |
| W7 | **RESOLVED (ENG-1651) — no longer a risk.** Was: the win-moment overlay flag (`redesign_winmoment`) is off by default, making the new-low celebration effectively invisible. The flag has since been removed from source entirely — collapsed permanently-on (it was ON in every build since 2026-06-01, i.e. already true when this doc was written 2026-06-02) — so the celebration now fires unconditionally on every new all-time-low. | Resolved |
| W8 | The trajectory card is a single projected-weight number. Bevel-grade multi-period change analysis (3/7/14/30/90d) would provide far more analytical signal at this surface. | Medium |
| W9 | The Journey card milestone markers (25/50/75/100%) are rendered as dots on a progress bar. No badge or typography differentiation distinguishes "reached this milestone" from "ahead of this milestone." | Low |
| W10 | The weight trend header uses Inter for the signed delta numeral. This is the single most important number on the card and deserves a serif-display treatment. | Low |
| W11 | `WeightSparseState` empty copy is functional but not warm. Cal AI's register ("Getting started is the hardest part — you're ready for this!") benchmarks the correct tone. | Low |
| W12 | `progress.tsx` is 4,007 lines. Every redesign touch should extract toward the 400-line screen-file limit (ENG-621). This spec does not require a refactor but flags it as a constraint. | Technical debt |
| W13 | The `weight_surface_mode` toggle is present in data but has no prominent user-facing control on the Progress tab. Users in trends-only mode may not know how they entered it or how to change it. | Medium |

---

## 3. Component-by-component redesign

### 3.1 Weight chart card

**Current purpose:** SVG trend line, MA envelope, goal line, gridlines, X-axis ticks, scrubber. Keyed to `weightChartRange` (Week/Month/Quarter/Year/All).

**Current weaknesses:** W1, W2, W3, W4.

**Benchmark:**
- MacroFactor Scale Weight: https://mobbin.com/screens/e4730836-8f0f-421a-bf91-1585fc7d8f4d
- MacroFactor Goal Progress/Trend toggle: https://mobbin.com/screens/168f1b5c-e0ab-4509-970c-27e4925a37de
- Withings Weight (Quarter): https://mobbin.com/screens/dd9eb17c-bee7-4559-a530-31c0fd240231
- Noom annotated graph: https://mobbin.com/screens/9111b88c-66a6-466f-82a9-60657783bf54

**Proposed redesign**

*Card anatomy (top to bottom):*

```
┌─ Card (#F6F5F2, radius 16, hairline #ECEAE4 border) ──────────────────┐
│ CHART STAT HEADER                                                       │
│   [serif-display 28/32 bold] 74.2 kg       ← current (latest entry)    │
│   [sans caption #7C8466] Average · [period label]                       │
│   [sans body] −1.4 kg  ↓  since [range start date]                     │
│   [range toggle row — see 3.2]                                          │
│                                                                         │
│ TREND / SCALE TOGGLE  (top-right, pill)                                 │
│   [ Trend | Scale ]  — default: Trend                                   │
│   "Trend" = MA line (current behaviour)                                 │
│   "Scale" = raw daily dots (new — makes smoothing legible)              │
│                                                                         │
│ SVG CHART AREA                                                          │
│   background: #FFFFFF                                                   │
│   grid lines: hairline #ECEAE4 (horizontal only, 4 lines)               │
│   MA trend line: terracotta #C2683E, 2px, smooth bezier                 │
│   raw scale dots (Scale mode): #C2683E 3px open circles                 │
│   MA envelope: terracotta 8% opacity fill between ±σ bands              │
│   goal line: muted sage #7C8466, 1px dashed                             │
│   "you are here" vertical line: #1B1814 at 40% opacity                  │
│   latest-entry halo: 8px terracotta dot, 16px transparent ring          │
│   Y-axis labels: Inter 11 #7C8466, right-aligned                        │
│   X-axis ticks: Inter 11 #7C8466                                        │
│   Y-domain: computeYDomain logic preserved exactly                      │
│                                                                         │
│ SCRUBBER TOOLTIP (on tap-drag)                                          │
│   pill: #1B1814 background, 8px radius                                  │
│   serif-display 16 white: weight value                                  │
│   Inter 12 #7C8466 white-80%: date                                      │
│   optional: "↓ new low" micro-badge in terracotta when applicable       │
│                                                                         │
│ STALENESS PILL (when daysSinceLatest > 10)                              │
│   amber #C9892C, sans caption: "Last logged N days ago"                 │
│   CTA: "Log today" → LogWeightSheet                                     │
└────────────────────────────────────────────────────────────────────────┘
```

**States:**

| State | Behaviour |
|-------|-----------|
| Loading | Skeleton tile: animated shimmer (#ECEAE4 pulse), preserves card height |
| Empty (0 weigh-ins) | WeightSparseState (see 3.7) |
| Sparse (1–2 weigh-ins) | WeightSparseState with 2-point mini-chart (keep existing) |
| Insufficient data for range | Range pill greyed (#ECEAE4 text, not interactive); no broken sparse chart |
| Trend mode (default) | MA line + envelope + goal |
| Scale mode (toggle) | Raw daily dots + goal line (no MA) |
| Goal line off-chart | Withheld — do not show cut-off goal line; add "(goal outside range)" caption |
| Error | Inline error card: "Couldn't load chart. Pull to refresh." — no Alert |

**Motion:**
- Chart line draws in (left-to-right path animation, 400ms ease-out) on first render.
- Range switch: crossfade (200ms).
- Trend/Scale toggle: line morphs between MA and raw dots (300ms interpolation — keep same viewBox, animate path `d` attribute).
- Scrubber crosshair: instant (no lag).

**Microcopy (calm-warm-coach voice):**
- Under the stat header when on track: "Moving in the right direction."
- Under the stat header when stalled (|delta| < 0.2 kg): "Weight fluctuates day to day — the trend is what matters."
- Under the stat header when moving away from goal: "A short plateau is normal. Keep logging — the data gets clearer."

**Accessibility:**
- Chart is decorative; expose a text summary via `accessibilityLabel`: "Weight trend: [direction] [delta] over [period]. Latest: [weight]."
- Scrubber announcement on drag: VoiceOver reads weight + date.
- Trend/Scale toggle: full focusable pill with role="tab".

**User benefit:** The Trend/Scale toggle (borrowed from MacroFactor) answers "why does my line not match today's reading" — the single most common user confusion on any smoothed weight chart. The stat header above the chart creates a direct, scannable read-path without hunting for a corner tile.

---

### 3.2 Range toggle

**Current purpose:** Week / Month / Quarter / Year / All pills driving `weightChartRange`.

**Current weaknesses:** W3 (no disabled state for insufficient data).

**Benchmark:** MacroFactor greyed-out insufficient-range pills.

**Proposed redesign:**

```
Pills row (horizontally scrollable on narrow widths):
  [ 1W ] [ 1M ] [ 3M ] [ 6M ] [ 1Y ] [ All ]

Active pill:
  background: #1B1814
  text: Inter 13 semibold #FFFFFF

Inactive pill (sufficient data):
  background: transparent
  text: Inter 13 #1B1814
  border: hairline #ECEAE4

Inactive pill (insufficient data — < threshold entries for range):
  background: transparent
  text: Inter 13 #ECEAE4
  border: none
  interactive: false (not tappable)
  tooltip on long-press: "Log more weigh-ins to unlock this view"

Thresholds (align with existing smart-bucket step-down logic):
  1W: ≥ 1 entry in last 7 days
  1M: ≥ 3 entries in last 30 days
  3M: ≥ 5 entries in last 90 days
  6M: ≥ 7 entries in last 180 days
  1Y: ≥ 10 entries in last 365 days
  All: ≥ 1 entry (always enabled if any data)
```

**Preserve:** all existing `weightChartRange` values and the smart-bucket step-down MA/bucket logic inside `computeWeightTrend` — these are untouched. The redesign is display-only.

---

### 3.3 Weight trend header (direction word + signed delta)

**Current purpose:** Withings-style "WEIGHT: Stable / TREND: ±N kg" two-column header (WeightTrendHeader.tsx).

**Current weakness:** W10 — signed delta rendered in Inter; deserves serif-display treatment.

**Benchmark:** Withings https://mobbin.com/screens/dd9eb17c-bee7-4559-a530-31c0fd240231 (direct ancestor — validated); MacroFactor Average/Difference header.

**Proposed redesign:**

```
┌─ Trend header row ─────────────────────────────────────────────────────┐
│  WEIGHT                        TREND                                    │
│  [serif-display 22 bold]       [serif-display 22 bold]                  │
│  Stable                        −1.4 kg                                  │
│  [sans caption #7C8466]        [sans caption #7C8466]                   │
│  This week                     vs. last week                            │
│                                                                         │
│  Direction arrow: ↓ in muted sage #7C8466 (toward goal)                 │
│                   ↑ in amber #C9892C (away from goal)                   │
│                   → in #7C8466 (stable)                                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Null state (> 14 days since last log):**
```
  WEIGHT                        TREND
  —                             Log weight to see trend
  [#7C8466 caption]             [#7C8466 caption, italic]
```

**Preserve:** `computeWeightTrendTile.ts` business logic exactly — null-if-stale, on-track detection, no-goal-set branch. The redesign is display-only.

---

### 3.4 Trajectory / projected weight card

**Current purpose:** "~{kg} in ~N weeks" forecast from energy balance, overridden by observed scale rate.

**Current weakness:** W8 — single projected number. Bevel's multi-period change table is the benchmark ceiling.

**Benchmark:**
- Bevel Trends Analysis: https://mobbin.com/screens/522ddab2-6b35-4dea-889c-a60767f75809
- Yazio forecast curve (visual shape only): https://mobbin.com/screens/9bb99bb2-df6d-43c1-85c8-36f90c93c51c

**Proposed redesign:**

```
┌─ Card (#F6F5F2, radius 16) ────────────────────────────────────────────┐
│  MULTI-PERIOD CHANGE TABLE                                              │
│  ┌────────┬──────────────┬──────────┐                                  │
│  │ Period │   Change     │ Sparkline│                                   │
│  ├────────┼──────────────┼──────────┤                                  │
│  │ 3 days │  −0.3 kg  ↓ │  ~~\     │                                   │
│  │ 7 days │  −0.6 kg  ↓ │  ~~~\    │                                   │
│  │ 14 days│  −1.1 kg  ↓ │  ~~~~\   │                                   │
│  │ 30 days│  −2.0 kg  ↓ │  ~~~~~\  │                                   │
│  │ 90 days│  −4.2 kg  ↓ │  ~~~~~~\ │                                   │
│  └────────┴──────────────┴──────────┘                                  │
│  [sans caption #7C8466]: Based on 7-day rolling average                 │
│                                                                         │
│  PROJECTED WEIGHT                                                       │
│  [serif-display 28]: ~72.1 kg                                           │
│  [sans body]: in approximately 5 weeks                                  │
│  [sans caption #7C8466]: Estimate — based on observed rate and          │
│  your 7,700 kcal/kg energy balance                                      │
│                                                                         │
│  FORECAST CURVE (SVG)                                                   │
│  Smooth ease-out line: terracotta #C2683E                               │
│  Goal-weight pill anchor: filled circle + label at line terminus        │
│  Today marker: vertical dotted line                                     │
│                                                                         │
│  [Below minimum data threshold: ]                                       │
│  "Log N more days to see your projection"                               │
│  Progress bar: N/5 days (MIN_DAYS_FOR_PROJECTION = 5)                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Multi-period change table — data rules:**
- Each row pulls from `weight_kg_by_day` keyed by period-start / period-end dates.
- A row is greyed and shows "—" if fewer than 2 entries exist in the window.
- Arrows: ↓ in muted sage when direction = toward goal; ↑ in amber when away from goal; → when |delta| < 0.1 kg.
- Sparklines: 20×16 SVG inline, 1px terracotta line, no axes, no labels.

**Preserve:** `computeTrajectory` and `weightProjection.ts` exactly — observed-scale-rate override, `MIN_DAYS_FOR_PROJECTION` floor, 30kg floor, "Log N more days" placeholder logic. The multi-period table is additive: it reads directly from `weight_kg_by_day`, no new computation needed. The single projected number and the 7,700-kcal footnote are preserved verbatim.

**User benefit:** The user can now see whether their short-term fluctuations (3-day) are noisy vs whether the 30-day trajectory is steady. This is the primary question that makes people distrust their scale. MacroFactor charges premium pricing partly for this view — Suppr has the data; this surfaces it.

---

### 3.5 Journey / goal-progress card

**Current purpose:** Goal-anchored narrative — % of the way, days to goal, kg lost / kg to go, milestone markers.

**Current weakness:** W9 — milestone markers are dots on a bar; no badge differentiation.

**Benchmark:**
- Cal AI corner flag pill: https://mobbin.com/screens/1c2836f3-bfa9-4d62-bb0b-1ff046f42dd7
- Zero Journey timeline badges: https://mobbin.com/screens/0430dc4f-1037-49db-bf5d-ec7059eae6d2

**Proposed redesign:**

```
┌─ Card (#F6F5F2, radius 16) ────────────────────────────────────────────┐
│  HEADER ROW                                                             │
│  [serif-display 20]: Your journey         [% flag pill — top right]    │
│                                           terracotta bg, white text     │
│                                           "47% of your goal"           │
│                                                                         │
│  START ANCHOR   PROGRESS BAR              GOAL ANCHOR                  │
│  [78.4 kg]      ████████░░░░░░░░░░░░      [68.0 kg]                    │
│  [sans 12 #7C]  Milestone badges at 25/50/75/100% positions             │
│  "Started"                                "Goal"                        │
│                                                                         │
│  MILESTONE BADGE (at each marker, filled when reached)                  │
│  Reached:   filled terracotta circle, serif "25" inside                 │
│  Not reached: hairline #ECEAE4 circle, sans "25" #7C8466                │
│                                                                         │
│  STATS ROW                                                              │
│  [sans 14 #1B1814]: −5.4 kg lost          ~N weeks to goal             │
│  [sans 12 #7C8466]: since start           at current pace              │
│                                                                         │
│  MICROCOPY (calm-warm-coach)                                            │
│  "Just starting": "Every weigh-in gets you a better picture."           │
│  < 25%: "You're building the data that powers everything."              │
│  25–74%: "You're [N]% of the way. Stay consistent."                    │
│  75–99%: "Almost there — this is the hardest stretch to hold."         │
│  100%: "You reached your goal. What's next?"                            │
│  Stalled (|rate| < 0.1 kg/wk): "Weight can stall for weeks and still   │
│  be on track. The trend is what matters, not the day."                  │
│  cappedAtMaxDays: "Projected at more than a year at current pace."      │
└────────────────────────────────────────────────────────────────────────┘
```

**Preserve:** `weightJourneyProgress` Tukey-robust baseline exactly (no comparable uses a robust peak/trough baseline — Suppr advantage); `formatWeightJourneyProgressCopy`; `calcGoalTimeline`; `MAX_DAYS_TO_GOAL` cap and `cappedAtMaxDays` handling. The flag pill and badge styling are purely additive.

---

### 3.6 Maintenance / adaptive-TDEE card

**Current purpose:** maintenance kcal, adaptive-vs-formula badge, "How this works" expandable explainer (`buildMaintenanceChain`).

**No functional weaknesses** — this card is best-in-class. No comparable exposes adaptive expenditure on the weight surface as well as Suppr does.

**Visual-only improvements (benchmark: Withings "?" explainer; MacroFactor explainer tile):**

```
┌─ Card (#F6F5F2, radius 16) ────────────────────────────────────────────┐
│  HEADER ROW                                                             │
│  [sans 11 uppercase tracking #7C8466]: YOUR MAINTENANCE                 │
│  [serif-display 28]: 2,340 kcal / day                                   │
│  [badge]: Adaptive  ← filled terracotta pill when adaptive;             │
│           Estimated ← outlined when formula fallback                    │
│                                                                         │
│  CONFIDENCE TIER (when adaptive)                                        │
│  ● High confidence · based on 21 days + 7 weigh-ins                    │
│  [muted sage #7C8466, sans 12]                                          │
│                                                                         │
│  EXPLAINER TOGGLE (Withings-style "?" → tap to expand)                  │
│  Collapsed: "Why this number ↓"   [sans 13 #7C8466, underline]         │
│  Expanded: buildMaintenanceChain prose, hairline-separated paragraphs   │
│            "Estimated, not a promise. Based on your logged food         │
│            and weight trend."                                           │
└────────────────────────────────────────────────────────────────────────┘
```

**Preserve:** adaptive/formula badge; full `buildMaintenanceChain` explainer; adaptive TDEE EMA (α=0.1); confidence tiers (high/medium/low); `MIN_LOGGING_DAYS` (7) / `MIN_WEIGH_INS` (3) gates; 6h throttle; 800 kcal floor; `progressDataContract` inputs. Nothing is weakened; the "?" → expand pattern simply replaces the current always-visible expandable.

---

### 3.7 Weight sparse state (0 / 1 / 2 weigh-ins)

**Current purpose:** onboarding nudge when insufficient data.

**Current weakness:** W11 — copy is functional, not warm.

**Benchmark:** Cal AI empty state https://mobbin.com/screens/1c2836f3-bfa9-4d62-bb0b-1ff046f42dd7; Zero empty-chart copy https://mobbin.com/screens/635c49ef-466a-44bf-b546-3d76e21af5f1.

**Proposed redesign:**

```
0 weigh-ins:
  [Illustration: single line on a white ground — minimal, editorial]
  [serif-display 20]: Start your weight story
  [sans 15 #7C8466]: Your first weigh-in unlocks trends, projections,
  and your adaptive calorie target.
  [Primary CTA — terracotta]: Log your weight

1 weigh-in:
  [Mini 2-point chart — keep existing]
  [serif-display 20]: One down
  [sans 15 #7C8466]: Log again tomorrow to see your first trend.
  Every consistent check-in makes the data more accurate.
  [Primary CTA — terracotta]: Log weight

2 weigh-ins:
  [Mini 2-point chart — keep existing]
  [serif-display 20]: Your trend is taking shape
  [sans 15 #7C8466]: Log N more times to unlock your projected weight.
  (N = MIN_WEIGH_INS − 2 = 1 for projection; more for adaptive TDEE)
  [Primary CTA — terracotta]: Log weight
```

**Preserve:** `WeightSparseState.tsx` 2-point mini-chart logic; `MIN_WEIGH_INS` references; CTA routes to `LogWeightSheet`.

---

### 3.8 Log weight sheet

**Current purpose:** fast weigh-in entry and edit mode (keeping date).

**Current weaknesses:** W5 — no reassurance subline.

**Benchmark:**
- Alma entry sheet: https://mobbin.com/screens/0e1430f7-b054-4925-81e8-f318e15e6d34
- MacroFactor entry sheet: https://mobbin.com/screens/0e426d2e-2c8a-4228-8c48-1aa8d790521d
- Lifesum ±0.1 stepper: https://mobbin.com/screens/f57349d1-8050-4eeb-b8f9-3446b865a489

**Proposed redesign:**

```
Bottom sheet (handles at 0.5 / 0.92 snap points)
Background: #FFFFFF, top radius 20px

┌─ Sheet ────────────────────────────────────────────────────────────────┐
│  Handle bar: 4×32px #ECEAE4 pill, centred, 12px top margin             │
│                                                                         │
│  HEADER (edit mode shows date picker here)                              │
│  [sans 13 uppercase #7C8466]: LOG WEIGHT                                │
│  [sans 12 #7C8466 — right-aligned]: Tue 27 May  ← editable date        │
│  (tap date → inline DateTimePicker, keeps date in edit mode)           │
│                                                                         │
│  HERO NUMERAL (Alma-style)                                              │
│  [serif-display 56 bold #1B1814]: 74.3                                  │
│  [sans 20 #7C8466]: kg                 ← unit switches with system pref │
│                                                                         │
│  REASSURANCE SUBLINE                                                    │
│  [sans 14 #7C8466]: Current: 74.5 kg · Last logged Tue 27 May          │
│  (null if no prior weigh-in: blank — do not show "Current: —")         │
│                                                                         │
│  ±0.1 STEPPER ROW (optional, Lifesum-inspired)                          │
│  [−0.1]  [+0.1]  [−1.0]  [+1.0]                                        │
│  pills: hairline #ECEAE4 border, sans 13 #1B1814                        │
│  flanking the numeral; tap adjusts the hero value                       │
│                                                                         │
│  BODY FAT (optional row, collapsed by default)                          │
│  [sans 13 #7C8466]: + Add body fat %    ← tap to expand                 │
│  Expanded: [sans 20 #1B1814]: 18.4 %  + stepper                        │
│  (MacroFactor pattern — keeps body fat in-sheet without cluttering UI)  │
│                                                                         │
│  NOTE FIELD (optional, collapsed — mirrors MacroFactor)                 │
│  [sans 13 #7C8466]: + Add a note         ← tap to expand               │
│  (future: powers "See Note" in scrubber — Noom pattern)                │
│                                                                         │
│  NUMERIC KEYBOARD (system, decimal pad)                                 │
│                                                                         │
│  PRIMARY CTA                                                            │
│  [terracotta #C2683E background, 16px radius, 56px height]              │
│  [Inter 16 semibold white]: Save weight                                 │
│  (edit mode: "Update weight")                                           │
└────────────────────────────────────────────────────────────────────────┘
```

**States:**

| State | Behaviour |
|-------|-----------|
| Loading prior weight | Skeleton subline (shimmer) |
| No prior weight | Subline hidden |
| Edit mode | Date pill shows original date (not today), locked; CTA = "Update weight" |
| New low (on save) | Haptic: success (medium impact); triggers WinMomentPlayer |
| Routine save | Haptic: light impact |
| Error | Alert preserved (existing behaviour); optimistic update rolls back |

**Preserve:** optimistic update + restore-on-error; `refreshAdaptiveTdeeForUser` post-save; edit-mode-keeps-date; scalar `weight_kg` write rule (only when editing the newest entry); unit conversion (kg/lb from `measurement_system`). The ±0.1 stepper, body fat toggle, and note field are additive — they do not change save logic.

---

### 3.9 All-weight-data sheet (full history list, edit/delete)

**Current purpose:** Withings-style scrollable list of every weigh-in with edit/delete.

**Current weakness:** W6 — no source provenance; HealthKit rows look identical to manual rows; no guard against deleting a HealthKit-synced entry.

**Benchmark:**
- Alma entries with source chips: https://mobbin.com/screens/f28eba19-4f70-46e3-aa06-78501c448430
- Zero HealthKit-delete guard: https://mobbin.com/screens/bb25429e-81d5-49ba-b0e7-85aa43e9dfbe

**Proposed redesign:**

```
Row anatomy:
  [serif-display 20 #1B1814]: 74.3 kg     [date — sans 13 #7C8466 right]
  [source chip]                            Tue 27 May 2026
  
Source chips:
  Manual:        [hairline pill, "Manual", Inter 11 #7C8466]
  Apple Health:  [hairline pill, apple-logo glyph + "Apple Health", #7C8466]
  (future sources: Withings, Garmin — same chip pattern)

Row interaction:
  Manual row:      swipe-left → Edit / Delete  (existing behaviour)
  Apple Health row: swipe-left → "Open Health App to delete"
                   (guard: tapping "Delete" shows informational sheet — 
                   "This entry was synced from Apple Health. 
                    Deleting it here will only remove it from Suppr 
                    until the next sync. To permanently remove it, 
                    delete it in the Health app.")

List header:
  [sans 13 uppercase #7C8466 tracking]: ALL WEIGH-INS  (N entries)
  [close button — top right]

Empty state:
  [sans 15 #7C8466 centred]: No weigh-ins yet.
  [sans 14 terracotta]: Log your first weight →
```

**Preserve:** edit mode re-uses `LogWeightSheet` keeping original date; delete confirms via Alert; adaptive TDEE re-runs after edit/delete; the sheet is mobile-only (documented intentional parity gap — web AllWeightDataSheet does not exist; do not create it in this spec).

---

### 3.10 30-day milestone modal

**Current purpose:** fires once on Progress focus after ≥30 distinct logged days. Surfaces avg daily kcal, top-3 foods, longest streak, total weight delta.

**No functional weaknesses** — the content Suppr computes (top-3 foods, streak, total delta with null guard) exceeds every comparable's celebration screen in data richness.

**Visual improvement (benchmark: Zero serif badge — https://mobbin.com/screens/0430dc4f-1037-49db-bf5d-ec7059eae6d2):**

```
Modal sheet (centred, 340px wide, white, radius 20)

  BADGE (top centred)
  Circular seal: 80px diameter
  Outer ring: terracotta #C2683E 2px hairline
  Fill: #F6F5F2
  Text: serif-display "30" large, "DAYS" caption below in sans uppercase

  HEADLINE
  [serif-display 26]: Thirty days in
  [sans 15 #7C8466]: Here's what your data tells us.

  STAT ROWS (hairline-separated)
  Avg daily kcal:  [serif 20 #1B1814]  1,847 kcal
  Top foods:       [sans 14 #7C8466]   Eggs · Oats · Greek yoghurt
  Longest streak:  [sans 14 #7C8466]   12 days
  Weight change:   [sans 14 #7C8466]   −2.4 kg since you started
  (null guard: weight-change row hidden when < 2 weigh-ins — existing rule)

  CTA
  [terracotta full-width]: Keep going
```

**No confetti.** Calm, editorial, one terracotta flourish (the seal ring). Matches the locked calm-warm-coach voice.

**Preserve:** `milestone30Day.ts` computation exactly — 30 distinct days (not consecutive); `milestone_30_shown_at` fires-once guard; top-3 foods skips HealthKit titles; weight delta null-guard; no fabricated +0.0.

---

### 3.11 New-low win moment

**Current purpose:** quiet celebration when weight hits a new all-time low after the first weigh-in.

**Flag state:** removed. `redesign_winmoment` collapsed permanently-on (ENG-1651) — the flag was ON in every build since 2026-06-01, and the flag check has since been deleted from source. The redesign's flag-on target below is now simply the unconditional behaviour.

**Benchmark:** Zero milestone seal styling (adjacent reference — no weight-specific win-moment found in Mobbin).

**Proposed redesign:**

```
Full-screen overlay (dim background #1B1814 at 60% opacity)
Centred card (300px wide, #FFFFFF, radius 20)

  [sans 11 uppercase terracotta tracking]: NEW ALL-TIME LOW
  [serif-display 28 #1B1814]: 73.8 kg
  [sans 15 #7C8466]: Your lowest recorded weight.
  Keep logging — every weigh-in sharpens the picture.
  
  [terracotta full-width CTA]: Great
```

**No confetti, no animation other than a single fade-in (200ms).** The understatement is intentional — it is a calm confirmation, not a celebration-jolt.

**Preserve:** `weightWinMoment.ts` `isNewWeightLow` exactly — strictly below prior minimum by ≥ `NEW_LOW_EPSILON_KG` (0.05 kg); first weigh-in never counts. No flag gate remains — `redesign_winmoment` collapsed permanently-on (ENG-1651).

---

### 3.12 Today adaptive-TDEE learning pill

**Current purpose:** in Today hero — shows weigh-in count from last 7 days toward adaptive TDEE confidence (`countWeighInDaysInWindow`, ENG-758).

**No redesign needed** — this component was just updated (ENG-758) to use real weigh-in counts. Preserve as-is; apply serif-numeral token for the count digit to stay in sync with the weight surface type scale.

---

### 3.13 `weight_surface_mode` control

**Current state:** present in data (`weight_surface_mode`: show / trends_only / hide) but no prominent user-facing surface control on Progress tab. Users may not know how to change it.

**Proposed addition (not in current code — flag this as a new requirement):**

Inside Progress tab settings or a dedicated "Weight display" row in Settings:

```
Weight display
  ○ Show weight numbers
  ○ Show direction only (no numbers)  ← trends_only mode
  ○ Hide weight tracking              ← hide mode

[sans 13 #7C8466]: You can change this any time.
```

This is a new requirement. The spec records it but the redesign does not implement it — route to executor as a follow-up. No Linear issue created in this doc; the implementor must open one.

---

## 4. Visual token specification

### Colours (locked system — no deviations)

| Use | Token | Hex |
|-----|-------|-----|
| Page background | `--background` | `#FFFFFF` |
| Card surface | `--card` | `#F6F5F2` |
| Ink / primary text | `--foreground` | `#1B1814` |
| Secondary text / axis labels | `--muted-foreground` | `#7C8466` |
| Card border | `--border` | `#ECEAE4` |
| Primary CTA / active / trend line | `--primary` (terracotta) | `#C2683E` |
| Secondary / goal line / sage accents | `--secondary` | `#7C8466` |
| Over-budget / stale alerts / away-from-goal arrows | `--amber` | `#C9892C` |
| Toward-goal / positive delta | `--success` | `#5E7C5A` |
| Destructive (delete, error) | `--destructive` | system red |

**No coloured-block chart backgrounds.** Chart area is always `#FFFFFF`.

### Typography

| Role | Typeface | Size / Weight | Use in weight surface |
|------|----------|---------------|----------------------|
| Serif display | Fraunces or Newsreader | 28–56 / Bold | Hero weight numeral, card stat values, milestone headline |
| Serif body | Newsreader | 20–22 / Regular | Trend delta, direction words |
| Sans label | Inter | 11–13 / Regular | Axis ticks, captions, source chips, period labels |
| Sans body | Inter | 14–15 / Regular | Explainer copy, microcopy |
| Sans semibold | Inter | 13–16 / Semibold | Range pills active, CTA labels |

### Spacing and radius

| Token | Value | Use |
|-------|-------|-----|
| Card radius | 16px | All weight cards |
| Sheet radius | 20px (top corners only) | Log sheet, all-data sheet |
| Card padding | 20px | Inner card spacing |
| Section spacing | 16px | Between cards on Progress tab |
| Milestone badge | 80px diameter | 30-day modal, win-moment |
| CTA height | 56px | Log Weight, Save buttons |

### Chart specific

| Element | Style |
|---------|-------|
| Trend line | Terracotta `#C2683E`, 2px, smooth bezier |
| MA envelope | Terracotta 8% opacity fill |
| Goal line | Muted sage `#7C8466`, 1px dashed |
| Grid lines | `#ECEAE4`, 1px, horizontal only (4 lines) |
| Raw-scale dots | `#C2683E`, 3px radius, open circles |
| Latest-entry halo | 8px filled terracotta + 16px transparent ring |
| Background | `#FFFFFF` — never a gradient or tinted fill |
| Scrubber tooltip | `#1B1814` pill, serif-display 16 white |

---

## 5. Information architecture — Progress tab (mobile)

### Card order (both layout variants — confirm against flag `design_system_elevation`)

The redesign targets the **flag-on** (`progressLayoutV2`) path as the intended layout. Card order recommended:

1. Weight trend header (WeightTrendHeader) — direction word + signed delta
2. Range toggle (WeightRangeToggle)
3. Weight chart card (WeightChart) — Trend/Scale toggle in-card
4. Trajectory card (TrajectoryCard) — multi-period table + projected number
5. Journey card — goal progress + flag pill + milestone badges
6. Maintenance card — adaptive TDEE + confidence + "Why this number"
7. Range-stat tiles (2×2)
8. Apple Health card
9. Streak / freeze card (not weight-specific, co-rendered on Progress)

### Accessing all-weight-data sheet
Entry point: list/clock icon in the weight chart card header (existing — keep).

### Log Weight entry points (all four preserved)
1. Scale icon in Progress tab header
2. Trend tile tap
3. Sparse state "Log weight" CTA
4. Journey card "Log today" CTA (when stale pill shown)

---

## 6. Accessibility

- **Weight value input:** `accessibilityLabel="Weight in kilograms, currently 74.3"`, `accessibilityRole="adjustable"` for stepper.
- **Chart:** `accessibilityLabel="Weight trend chart: [direction] [delta] over [period]. Latest reading: [weight] on [date]."` — chart SVG itself is `accessibilityElementsHidden`.
- **Range toggle pills:** `accessibilityRole="tab"`, `accessibilityState={{selected, disabled}}`.
- **Trend/Scale toggle:** `accessibilityRole="tab"`.
- **All milestone badges:** `accessibilityLabel="[N]% milestone — [reached / not yet reached]"`.
- **Source chips in AllWeightDataSheet:** `accessibilityLabel="Logged via [Manual / Apple Health]"`.
- **Win-moment overlay:** `accessibilityLiveRegion="polite"`, auto-dismissed after 4 seconds or on tap.
- **30-day milestone modal:** `accessibilityViewIsModal={true}`.

---

## 7. Web parity notes

The following spec items apply to web (`ProgressDashboard.tsx`, `trajectory-card.tsx`, `milestone-30-day-dialog.tsx`, `Targets.tsx`) with these caveats:

| Item | Mobile | Web | Status |
|------|--------|-----|--------|
| Trend/Scale toggle | Implement | Implement (same `computeWeightTrend` shared lib) | New parity item |
| Multi-period change table | Implement | Implement | New parity item |
| Milestone badge styling | Implement | Implement | New parity item |
| Source chips | AllWeightDataSheet (mobile-only) | No per-day list on web — documented intentional gap | Keep as gap |
| HealthKit-delete guard | Mobile only | N/A | Not applicable to web |
| Log sheet ±0.1 stepper | Implement | Implement equivalent (web uses click/type) | Adapt |
| Steps + Body Fat cards | Not on mobile weight-tracker | Present on web ProgressDashboard | Documented divergence — do NOT remove from web |
| 6M/9M/12M chart ranges | Present on /weight-tracker | 5 ranges only on web | Documented divergence — no change required |

---

## 8. FUNCTIONALITY PRESERVED checklist

Every feature, data point, chart, insight, and gating from the audit must survive the redesign. This checklist is the acceptance gate.

### Data model
- [x] `weight_kg_by_day` JSONB map — day-keyed, 400-day pruning (`pruneByDay`) — preserved
- [x] `goal_weight_kg` scalar — preserved
- [x] `body_fat_pct` scalar — preserved (surfaced in log sheet body-fat toggle)
- [x] `weight_surface_mode` (show/trends_only/hide) — preserved; control gap flagged for follow-up
- [x] `measurement_system` (kg/lb) unit conversion at 2.20462 — preserved
- [x] `adaptive_tdee`, `adaptive_tdee_confidence`, `adaptive_tdee_updated_at`, `milestone_30_shown_at` — all preserved
- [x] `steps_by_day` — not on this surface (moved to Burn detail mobile; still on web ProgressDashboard)

### Chart & calculation logic
- [x] `computeWeightTrend` — dedup, bucket (daily/weekly/monthly), smart step-down, calendar-aware MA (7d short / 28d long), `computeYDomain` with goal-inclusion logic — preserved exactly
- [x] Trend/Scale toggle — additive (does not change the MA; adds a raw-dot mode layer)
- [x] `resolveLatestWeightKg` — by-day map wins over scalar — preserved
- [x] Range delta (last − first in window, arrow, semantic tone, "since <date>" fallback) — preserved
- [x] `computeWeightTrendTile` — delta logic, null if >14 days stale, on-track, no-goal-set — preserved
- [x] Trend status stable if |delta| < 0.2 kg — preserved

### Adaptive TDEE
- [x] `adaptiveTdee.ts` EMA (α=0.1), 7,700 kcal/kg, floor 800 — preserved
- [x] Confidence tiers: high (≥21 days, ≥7 weigh-ins), medium (≥14, ≥5), low otherwise — preserved
- [x] `MIN_LOGGING_DAYS` = 7, `MIN_WEIGH_INS` = 3 gates — preserved
- [x] Persisted only at medium/high confidence — preserved
- [x] 6h throttle (`refreshAdaptiveTdee.ts`) — preserved
- [x] `countWeighInDaysInWindow` in Today pill (ENG-758) — preserved

### Trajectory / forecast
- [x] `computeTrajectory` — `MIN_DAYS_FOR_PROJECTION` = 5, observed-scale-rate override (|observed| ≥ 0.05 kg/wk, direction agrees), 30 kg floor — preserved
- [x] `projectWeight` energy-balance calc — preserved
- [x] "Log N more days" placeholder with progress bar — preserved
- [x] 7,700 kcal/kg basis footnote — preserved
- [x] Multi-period change table — additive (reads `weight_kg_by_day` directly, no new computation)

### Journey / goal progress
- [x] `weightJourneyProgress` Tukey-robust baseline (peak/trough, 540-day lookback) — preserved
- [x] `pct = moved/total` clamped 0–1, suppressed if total < 0.1 kg — preserved
- [x] `formatWeightJourneyProgressCopy` — preserved (supplemented by redesigned microcopy)
- [x] `calcGoalTimeline` — weekly rate, days-to-goal, 365-day cap, stalled if |rate| < 0.1 kg/wk — preserved
- [x] 25/50/75/100% milestone markers — preserved (promoted to badge style, not removed)

### Milestone moments
- [x] `milestone30Day.ts` — 30 distinct logged days, avg kcal (food days only), top-3 foods (skips HealthKit titles), longest streak, weight delta (null if < 2 weigh-ins) — preserved
- [x] `milestone_30_shown_at` fires-once guard — preserved
- [x] `weightWinMoment.ts` — strictly below minimum by ≥ 0.05 kg, first weigh-in never counts — preserved
- [x] Win-moment celebration behaviour — preserved; the `redesign_winmoment` flag itself is **removed (ENG-1651)** — collapsed permanently-on, so this is no longer a gate

### Interactions
- [x] Optimistic update + restore-on-error + Alert on failure — preserved
- [x] `refreshAdaptiveTdeeForUser` post-save — preserved
- [x] Edit mode keeps original date — preserved
- [x] Scalar `weight_kg` only updated when editing newest entry — preserved
- [x] Edit/delete in AllWeightDataSheet re-runs adaptive TDEE — preserved
- [x] Chart scrubber crosshair — preserved (restyled)
- [x] 30s query timeout race — preserved (not visual, no change)

### ED-safe / inclusive design
- [x] `weight_surface_mode` trends_only — shows direction words, never absolute kg — preserved
- [x] `weight_surface_mode` hide — suppresses surface entirely — preserved
- [x] Digest "Logging consistency N/7" when hidden — preserved

### Gating
- [x] Weight tracking is FREE (not Pro-gated) — preserved and explicitly confirmed in this spec
- [x] All weight surfaces remain free: logging, charts, trend, journey, projection, milestones, adaptive TDEE — preserved

### Platform-specific features
- [x] HealthKit / Apple Health sync (mobile-native) — preserved; source chips in AllWeightDataSheet make sync provenance visible
- [x] HealthKit historical import depth card on /weight-tracker — preserved
- [x] `progress-metric?metric=weight` deep-link as redirect to Progress tab — preserved (not resurrected as a screen)
- [x] AllWeightDataSheet mobile-only — preserved (not ported to web in this spec)

### Screens / surfaces preserved
- [x] Progress tab (canonical weight home) — redesigned
- [x] /weight-tracker standalone (Phase 3 redirect pending) — not touched in this spec
- [x] LogWeightSheet — redesigned
- [x] AllWeightDataSheet — redesigned
- [x] Milestone30DayModal — redesigned
- [x] WinMomentPlayer — redesigned
- [x] Today adaptive-TDEE learning pill — preserved
- [x] Onboarding weight step — not in scope of this spec
- [x] Web ProgressDashboard + trajectory-card + milestone-30-day-dialog — parity items noted; no regressions

### Feature count summary
- 8 screens / sheets / surfaces: preserved
- 14 chart/calculation behaviours: preserved
- 7 adaptive TDEE rules: preserved
- 5 trajectory/forecast rules: preserved
- 5 journey/goal-progress rules: preserved
- 6 milestone/celebration rules: preserved
- 8 interaction rules: preserved
- 3 ED-safe/inclusive rules: preserved
- 3 gating rules: preserved
- 4 HealthKit/Apple Health integration rules: preserved

**Total: 63 audited features/rules — all preserved or improved (none dropped).**

---

## 9. New requirements flagged (route to executor)

These are gaps identified by this spec that are not currently implemented. Each needs a Linear issue before implementation.

| Item | Description | Priority |
|------|-------------|----------|
| `weight_surface_mode` settings UI | User-facing control to change between show/trends_only/hide — currently has no visible control on Progress tab | High |
| Trend/Scale toggle on chart | Expose the existing MA as a named "Trend" mode; add raw-dot "Scale" mode | High |
| Greyed-out insufficient-range pills | Range pills non-interactive when data threshold not met | Medium |
| Multi-period change table | 3/7/14/30/90-day rows feeding the trajectory card | Medium |
| Source chips in AllWeightDataSheet | Manual vs Apple Health provenance per row | High |
| HealthKit-delete guard | Guard against deleting a HealthKit-synced row without a warning | High |
| Cal AI flag pill on Journey card | "N% of goal" pill in corner of Journey card | Low |
| Milestone badge styling | Filled terracotta badges at 25/50/75/100% milestone markers | Low |
| Log sheet reassurance subline | "Current: N kg · Last logged [date]" below the hero numeral | Medium |
| Log sheet ±0.1 stepper | Fine-adjust stepper flanking the hero numeral | Low |
| Log sheet note field | Optional note field → future "See Note" scrubber integration | Low |

---

## 10. Implementation flag

All visual and structural changes in this spec must ship behind a feature flag per CLAUDE.md non-negotiable rules. Recommended flag name: `weight_surface_redesign`. Gate the new path; leave the existing path alive in the `else`. Ramp via PostHog dashboard after before/after screenshots are captured on iOS and web.

---

*This spec is the canonical design brief for the weight tracking surface redesign. It is a product specification document — it does not replace implementation, tests, or a cross-platform review. Those are required before any Roadmap row is marked Shipped.*

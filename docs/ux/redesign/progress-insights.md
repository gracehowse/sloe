# Progress Insights — Best-in-Class Redesign Spec

**Surface:** Progress tab (mobile `apps/mobile/app/(tabs)/progress.tsx`; web `src/app/components/ProgressDashboard.tsx`)
**Date:** 2026-06-02
**Status:** Design spec — not yet implemented
**Flag gate required:** `progress_redesign_v2` (visual/structural change, must ship behind flag per CLAUDE.md)
**Author:** docs-system
**Inputs:** full functional inventory (product spec) + Mobbin benchmark (Input A + B above)

---

## 1. Surface overview

### Purpose
Progress is the **story surface** of Suppr — not a dashboard of raw numbers, but the place where a user's logged behaviour becomes a coherent narrative. It answers: "How am I actually doing?" It earns trust through honesty (confidence visibility, "estimates" language, suppress-when-lying narrative logic) and through analytical depth that rivals MacroFactor without the cold spreadsheet aesthetic.

### Role in the product
The four-tab spine is: **Today** (log, "what to eat next") → **Plan** (week ahead) → **Recipes** (import, browse) → **Progress** (the reckoning). Progress is a pull surface — users arrive when they want a bigger picture, after streaks of daily logging. It must reward that arrival. Every week without a digest, every weigh-in without a trend, is a missed return-loop.

### Navigation
- **Mobile:** bottom tab, testID `tab-you`, label "Progress". `LogWeightSheet` (bottom sheet), `AllWeightDataSheet` (Withings-list), `WinMomentPlayer` overlay, `Milestone30DayModal`.
- **Web:** `/home?view=progress` (product shell). `ProgressMetricDetail` deep-drill via `?metric=calories|protein|streak`. `/weight-tracker` legacy route (keep for backwards compat).

### Platform note
iOS is the primary surface. All redesign decisions below are specified mobile-first; web equivalents are noted per component. The web-only `ProgressMetricDetail` drill-down (currently absent on mobile) should be treated as a roadmap gap (see §6 Parity Gaps).

---

## 2. Current design — weaknesses audit

### Information architecture
- **Card stack is undifferentiated.** All cards render at roughly equal visual weight. The adaptive TDEE engine (the most computationally sophisticated thing in the product) gets the same card chrome as a static 7-bar chart. No hierarchy communicates: "here is the insight that matters most this week."
- **Hero metric (`ProgressHeroMetric`) is a number without a story.** Adherence % or avg cals shown alone. No week-range label, no delta, no one-line narrative immediately following it. Users arriving at the tab have no immediate orientation — just a number floating above a pile of cards.
- **Range picker is functional-only.** 7d/30d/90d/All — correct mechanics, but purely utilitarian. No greyed-out disabled states for insufficient data (MacroFactor does this; Suppr does not).
- **Story-gate ring (`ProgressStoryGate`) is unlabelled.** `loggedDays/3` as a fraction ring with "Your story builds with your data" is the right idea; the current implementation lacks a "days until your first story" count underneath the ring.

### Weight chart
- **No stat-pair header above the chart.** Users must read the chart to infer the avg weight and the delta. MacroFactor and Zero both show a large "Avg X / Δ Y" pair above the chart so the chart becomes *confirmation*, not the primary read surface.
- **No pinned goal-line pill.** The goal line exists but has no anchoring label. Users can't tell which horizontal line is the goal without a legend.
- **"You are here" badge is positional, not interactive.** `daysSinceLatest` badge is correct but there's no tap-to-annotate on the most-recent dot.
- **`WeightSparseState` CTA is well-intentioned but visually orphaned.** Log-weight CTA when <1 datapoint has no relationship to where the chart will appear once populated.

### Daily calories chart
- **Dashed target line is static.** One flat dashed line across all 7 bars doesn't reflect the fact that `effectiveTargetCalories` varies day-to-day (base + activity bonus from `computeActivityBonusKcal`). The existing approximate-day dashed-border cue is good but invisible without explanation.
- **"Daily avg" is missing as a hero number.** The 7-bar chart has no at-a-glance avg kcal call-out above it. Users have to estimate from the bars.
- **Today bar distinction is subtle.** Full vs 0.75 opacity — correct but the today marker needs a stronger cue (e.g. a small indicator below the bar, per BitePal).

### Macro adherence
- **Three rows with minimal visual weight.** Protein / Carbs / Fat as plain progress bars inside a card. No "current vs goal" framing — just a fill percentage. The bar reads as a raw measure, not as adherence-against-a-target.
- **Row height is compressed.** Labels and percentages compete for space. No generous vertical rhythm.
- **The "on-target days" count (`proteinOnTarget`) is buried in the card body.** This is a meaningful metric — days where protein hit ≥90% of target — and it deserves more visual prominence as it drives the coaching narrative.

### Maintenance / Adaptive TDEE card
- **Confidence pill is a label, not a band.** "High / Medium / Low" as a static chip conveys almost nothing. It doesn't show *where in the range* confidence sits, doesn't animate as confidence builds, and doesn't communicate staleness (`adaptiveRejectedAsStale`) in a way users understand.
- **"How this works" expand is visually timid.** A plain chevron + collapsed text. The Alma-style numbered ledger — BMR / ×activity / +adaptive adj / = Maintenance / − deficit / = Goal — exists in the business logic (`maintenanceChain.ts`) but is rendered as plain prose rather than a structured coloured ledger.
- **The adaptive vs formula source pill is small and cold.** Users don't understand what "Adaptive" means. No explanation of what changed or what triggered the switch.
- **`progress_weekly_tdee_history` is not yet persisted** (known gap, see §6), so the "adjustment / steady" commentary always collapses to steady or calibrating. The current card doesn't signal this limitation to users.

### Weekly Digest / Recap card
- **Layout is text-dense without visual hierarchy.** Stats (daysLogged, avgCals, avgProtein, bestDay, weightDelta) are listed as text rows rather than being led by a clear narrative headline. The `resolveDigestHeadline` result should be the dominant visual element — it is currently rendered at the same size as the body text.
- **The dismiss button is prominent relative to the actionable CTAs.** Dismiss sits at the same visual level as "Adjust Pace" and "Save Combo". Dismissing should be a secondary affordance.
- **Share formatting (`formatRecapForShare`) produces plain text.** No pre-composed image or card format; the share output is not Instagram/TikTok-ready (gap vs the viral growth strategy).
- **Pre-window state has no teaser.** Outside Sat 18:00–Tue/Wed recap window there is no "next recap in X days" cue. Users who visit Progress on a Wednesday see nothing where the digest used to be; this reads as "progress is gone" not "next one is coming."

### Hero + StoryGate
- **Both hero and story-gate are below the fold** on most devices due to the household bar and range picker above them. On the primary iOS surface (iPhone 15 Pro, 393pt wide), the most meaningful element — the engine narrative — is not in the first viewport.
- **`ProgressHeroMetric` changes type** (adherence vs avg cals vs streak) without a label explaining *which* metric is being shown. Users must already know the logic to interpret the number.

### Journey / trajectory cards
- **Journey card lacks start/goal/current/Δ ledger.** It shows remaining kg and a progress bar; it does not show starting weight, goal, current, and delta in a scannable ledger format. Yazio does this better.
- **Trajectory card (`progress_trajectory_box`) is still flag-off.** When shown, "if you keep this pace" text has no visual projection to the goal (no dotted line, no goal dot).

### 30-day milestone modal
- **Tone is celebratory-generic.** The one-time modal must use a calm-coaching voice (per design direction) — not confetti + trophy. It needs to feel like a thoughtful "here's what you achieved" moment, not a game badge.

### Streak + freeze panel
- **Freeze economy is opaque.** `availableFreezes` shown as a number. The earn-per-7-day mechanic is nowhere visible. Users who lose a streak unfairly because they didn't know they had freezes is a retention hole.

### Accessibility
- **Chart elements have no accessible labels.** Bar chart bars and line chart points are rendered as SVG/custom views without `accessibilityLabel`. Screen readers cannot interpret the content.
- **Colour-only over-budget signal.** Amber bars for over-budget macros have no secondary affordance (no icon, no text label "Over target") — fails WCAG 1.4.1 (use of colour).
- **Range picker haptics on mobile** are correctly wired; web has no equivalent feedback (expected, not a gap).
- **Loading skeleton** has correct `testID` hooks but no `accessibilityLabel` for each skeleton tile.

---

## 3. Redesign: card-by-card specification

Design token reference throughout:
- `--ink`: `#1B1814` (warm near-black)
- `--surface`: `#FFFFFF`
- `--card`: `#F6F5F2` (soft warm-grey)
- `--border`: `#ECEAE4` (hairline)
- `--terracotta`: `#C2683E` (primary CTA / active state)
- `--sage`: `#7C8466` (secondary / supporting)
- `--amber`: `#C9892C` (over-budget / alerts only)
- `--success`: `#5E7C5A` (under-budget / on-target)
- `--destructive`: red (calorie ring over-budget only — Progress bars use amber per carve-out rules)
- Type: **Fraunces** (or Newsreader) for display numerals, headers; **Inter** for body, labels, data rows

---

### 3.1 Household switcher (`HouseholdBar`)

**Current purpose:** switch between household member profiles.
**Current weaknesses:** renders above everything, consuming prime vertical space for a single-user product. Visually identical chrome to a navigation bar.
**Best-in-class benchmark:** Most apps with household switching use an avatar pill in the top-right of the header chrome — not a full-width bar. (Fitbit household view: compact avatar row, not a banner.)
**Proposed redesign:**
- If household has only one member (solo user — the current N=1 reality), render nothing. Zero height.
- If multiple members: render as a 36pt compact avatar-pill strip in the Progress header, right-aligned, not as a full-width row below the header.
- Tap to expand as a bottom sheet showing all members.

**States:** hidden (solo) / collapsed pill / expanded bottom sheet.
**User benefit:** recovers ~56pt of prime viewport real estate on the primary surface.

---

### 3.2 Progress header + hero metric + narrative (`ProgressHeroMetric` + `ProgressHeadline` / `ProgressStoryGate`)

**Current purpose:** Oura-style single big number (adherence % or avg cals or streak) + engine narrative line + pre-story placeholder ring.
**Current weaknesses:** hero number has no label, sits below the fold, changes type without signposting; story-gate ring is unlabelled; narrative headline rendered at body-text size.

**Best-in-class benchmarks:**
- The Outsiders Heart Rate screen: big `64 bpm` + date + one-line narrative + small chart below. Navigation-bar height = 44pt; everything meaningful in the first 300pt.
- BitePal Statistics: `1174 kcal / Daily avg.` as twin lines — metric above, label below in sage — occupies the hero slot.
- pliability Mobility Overview: fraction ring `1/3 DAYS` with label underneath.

**Proposed redesign:**

```
┌────────────────────────────────────┐
│  Progress           [⚖ Log Weight] │  ← header, terracotta Scale button
│                                    │
│  Week of Jun 2–8                   │  ← `weekKeyFor` rendered as "Week of …", sage sans 13/18
│                                    │
│         87%                        │  ← Fraunces 64pt, --ink
│    Calorie adherence               │  ← Inter 14pt, --sage (metric label, always explicit)
│                                    │
│  "Last week: down 0.6 kg"          │  ← `resolveDigestHeadline` output, Fraunces 18pt, --ink
│  "You hit protein on 5 of 7 days." │  ← `digestStory` first sentence, Inter 14pt, --sage
│                                    │
│  ○ ○ ●                             │  ← range picker (7d active) below the fold
└────────────────────────────────────┘
```

- Hero number type is chosen by the engine from the existing `ProgressHeroMetric` logic (adherence % > avg cals > streak, in priority order). The **label below** ("Calorie adherence", "Average daily calories", "Logging streak") is always rendered — it is not optional.
- `resolveDigestHeadline` output is rendered in **Fraunces 18pt / 24 line-height**, below the hero number. This is the *most important text on the surface* — do not render it at body size.
- `digestStory.ts` first sentence follows at Inter 14pt/20, sage. No more than two lines visible without scroll.
- The week-range header ("Week of Jun 2–8") uses `weekKeyFor` decoded to human-readable, replaces the current "7d" overline.

**Pre-story state (`ProgressStoryGate`, fewer than 3 logged days):**

```
┌────────────────────────────────────┐
│  Progress                          │
│                                    │
│         ⬤ 1/3                      │  ← fraction ring, terracotta arc, --card fill
│    days until your first story     │  ← Inter 13pt, sage
│                                    │
│  Log today to keep building.       │  ← plain coach copy, Inter 14pt, --ink
└────────────────────────────────────┘
```

- Ring shows `loggedDays / STORY_DATA_FLOOR_DAYS` (3). Arc fills terracotta. Days-remaining count ("2 more days") below the ring.
- "Log today to keep building." — calm, not gamified. Links to Today tab.

**All states:**
- `data` (≥3 days): hero number + label + headline + first sentence.
- `pre-story` (1–2 days): fraction ring + count + gentle CTA.
- `empty` (0 days): "Your progress will appear here" (existing copy, correct).
- `loading`: skeleton — full-width rect 80pt tall (header area) + 2× rect 32pt (number + label) + 1× rect 20pt (headline). All `--card` fill, no animation (Suppr convention).

**Motion:** none. No entrance animations. This surface prioritises data credibility.
**Haptics (mobile):** none on the hero. Haptics reserved for the range picker segmented control.
**Accessibility:** `accessibilityLabel="Calorie adherence: 87 percent"` on the hero number + label pair. `accessibilityRole="header"` on the headline.

**User benefit:** first-viewport orientation — users know immediately what week, what their headline metric is, and the engine's one-line read of their week before scrolling.

---

### 3.3 Range picker (7d / 30d / 90d / All)

**Current purpose:** drives header overline + range cards; haptic on change (mobile).
**Current weaknesses:** all four segments always enabled even when data is insufficient for 90d or All.
**Best-in-class:** MacroFactor range controls grey out segments that lack sufficient data (< `MIN_LOGGING_DAYS` equivalent).

**Proposed redesign:**
- Render as a compact segmented control, Inter 13pt, 36pt height, `--card` background, `--terracotta` active fill (white label), `--sage` inactive label.
- **Disabled-state greying:** if total logged days < 30, disable and grey the `30d` segment with `opacity: 0.4`. If < 60, disable `90d`. If < `MIN_WEIGH_INS × 2`, disable `All`.
- Disabled segments have `accessibilityHint="Not enough data yet"`.
- Active segment has `accessibilityState={{ selected: true }}`.
- Haptic `impactOccurred('light')` on change (mobile, existing — keep).

**User benefit:** no "empty chart" surprise when selecting a range with no data; manages expectations before the user taps.

---

### 3.4 Weight chart (`WeightChart` + `WeightTrendHeader` + `WeightSparseState`)

**Current purpose:** MFP-style trend line + EMA moving average + goal line + raw dots (daily bucket) + "you are here" badge + imperial/metric + daysSinceLatest.
**Current weaknesses:** no stat-pair header; no pinned goal-line pill; "you are here" not interactive; sparse-state CTA visually orphaned.

**Best-in-class benchmarks:**
- MacroFactor Scale Weight: stat-pair ("Average 165.2 lbs / Difference −1.7 lbs") above chart in the card header, right-aligned to chart body. Date range as quiet Inter 12pt caption.
- Zero Weight: terracotta-ish trend line on clean white, "See all data" row at the bottom.
- Noom My progress: pinned goal-line pill ("GOAL: 54.4 KG") + tap-a-dot annotation bubble ("55 / APR 28 / Add Note").
- MacroFactor Expenditure flux: shaded confidence band around trend line (2σ or TDEE-range band).

**Proposed redesign:**

```
┌─────────────────────────────────────────┐
│  Weight trend                    30d ▾  │  ← card header, Inter 13pt bold, --ink
│                                         │
│  74.2 kg          ▼ −0.6 kg             │  ← stat-pair: avg weight (Fraunces 28pt) +
│  this period      vs last period        │    delta (Inter 14pt, success green or amber)
│                                         │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ GOAL 70.0 kg ─┤  ← goal-line pill, sage bg, white Inter 11pt
│                                         │
│  [chart area — terracotta dots/line,    │
│   EMA trend line terracotta, thinner;   │
│   goal line sage dashed; raw dots on    │
│   daily bucket only]                    │
│                                         │
│  ↑ Tap a dot to log a note              │  ← Inter 11pt, --sage, only shown once
│                                         │
│  See all measurements  →                │  ← hairline row, Inter 13pt, --ink
└─────────────────────────────────────────┘
```

**Stat-pair header:**
- Left: avg weight for the period (Fraunces 28pt, `--ink`). Caption: "avg this period" (Inter 12pt, `--sage`).
- Right: Δ vs previous equivalent period (Inter 16pt, `--success` if trending goal-direction, `--amber` if opposite). Caption: "vs last {period}" (Inter 12pt, `--sage`).
- Both derived from `buildWeightRangeStats` — no new computation required.

**Goal-line pill:**
- Pinned horizontally on the goal-line Y position within the chart SVG/canvas.
- Right-aligned, inside the chart area.
- Background: `--sage` at 90% opacity. Label: "GOAL {value}" (Inter 11pt bold, white).
- Hidden if goal line outside Y-domain (`computeWeightChartDomain` proximity check — existing logic).

**Trend line:**
- Terracotta (`--terracotta`) at 2px stroke. Raw daily dots as 5pt terracotta filled circles.
- EMA trend line: same terracotta, 1px stroke, dashed (4px dash / 3px gap) to visually distinguish from raw-dot line.
- **Do NOT add gradient fill beneath the line.** This is the Fitbit ribbon anti-pattern — it flattens data honesty. Keep raw scatter + moving average as two distinct signals.

**Confidence / flux band (MacroFactor parity — additive):**
- When `adaptive_tdee_confidence` is `medium` or `high`, render a very light sage band (2px ± a computed band from the EMA residual) around the EMA line. Opacity 0.12. This communicates "this is an estimate, not a precise path" without a label.
- When confidence is `low` or null (calibrating), no band — the absence itself signals uncertainty.
- Note: requires a new `computeEMAResidualBand` helper (additive; does not change existing data or gates).

**Tap-a-dot interaction:**
- Tap any raw dot (daily bucket) → annotation bubble appears: "{weight} / {date}" with a soft "Edit" link. Tapping "Edit" opens the existing `LogWeightSheet` in edit-in-place mode (`editWeightDate`).
- Existing web weight input should open the equivalent inline edit state.

**`WeightSparseState` (< 1 datapoint):**

```
┌──────────────────────────────────────┐
│  No weight data yet                  │
│                                      │
│  [illustrated empty state — a small  │
│   sage icon, not cartoon]            │
│                                      │
│  Log your weight to see how you're   │
│  trending toward your goal.          │
│                                      │
│  ╔══════════════════════════════╗    │
│  ║  Log weight  (terracotta)    ║    │
│  ╚══════════════════════════════╝    │
└──────────────────────────────────────┘
```

- CTA is a terracotta filled button, Inter 15pt bold, 48pt height, full-width within the card.
- Taps open `LogWeightSheet`.

**`WeightTrendOnlyCard` (`trends_only` mode):**
- Replace numeric weight with a directional arrow only: ↓ (losing, success) / → (stable) / ↑ (gaining, warn-if-goal-is-loss).
- Inter 18pt arrow glyph + "Trending {down/steady/up}" Inter 14pt label. No kg values.
- Correct for users who have opted out of seeing weight numbers.

**Weight surface mode `hide`:** entire weight section collapses to zero height with no divider — do not render an empty card.

**`AllWeightDataSheet` ("See all measurements" row):**
- Hairline row at the bottom of the card. Taps the existing `AllWeightDataSheet`.
- Styled: Inter 13pt, `--ink`, right arrow `chevron-right` (lucide, sage, 14pt), full-bleed tappable row, 44pt minimum height.

**`daysSinceLatest` badge:**
- When > 10 days since last weigh-in: soft amber badge above the chart ("Last weighed {N} days ago"). Inter 12pt, amber bg at 12% opacity, amber text.

**Accessibility:**
- Chart `accessibilityLabel="Weight trend chart. Average this period: {avg} kg. Change: {Δ} kg. {N} data points."`.
- Each raw dot: `accessibilityLabel="{date}: {weight} kg"`.
- Goal line: `accessibilityLabel="Goal weight: {value} kg"`.

**User benefit:** the stat pair does the interpretive work; users understand the chart at a glance before engaging with it. The pinned goal pill makes progress toward the goal visceral without needing to find the goal line in a legend.

---

### 3.5 Three-stat row — Avg intake / Maintenance / Deficit (mobile v2 only)

**Current purpose:** "Avg intake | Maintenance | Deficit" as three tiles; Deficit = positive (green) or negative/amber (surplus).
**Current weaknesses:** rendered after the weight chart — visually buried. No unit labels visible in the compact tile.

**Proposed redesign:**
- Three equal-width tiles, `--card` background, `--border` hairline between them (no outer card border — merges with the surrounding surface).
- Each tile: value (Fraunces 20pt, `--ink`) + label (Inter 11pt, `--sage`) + delta label (Inter 11pt, `--success` or `--amber`).
- Order: Avg intake / Maintenance / Deficit. If maintenance is null (calibrating), middle tile renders "Calibrating…" (Inter 13pt, `--sage`) with a tooltip icon.
- Surplus label: if Deficit < 0, render "Surplus +{N} kcal" in amber. If Deficit > 0, render "Deficit −{N} kcal" in success green. Match the existing logic exactly.
- **Web:** this pattern maps onto the Phase-2 `CaloriesRangeCard` / `WeightRangeCard`. Render using the same three-tile layout but inside the existing Phase-2 card structure.

**Accessibility:** each tile `accessibilityLabel="Average intake: {N} calories"` etc.

---

### 3.6 Daily calories chart (7 bars, effective target, over/under, tap → Today)

**Current purpose:** 7 bars vs `effectiveTargetCalories` (base + activity bonus), over=amber, today highlighted, dashed target line, approximate-day dashed border, tap → Today.
**Current weaknesses:** no "daily avg" hero; flat static target line doesn't reflect per-day variation; today marker is opacity-only.

**Best-in-class benchmarks:**
- BitePal Statistics: `1174 kcal / Daily avg.` above bars + floating "avg." dotted reference line + small triangle marker below today's bar.
- MFP Weekly Digest: per-day goal-dot marker (small circle on each bar at that day's target height).

**Proposed redesign:**

```
┌──────────────────────────────────────────┐
│  This week                               │  ← Inter 13pt bold, --ink
│                                          │
│  1,438 kcal                              │  ← Fraunces 24pt, --ink
│  daily average                           │  ← Inter 12pt, --sage
│                                          │
│     |    |    |    |    |    |▓|         │  ← 7 bars; today ▓ = full opacity
│     M    T    W    T    F    S    S      │
│     ○    ○    ○    ○    ○    ○    ○      │  ← per-day target dots (per MFP)
│     ▲                                    │  ← today triangle below today bar
│                                          │
│  ─ ─ ─ Base target: 1,400 kcal ─ ─ ─   │  ← dashed base-target line + label
└──────────────────────────────────────────┘
```

**Daily avg hero:**
- `caloriesRange.avgCaloriesPerDay` rendered as Fraunces 24pt above the bars.
- "daily average" label Inter 12pt, sage.
- Not present in skeleton/loading state (shows rect placeholder).

**Per-day target dots:**
- Small circle (4pt diameter, `--sage` fill) plotted at `effectiveTargetCalories` for each bar column.
- When a day's bar exceeds the dot → bar is amber. When at or under → bar is success green.
- This replaces the single flat dashed line for daily variation, while keeping the base-target dashed line as a secondary reference (it represents the `daily_targets` snapshot / base without activity bonus).
- Approximate-day dashed-border cue (existing): keep exactly — renders as a dashed bar border when `daily_targets` snapshot is absent for that day.

**Today marker:**
- Full opacity (existing, correct).
- Additionally: small filled terracotta triangle (▲) below the today bar column. 6×5pt triangle, Inter 0pt (no label, visual only). `accessibilityLabel="Today"` on the bar.

**Colours:**
- Over target (bar height > per-day dot): `--amber` fill.
- At or under target: `--success` fill.
- Zero (no log): `--card` fill with `--border` stroke.
- Today highlight: same colour rules, full opacity; others at 0.75.

**Tap interaction (existing — keep):** taps navigate to Today for that date.

**Accessibility:**
- Each bar: `accessibilityLabel="{day}: {N} calories logged, target {T} calories, {over/under} target"`.
- Today bar: prefix "Today, ".

---

### 3.7 Macro adherence bars (Protein / Carbs / Fat)

**Current purpose:** per-macro adherence % over days-with-food, bar capped at 100, amber when >100%, `proteinOnTarget` day count.
**Current weaknesses:** compressed rows, no "current vs goal" framing, on-target day count buried.

**Best-in-class benchmarks:**
- Tonal Strength Score: clean horizontal bars, generous row height (~52pt per row), label left, bar right, single accent, collapsible groups.
- Yazio Nutrition Facts: paired "Current vs Goal" mini-bars with % under each.

**Proposed redesign:**

```
┌───────────────────────────────────────────┐
│  Macro adherence   7 days                 │  ← Inter 13pt bold + period caption
│                                           │
│  Protein                        94%       │
│  ████████████████████░░░  5/7 days on target │
│                                           │
│  Carbohydrate                   78%       │
│  ███████████████░░░░░░░░░               │
│                                           │
│  Fat                           112%       │  ← amber label + amber bar
│  ████████████████████████▌▌▌           │  ← bar clamps at 100; overflow indicated
└───────────────────────────────────────────┘
```

**Row anatomy (52pt height per row):**
- Label: Inter 14pt, `--ink`, left-aligned.
- Percentage: Inter 14pt, `--ink` if ≤100, `--amber` if >100, right-aligned.
- Bar track: full width, `--border` fill, 6pt height, 3pt radius.
- Bar fill: `--success` if ≤100%, `--amber` if >100%. Bar clamps at 100% width; the >100% over-run is signalled by a 3-dot amber "overflow indicator" to the right of the bar rather than a bar that extends beyond the track.
- Below protein bar only (not carbs/fat): "`{N}/7 days on target`" in Inter 11pt, `--sage`. Maps to `proteinOnTarget`. This is the most behaviour-relevant metric — it deserves a sub-label.

**"Current vs goal" framing (Yazio borrowing):**
- Each bar label is prefixed with the *current average* and the *target* in sage: `Protein: avg {N}g / target {T}g`. This transforms the bar from a raw fill to an explicit adherence-against-target read.
- Rendered as: `Protein   avg 142g / 150g   94%` — all on one line, Inter 13pt, with the bar below.

**Over-budget accessibility:**
- Amber bar colour is supplemented by: amber `!` icon (lucide `alert-circle`, 14pt) before the percentage when >100%.
- `accessibilityLabel="Protein: 94 percent adherence, on target 5 of 7 days"` / `"Fat: 112 percent, over target — amber"`.

---

### 3.8 Maintenance / Adaptive TDEE card + "How this works" chain

**Current purpose:** TDEE number, source pill (adaptive vs formula), confidence meter, staleness flag, expandable BMR→activity→adaptive→goal chain, projected weekly loss.
**Current weaknesses:** confidence is a static label; "How this works" chain is plain prose; source pill unexplained; `adaptiveRejectedAsStale` not user-visible.

**Best-in-class benchmarks:**
- MacroFactor Expenditure: "Expenditure Changes" table (3/7/14/30/90-day window deltas) + `Current Expenditure {N} kcal` + `Current Strategy: Updating / Holding / Waiting`.
- MacroFactor Expenditure flux: shaded confidence band around trend.
- Alma "How it works": numbered step cards → "Your numbers" coloured ledger (BMR / ×activity / = TDEE / − deficit / = Goal).

**Proposed redesign:**

**Collapsed state:**
```
┌──────────────────────────────────────────────┐
│  Your maintenance                  ●Updating │  ← status chip (see below)
│                                              │
│        1,847 kcal                            │  ← Fraunces 40pt, --ink
│        per day                               │  ← Inter 13pt, sage
│                                              │
│  Based on your logged food + weight trend.   │  ← Inter 13pt, --sage, 1 line
│                                              │
│  How this was calculated  ›                  │  ← disclosure row, Inter 13pt, --ink
└──────────────────────────────────────────────┘
```

**Status chip** (top-right, replaces confidence pill):

| State | Chip text | Colour |
|---|---|---|
| high confidence, not stale | `● Tracking` | success green dot, Inter 12pt |
| medium confidence | `● Updating` | terracotta dot, Inter 12pt |
| low confidence / calibrating | `● Calibrating` | sage dot, Inter 12pt |
| `adaptiveRejectedAsStale` | `● Paused — log food to resume` | amber dot, Inter 11pt |
| null (formula only) | `● Estimated` | sage dot, Inter 12pt |

These map 1:1 to MacroFactor's `Updating / Holding / Waiting` pattern, applied to Suppr's existing `confidence` + `adaptiveRejectedAsStale` + `source` fields. No new business logic.

**Expanded state ("How this was calculated"):**

Numbered step cards — Alma-style, one card per chain step. Background `--card`, `--border` hairline, 12pt radius, 16pt internal padding.

```
┌────────────────────────────────────────────┐
│  How your calorie goal was calculated      │  ← Inter 14pt bold, --ink
│                                            │
│  ① Basal Metabolic Rate                    │
│     1,540 kcal / day                       │  ← Fraunces 20pt, --ink
│     Mifflin–St Jeor formula                │  ← Inter 12pt, sage
│                                            │
│  ② Activity adjustment                     │
│     × 1.2 (Sedentary)                      │
│     = 1,848 kcal                           │
│                                            │
│  ③ Adaptive engine adjustment              │  ← only shown when adaptive≠formula
│     − 1 kcal                               │
│     Based on 18 logged days + 6 weigh-ins  │
│                                            │
│  ④ Maintenance                             │  ← ─────────────────
│     1,847 kcal / day                       │  ← Fraunces 22pt, --ink
│                                            │
│  ⑤ Plan deficit (Moderate pace)            │
│     − 447 kcal                             │  ← --destructive (red) for deficit rows
│                                            │
│  ⑥ Your daily goal                         │
│     1,400 kcal / day                       │  ← Fraunces 22pt, --success
│                                            │
│  ○ Projected weekly change                 │
│     ≈ −0.41 kg / week                      │  ← Inter 13pt, --sage
│     Based on 7,700 kcal ≈ 1 kg.           │
│     An estimate, not a promise.            │
└────────────────────────────────────────────┘
```

- Maps `maintenanceChain.ts` steps exactly: BMR → activity → adaptive adj (conditional) → Maintenance → deficit → goal.
- `KCAL_PER_KG_FAT = 7700` caveat is always rendered on the projected-change row.
- Adaptive-adjustment step is hidden if `source === 'formula'` (no adaptive adjustment to show).
- If `formulaKcal` is null (incomplete inputs), step ① renders "We need more profile data" with a sage link to Settings.
- Step numbers use `①–⑥` Unicode enclosed numerals or styled badges (Inter 12pt, sage bg, white numeral, 18pt circle).

**Multi-window expenditure deltas (MacroFactor parity — additive, flag-gated):**
Under the collapsed main card, a secondary "TDEE changes" section (gated behind `progress_tdee_windows`, default off):

| Period | Avg TDEE | Change |
|---|---|---|
| 7-day | 1,847 | → Stable |
| 30-day | 1,831 | ↑ +16 kcal |

Built from the existing `buildCaloriesRangeStats` and `adaptiveTdee` outputs over multiple windows. No new business logic, only new UI composition.

**Accessibility:**
- Collapsed: `accessibilityLabel="Maintenance: 1,847 calories per day. Status: Updating."`.
- Expanded: each step `accessibilityLabel="Step 1: Basal Metabolic Rate — 1,540 calories per day"`.

**User benefit:** transforms the most analytical card from a number-plus-label into a legible ledger that explains the engine — building trust in the adaptive TDEE without hiding any math.

---

### 3.9 Trajectory card (`progress_trajectory_box`)

**Current purpose:** "if you keep this pace you'll reach your goal in ~N weeks."
**Current weaknesses:** plain text; no visual projection; flag-gated off.

**Best-in-class benchmark:** Noom My Progress — dotted projection line from current position to goal dot on the chart.

**Proposed redesign:**
- Render as a card visually related to the weight chart (same width, immediately below it).
- Contains a **mini projection chart** (not interactive): current weight as a point, dotted terracotta line projecting to a filled sage "goal" dot at the `daysToGoal` date.
- X-axis: date labels (current → goal date). Y-axis: weight, same scale as the main weight chart.
- Below the chart: `"At this pace, you'll reach {goalWeight} kg around {date}."` Inter 14pt, `--ink`. If `daysToGoal > 365`: `"More than a year at your current pace — consider adjusting your plan."` No shame, no urgency.
- Footer: `"Based on your last 28 days. An estimate."` Inter 11pt, `--sage`.
- `MAX_DAYS_TO_GOAL = 365` cap copy preserved exactly.

---

### 3.10 Journey card (`calcGoalTimeline`)

**Current purpose:** remaining kg, weekly rate, days-to-goal, Tukey-robust progress bar, `weightJourneyProgress` copy.
**Current weaknesses:** no start/goal/current/Δ ledger; progress bar lacks starting-weight anchor.

**Best-in-class benchmark:** Yazio Weight "Starting / Goal / Current / Difference" bulleted ledger + Cal AI "X% of goal" chip.

**Proposed redesign:**

```
┌─────────────────────────────────────────┐
│  Your journey                           │  ← Inter 13pt bold
│                                         │
│  Started   Current    Goal              │
│  78.0 kg → 74.2 kg → 70.0 kg           │  ← Fraunces 18pt for values, sage arrows
│                                         │
│  −3.8 kg so far · −4.2 kg to go        │  ← Inter 13pt, success / sage
│                                         │
│  ████████████████░░░░░░░░░              │  ← progress bar, terracotta fill
│  47% of the way there                   │  ← `weightJourneyProgress` copy
│                                         │
│  At current pace: ~{N} weeks            │  ← Inter 13pt, --sage
└─────────────────────────────────────────┘
```

- "Started / Current / Goal" row: uses `profiles.weight_kg` (current), `calcGoalTimeline.baseline` (Tukey-robust start), `profiles.goal_weight_kg` (goal).
- `−3.8 kg so far`: Fraunces, success green. `−4.2 kg to go`: Inter, sage.
- Progress bar: terracotta fill, `--border` track. Percentage label below.
- "Just starting" copy: when `weightJourneyProgress` returns null (span < 0.1 kg), render "Just starting — keep logging." No progress bar (don't show 0%).
- "Goal reached" copy: when current ≤ goal (losing goal) or ≥ goal (gaining goal), render the `weightJourneyProgress` "Goal reached" variant with a small sage check icon.
- Days-to-goal if > 365: "More than a year at current pace." (existing copy — correct).

---

### 3.11 Apple Health card (`AppleHealthCardHost` mobile; manual inputs web)

**Current purpose (mobile):** steps / weight / workouts sync status. **Current purpose (web):** manual steps + body-fat text inputs.
**Current weaknesses (both):** sync status is a spinner/text state with no spatial relationship to the data it feeds.

**Proposed redesign (mobile):**
- Three mini-tiles in a row: Steps / Weight / Workouts. Each shows: icon (lucide: `footprints` / `scale` / `dumbbell`) + last-synced value + sync status dot (green = live, amber = degraded, red = error).
- Tri-state (pending / success / failed) preserved exactly:
  - pending: skeleton tile, no "0" shown (existing rule — keep).
  - success: honest value (honest 0 is correct).
  - failed: `"Steps sync paused"` text + `"Open Health"` link (existing rule — keep).
- `accessibilityLabel="Steps: 8,432 steps. Synced from Apple Health."`.

**Proposed redesign (web):**
- Manual steps and body-fat inputs as a simple form card — Inter 14pt labels, 48pt input fields, sage placeholder copy.
- No fake "sync status" — this is manual entry, not a live feed. Say so: "Enter manually — Apple Health is iOS-only." Inter 12pt sage caption.

---

### 3.12 Weekly Digest / Recap card (`<Digest>` + `DigestStoryCard`)

**Current purpose:** previous-week story — daysLogged, avg cals/protein, closestToTarget day, weightDelta, fiber/hydration, share/dismiss/CTAs, `digestStory.ts` narrative, `resolveDigestHeadline`.
**Current weaknesses:** layout is text-dense; dismiss button visually equal to CTAs; share output not image-ready; no pre-window teaser.

**Best-in-class benchmarks:**
- Oura Weekly Summary: narrative-over-chart layout, week-range header, numbers embedded in sentences, calm past-tense voice.
- The Outsiders Heart Rate: big headline + one-line summary + mini chart + 7-day overview.
- Lifesum Weekly Insights: status-rows (OPTIMAL/GREAT/GOOD) + "Improve this" nudge card.
- Noom Weekly Progress Report: countdown teaser in pre-window state.

**Proposed redesign:**

**Within-window state (Sat 18:00 → Tue/Wed):**

```
┌─────────────────────────────────────────────┐
│  Week of {Mon}–{Sun}                    ✕   │  ← week range, Inter 12pt sage; ✕ dismiss
│                                             │
│  "Last week: down 0.6 kg"                   │  ← `resolveDigestHeadline`, Fraunces 22pt
│                                             │
│  You logged 6 of 7 days. You averaged      │
│  1,438 kcal — 38 kcal under your target.   │  ← `digestStory.ts`, Inter 14pt, --ink
│  Protein hit target on 5 days.             │
│  Your closest day: Wednesday.              │
│                                             │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐    │
│  │  ▓  │  ▓  │  ▓  │  ▓  │  ▓  │  ░  │    │  ← mini 7-bar chart, 32pt tall
│  └─────┴─────┴─────┴─────┴─────┴─────┘    │
│   M    T    W    T    F    S    S          │
│                                             │
│  ┌ Closest to target: Wednesday ──────────┐ │
│  │  ★ 1,402 kcal · 148g protein           │ │  ← bestDay detail, Fraunces 16pt value
│  └────────────────────────────────────────┘ │
│                                             │
│  ╔══════════════╗ ╔══════════════════════╗  │
│  ║ Adjust pace  ║ ║ Share this week  ↑   ║  │  ← primary CTAs, terracotta
│  ╚══════════════╝ ╚══════════════════════╝  │
│                                             │
│  Save combo for next week  →               │  ← tertiary, sage text link
└─────────────────────────────────────────────┘
```

**Visual hierarchy rules:**
- `resolveDigestHeadline` is **Fraunces 22pt / 28 line-height** — the editorial moment. Not Inter body.
- Dismiss (✕) is top-right, 32×32pt tap target, sage colour. It is NOT a button at the same level as CTAs.
- CTAs are two full-width-ish equal buttons (terracotta fill). "Save combo" is a tertiary text link below.
- The mini 7-bar chart (32pt tall) uses the same bar colours (amber/success/empty) as the daily calories chart — consistency.
- Closest-to-target ("bestDay") gets its own inset card within the digest. `bestDay` is null if no day meets the 80%-macros-logged gate — suppress the inset card entirely when null (existing suppress-when-lying rule — keep).

**Digest suggestion ("Improve this") — Lifesum borrowing:**
After the main digest content, if a digest suggestion exists (`weeklyDigestSuggestion.ts` first-match cascade), render a separate "One thing" nudge card:

```
┌──────────────────────────────────────────┐
│  One thing to try this week              │  ← Inter 13pt bold, --ink
│                                          │
│  Your protein hit target on 3 of 7      │
│  days. Aim for a high-protein breakfast  │
│  on 2 more days.                         │  ← suggestion copy, Inter 14pt, --sage
│                                          │
│  Got it  ›                               │  ← dismiss, sage text link
└──────────────────────────────────────────┘
```

- Maps to existing suggestion kinds: `re_log_prompt` / `maintenance_recalibration` / `protein_nudge` / `streak_protection` / `weight_trend_mismatch`.
- Copy per suggestion is authored in `weeklyDigestSuggestion.ts` — no new logic, only new visual wrapper.
- Dismisses per-suggestion per week (same pattern as digest dismiss).

**Pre-window teaser (Noom borrowing):**
When outside the recap window (Wed → Sat 18:00 for sunday-start; Thu → Sun 18:00 for monday-start), render a compact teaser card in place of the full digest:

```
┌──────────────────────────────────────────┐
│  Next recap available {day} evening      │  ← Inter 14pt, --ink (e.g. "Saturday evening")
│  Keep logging to build your story.       │  ← Inter 13pt, --sage
└──────────────────────────────────────────┘
```

- 64pt height, `--card` background. No dismiss affordance.
- "Next recap available {day} evening" derived from `shouldShowRecap` window logic — no new computation.

**Share output:**
- "Share this week" should trigger a pre-composed card (mobile: `Share` sheet with a pre-rendered image; web: copy-to-clipboard or download PNG).
- The card template: white background, Fraunces headline (`resolveDigestHeadline`), key stats in a 2×2 grid, Suppr wordmark bottom-right. 1080×1080pt.
- Note: the share card renderer is a new additive component. It does not change any existing data fields or business logic. Flag-gate under `progress_share_card`.

**`DigestStoryCard` (always-on calm narrative):**
- When the digest is dismissed or outside the window, the `DigestStoryCard` renders below the range cards as a standalone calm narrative paragraph.
- Redesign: same `digestStory.ts` output, but rendered with a left terracotta accent bar (2px), Fraunces 15pt italic for the first sentence, Inter 13pt for the rest.
- This persists even after digest dismiss — it's the "ambient engine voice" not the actionable recap.

**Accessibility:**
- `accessibilityRole="region"` on the digest card. `accessibilityLabel="Weekly recap for {weekRange}"`.
- Dismiss: `accessibilityLabel="Dismiss weekly recap"`.
- "Closest to target" inset: `accessibilityLabel="Closest day to your nutrition targets: {day}, {N} calories, {N}g protein"`.

---

### 3.13 Hero metric / narrative in week-digest vs standalone (integration)

When the digest card is expanded and visible, the header hero metric should **shift** to show the digest's headline stat (the `resolveDigestHeadline` result) as the primary number. When the digest is dismissed or hidden, the hero reverts to the current-week adherence%. This coordination happens via a shared context value — no new network calls.

---

### 3.14 30-day milestone modal (`Milestone30DayModal`)

**Current purpose:** one-time celebration at 30 distinct logged days — daysLogged, avg kcal, top 3 foods, longest streak, weight delta.
**Current weaknesses:** tone risk — current implementation risks generic celebration chrome (confetti/trophy) that clashes with calm-coach voice.

**Best-in-class benchmarks:**
- Alan "You did it": warm single-line reflection, no confetti.
- Deepstash Streak: day-strip showing the logged-day arc visually.
- MFP "You did it!" modal: confetti + trophy — **do not copy** (wrong tone for Suppr's voice).

**Proposed redesign:**

```
┌──────────────────────────────────────────────┐
│                                              │
│  30 days.                                    │  ← Fraunces 48pt, --ink
│  That's a habit.                             │  ← Fraunces 24pt, --sage (italic)
│                                              │
│  ─────────────────────────────────────────  │
│                                              │
│  Avg calories      1,440 kcal               │
│  Longest streak    12 days                  │
│  Top food          Chicken breast           │
│  Weight since      −2.8 kg                 │  ← null-safe: hidden if < 2 weigh-ins
│                                              │
│  ─────────────────────────────────────────  │
│                                              │
│  ╔════════════════════════════════════════╗  │
│  ║        Keep going  ›                   ║  │  ← single CTA, terracotta
│  ╚════════════════════════════════════════╝  │
│                                              │
└──────────────────────────────────────────────┘
```

- No confetti. No trophy icon. No "AMAZING!" copy.
- The stats card uses the `milestone30Day.ts` data exactly: `daysLogged`, `avgDailyKcal`, top 3 foods (rendered as single first food + "and 2 others" if there are 3), `longestStreak`, `totalWeightDeltaKg` (null-safe — hidden if `< 2 weigh-ins`).
- "That's a habit." — the coaching line. One sentence. Past tense. No exclamations. Correct tone.
- `milestone_30_shown_at` persistence preserved exactly (one-time fire).
- Web equivalent: `Milestone30DayDialog` — same layout in a centred dialog, 420pt max-width.

**Motion (mobile only):** a subtle terracotta arc that draws from 0 to 100% of a circle behind the "30" number, completing on modal entry. Duration 600ms, easing `easeOut`. This is the only animation on this modal.

**Accessibility:** `accessibilityViewIsModal={true}`. `accessibilityLabel="30-day milestone achieved. {stats summary}"`.

---

### 3.15 Streak + freeze panel

**Current purpose:** protected streak, earned/used freezes, budget, freeze-used history.
**Current weaknesses:** freeze economy opaque; earn-per-7-day mechanic invisible.

**Best-in-class benchmarks:**
- Deepstash Streak: numbered day-strip showing freeze-protected day visually.
- Cal AI Day Streak: compact S-M-T-W flame tile.

**Proposed redesign:**

**Compact weekday strip:**

```
  M    T    W    T    F    S    S
  ✓    ✓    ✓    ✓    ✗    ✓    ·
             [STREAK: 12]
```

- Each day: filled terracotta circle (logged), empty `--border` circle (unlogged), sage ice-crystal icon (freeze used), grey dot (future / no data).
- "[STREAK: 12]" label centred below — Inter 13pt bold, `--ink`. Fraunces for the number.
- "Protected: 12 days" (if raw ≠ protected) vs just "12 days" (if identical). Copy from `computeProtectedStreak` vs `computeLoggingStreak`.

**Freeze economy row:**
```
  🧊  2 freezes available
      Earn 1 more at day 14   ──── [7 of 14 ●●●●●●●░░░░░░░]
```

- `availableFreezes` as a pill count. Inter 13pt, `--ink`.
- "Earn 1 more at day {nextMilestone}" — derives from `earnFreezeIfMilestone` milestone crossing logic (next 7-day multiple above current streak). Always shown so the mechanic is legible.
- Progress bar to next milestone: `(streakLength % 7) / 7` fill, `--terracotta`, 4pt height.
- Used-freeze history: collapsible row "Last used {N} days ago" linking to the 90-day ledger.

**Accessibility:** `accessibilityLabel="Current streak: {N} days. {F} freezes available."`.

---

### 3.16 Progress loading skeleton

**Current:** correctly structured (`progress-loading-skeleton`, `progress-skeleton-tile-{0..3}`).
**Proposed refinements:**
- Skeleton tiles should match the *exact height* of the cards they represent — so the page doesn't reflow on data load. Weight chart skeleton = 220pt (chart area) + 64pt (stat-pair header). Daily calories skeleton = 160pt. Macro adherence = 180pt.
- No shimmer animation (Suppr convention — plain `--card` fill). Accessibility label per skeleton region: `accessibilityLabel="Loading progress data"`.

---

### 3.17 Progress empty state

**Current:** "Your progress will appear here" + `BarChart3` icon. Correct and sufficient.
**Proposed refinement:** replace `BarChart3` with a custom sage illustration (a simple line going from lower-left to upper-right — not a cartoon, just a path). This is the only surface where a minimal icon illustration is appropriate (not meal photography — this is a data surface).

---

## 4. Concrete visual spec — Suppr design system

### Type hierarchy on this surface

| Role | Font | Size / Weight | Colour | Use |
|---|---|---|---|---|
| Hero numeral | Fraunces | 64pt / Regular | `--ink` | `ProgressHeroMetric` (adherence %, avg cals, streak) |
| Digest headline | Fraunces | 22pt / Regular | `--ink` | `resolveDigestHeadline` output |
| Chart stat | Fraunces | 28pt / Regular | `--ink` | Weight chart avg; daily avg kcal |
| Card value | Fraunces | 20–24pt / Regular | `--ink` | Maintenance TDEE, journey milestones |
| Card label | Inter | 13pt / Medium | `--sage` | "daily average", "per day" |
| Body copy | Inter | 14pt / Regular | `--ink` | Digest narrative, maintenance explainer |
| Secondary copy | Inter | 13pt / Regular | `--sage` | Period captions, est. footers, sub-labels |
| Micro label | Inter | 11–12pt / Regular | `--sage` | Bar sub-labels, on-target counts, source captions |
| Button | Inter | 15pt / SemiBold | white on terracotta | Primary CTAs |
| Text link | Inter | 13pt / Regular | `--sage` | Tertiary actions |

### Spacing
- Card internal padding: 16pt horizontal, 16pt vertical.
- Card-to-card gap: 12pt.
- Section header to first card: 8pt.
- Chart inner padding: 12pt (leaves room for Y-axis labels).
- Hero numeral bottom margin (to label): 4pt.
- Digest headline bottom margin (to narrative): 8pt.

### Card treatment
- Background: `--surface` (#FFFFFF) for the page. Cards: `--card` (#F6F5F2) background, `--border` (#ECEAE4) hairline (0.5pt on iOS `@3x`), 12pt radius.
- No drop shadows. No elevation. Elevation only exists on bottom sheets (standard iOS modal shadow).
- `SupprCard` component (behind `design_system_elevation` flag) is the correct host for all cards on this surface.

### Chart styling
- **Weight chart:** terracotta `--terracotta` line + dots. Goal line: sage `--sage` dashed. EMA band: sage at 12% opacity. Grid lines: `--border` horizontal only, hairline. Y-axis: right-aligned, Inter 11pt sage. X-axis: day/date labels, Inter 11pt sage.
- **Daily calories bars:** success green `--success` (at or under), amber `--amber` (over), `--card` with `--border` stroke (zero). 6pt radius (top corners only). 4pt gap between bars.
- **Macro adherence bars:** 6pt height tracks, 3pt radius. Same green/amber fill rules.
- **Trajectory mini-chart:** terracotta dotted line (4/3 dash/gap), sage filled circle for goal dot.

### Imagery rule (enforced)
No food photography on the Progress surface. Progress is a data surface — all imagery is limited to:
- The empty-state path illustration (sage, minimal).
- The 30-day milestone modal's terracotta arc (geometric, not photographic).
- Feature flag-gated share card: if implemented, the background is white with typography only (no photography) to keep it fast to render and brand-safe.

The meal-photography rule (`@thelittleplantation` / `@_foodstories_` hyperrealistic editorial) applies to Recipes and Today surfaces. The ingredient single-subject photoreal style applies to ingredient cards within Progress only if ingredient imagery is ever added to the digest (currently not present — do not add).

### Colour semantics (enforced)
- Amber `--amber` (#C9892C): over-budget macro bars, over-target calorie bars, warning states. **Never for calorie ring** (that uses destructive red for over — see carve-out rules).
- Success green `--success` (#5E7C5A): on-target / under-budget states, goal-direction weight trend, deficit (positive).
- Terracotta `--terracotta` (#C2683E): active/primary CTA, streak dots, bar fill accent, arc fill.
- Sage `--sage` (#7C8466): secondary text, inactive labels, goal line, story gate ring background.
- No other colours are used on this surface.

---

## 5. Parity specification — web vs mobile

| Component | Mobile | Web | Gap? |
|---|---|---|---|
| Hero metric + narrative | `ProgressHeroMetric` + `ProgressHeadline` | `ProgressDashboard` header | Must match |
| Range picker | Segmented control + haptics | Segmented control (no haptics) | Intentional platform difference |
| Weight chart | `WeightChart` (react-native-svg) | recharts | Same data, different renderer — keep |
| Daily calories chart | Custom bars | recharts bars | Same data, same colours |
| Macro adherence | Custom progress bars | Progress bars | Must match |
| Maintenance card + chain | Card + expand | Card + expand | Must match |
| Digest card | `<Digest>` | `<Digest>` (shared component) | Must match |
| ProgressMetricDetail | **ABSENT** | `?metric=calories\|protein\|streak` | **Gap — see §6** |
| Log weight | `LogWeightSheet` (bottom sheet) | Inline input + `/weight-tracker` | Intentional divergence (documented) |
| Apple Health | Native `AppleHealthCardHost` | Manual steps + body-fat inputs | Intentional divergence (documented) |
| 3-stat row (Avg/Maint/Deficit) | Mobile v2 construct | Phase-2 cards | Map to equivalent web cards |
| Win-moment | Lottie + haptics | Green colour pulse | Intentional platform difference |
| Share card | Native Share sheet | Copy-to-clipboard / PNG download | Platform difference, flag-gated `progress_share_card` |
| Milestone 30-day modal | `Milestone30DayModal` | `Milestone30DayDialog` | Must match in content |

**Desktop layout (web, `md+`):**
The web `ProgressDashboard` uses a 2-column grid at `md+` breakpoints. Redesign should preserve this: left column = weight chart + daily calories + macro adherence; right column = maintenance card + digest + journey. The header hero metric spans full width above the grid.

---

## 6. Platform parity gaps (existing — flagged for roadmap)

### Gap 1: ProgressMetricDetail (web-only)
`src/app/components/ProgressMetricDetail.tsx` — deep drill-down for `calories`, `protein`, `streak` metrics — is **absent on mobile**. MacroFactor (Expenditure detail), The Outsiders (7-Day Overview), and Oura (Weekly Summary) all have this on iOS. This is the highest-priority parity gap on the Progress surface. Close via ENG (new issue required — no silent deferral).

### Gap 2: Body fat % input (web-only)
`body_fat_pct` input exists on web Progress. Not surfaced on mobile Progress as an input. Lower priority but a gap.

### Gap 3: `progress_weekly_tdee_history` not persisted
`prevWeekTdee` is not persisted (`profiles` lacks `progress_weekly_tdee_history` column), so the maintenance commentary always collapses to "steady" or "calibrating". The "Adjustment: your maintenance adjusted up/down by N kcal" regime never fires. This is a meaningful analytical gap vs MacroFactor. Known; no Linear issue assigned at time of writing. (Requires new migration — see ENG or open one.)

---

## 7. State table — every card, every state

| Card | Loading | Empty | Sparse | Data | Error |
|---|---|---|---|---|---|
| Hero metric + narrative | Rect skeleton | Story-gate ring (0/3 days) | Story-gate ring (1–2 days) | Big number + label + headline | Suppress silently → empty |
| Weight chart | 220pt rect skeleton | `WeightSparseState` CTA | `WeightSparseState` (< 2 points) | Full chart | Suppress → sparse |
| Daily calories | 160pt rect skeleton | 7 empty bars (zero fill) | 1–3 bars logged | 7 bars, over/under colour | Suppress → empty bars |
| Macro adherence | 180pt rect skeleton | Suppress entire card | Suppress if < 1 day | 3 rows | Suppress |
| Maintenance | 80pt rect skeleton | Suppress (null formula inputs → show "more profile data" note) | Show formula-only (low confidence chip) | Full card | Suppress → formula fallback |
| Digest | — | Pre-window teaser | — | Full digest card | Suppress |
| Journey | Suppress | Suppress if goal not set | "Just starting" if < 0.1 kg span | Full journey ledger | Suppress |
| Trajectory | Suppress | Suppress | Suppress if < 5 days (`MIN_DAYS_FOR_PROJECTION`) | Mini projection chart | Suppress |
| Milestone modal | — | — | — | One-time on 30 distinct days | Suppress (never re-fire) |
| Streak + freeze | Suppress | Suppress if no log | — | Full strip + freeze row | Suppress |

Suppress = card renders with zero height and no skeleton. Never render an empty card shell.

---

## 8. Microcopy guide — calm warm coach voice

All copy on this surface is: past tense for past data; present for live; observational not prescriptive; no exclamations; "estimated" language for all nutrition figures; no body shaming; no gamification pressure.

| Situation | Current copy | Redesigned copy |
|---|---|---|
| 0 days logged | "Your progress will appear here." | Same — correct, leave it |
| Pre-story (1 day) | "Your story builds with your data." | "1 more day until your first story." |
| Pre-story (2 days) | (same) | "Almost there. Log tomorrow to unlock your story." |
| Digest headline (stable) | "Last week, at a glance." | "Last week, at a glance." (correct, keep) |
| Digest headline (down) | "Last week: down X.X kg" | Same — keep |
| Digest headline (quiet week) | "Quiet week." | Same — keep |
| Closest-to-target | "Best day: {day}" | "Closest to your targets: {day}" (less comparative, more informative) |
| Days-to-goal > 365 | "More than 1 year at current rate." | Same — correct, honest |
| 30-day milestone | (TBD) | "30 days. That's a habit." |
| Sparse weight | — | "Log your weight to see how you're trending toward your goal." |
| daysSinceLatest badge | (badge, no copy) | "Last weighed {N} days ago" |
| Adaptive stale | "Maintenance (estimate)" | "Paused — log food to resume tracking" (status chip) |
| Maintenance calibrating | "Still calibrating…" | "Calibrating — we'll have an estimate after {N} more days" |
| Nutrition disclaimer | "Nutrition data are estimates. Not medical or dietetic advice." | Same — correct, mandatory, keep at foot |

---

## 9. Animation + haptics spec

| Interaction | Mobile | Web |
|---|---|---|
| Range picker change | `impactOccurred('light')` (existing, keep) | None |
| New all-time-low weigh-in (`redesign_winmoment`) | Lottie celebration (existing, keep) | Green pulse (existing, keep) |
| 30-day milestone modal entry | Terracotta arc draws 0→100%, 600ms easeOut | CSS stroke-dashoffset transition, 600ms |
| Progress bar fill (initial render) | No animation (data credibility > delight on this surface) | Same |
| Digest card expand/collapse | None — instant | None |
| "How this works" chain expand | None — instant (existing, keep) | None |

No entrance animations. No stagger. No parallax. This is an analytical surface — motion should only appear where it communicates meaning (the arc tells the story of reaching 30 days).

---

## 10. Feature flags required

| Flag | Scope | Default | Controls |
|---|---|---|---|
| `progress_redesign_v2` | web + mobile | off | The entire visual redesign described in this spec (ship behind this flag; old layout is the `else` path) |
| `progress_trajectory_box` | web + mobile | off | Trajectory card (existing flag, already exists) |
| `redesign_winmoment` | web + mobile | off | Win-moment overlay (existing flag, already exists) |
| `design_system_elevation` | mobile | off | Mobile v2 layout (existing flag, already exists) |
| `progress_digest_blend` | web + mobile | off | Blended digest (existing flag, already exists) |
| `progress_tdee_windows` | web + mobile | off | Multi-window TDEE change table (new, additive) |
| `progress_share_card` | web + mobile | off | Share card image renderer (new, additive) |

All redesign visual/structural changes are under `progress_redesign_v2`. Flags that already exist are unchanged. New additive flags (`progress_tdee_windows`, `progress_share_card`) are independent of the main redesign flag and can be ramped separately.

---

## 11. FUNCTIONALITY PRESERVED checklist

Every feature, data point, chart, insight, and gating mechanism from the functional inventory is accounted for below. Nothing is removed. Items marked IMPROVED have a corresponding redesign change that elevates presentation without changing logic.

### Screens / routes / sheets / modals
- [x] Progress tab main (scrollable card stack) — PRESERVED
- [x] Progress loading skeleton (header + range picker + 4 tiles + spinner) — PRESERVED, heights updated to match card sizes
- [x] Progress empty state ("Your progress will appear here") — PRESERVED, sage illustration refinement
- [x] Log Weight sheet (mobile bottom sheet, edit-in-place, `editWeightDate`) — PRESERVED
- [x] All Weight Data sheet ("See all measurements" Withings-list, long-press edit/delete) — PRESERVED, styled as hairline row at chart bottom
- [x] 30-Day Milestone modal (one-time, `milestone_30_shown_at`, fires on Progress focus) — PRESERVED, tone redesigned
- [x] Weekly Digest / Recap card (Sat 18:00 → Tue/Wed window, dismiss per week, Share + Adjust Pace + Save Combo CTAs) — PRESERVED, hierarchy improved
- [x] Win-moment overlay (`redesign_winmoment`, new all-time-low weigh-in, Lottie/green pulse) — PRESERVED
- [x] ProgressMetricDetail web deep-drill (`?metric=calories|protein|streak`) — PRESERVED (gap noted in §6 — roadmap)
- [x] Weight-tracker legacy route (backwards compat) — PRESERVED, not touched

### Data + calculations
- [x] Adaptive TDEE formula (`TDEE = avgIntake − smoothedWeightChange × 7700`, EMA_ALPHA=0.1, 28-day window) — PRESERVED, `7700` constant unchanged
- [x] `MIN_LOGGING_DAYS = 7`, `MIN_WEIGH_INS = 3` gates — PRESERVED
- [x] Confidence levels (high: ≥21 days & ≥7 weigh-ins; medium: ≥14 & ≥5; else low) — PRESERVED
- [x] `ADAPTIVE_STALE_DAYS = 14` staleness gate — PRESERVED, now surfaced as "Paused" chip
- [x] Maintenance resolution (`resolveMaintenance.ts`): adaptive preferred when medium/high + not stale; else Mifflin-St Jeor; null if inputs incomplete — PRESERVED
- [x] `adaptiveRejectedAsStale` flag — PRESERVED, now visible as amber "Paused" chip
- [x] `maintenanceChain.ts` steps (BMR → activity → adaptive adj → maintenance → deficit → goal) — PRESERVED, now rendered as Alma-style numbered ledger
- [x] `KCAL_PER_KG_FAT = 7700` and projected-loss caveat — PRESERVED, always rendered in chain expand
- [x] 3-stat row: Avg intake / Maintenance / Deficit (positive=green, negative=amber "surplus") — PRESERVED
- [x] Effective target calories = base + activity bonus (`computeActivityBonusKcal`, ENG-787) — PRESERVED for bar colouring
- [x] Per-day `daily_targets` snapshot for approximate-day cue (dashed border) — PRESERVED
- [x] Macro adherence: `proteinAdherence = round(avgProtein/target × 100)` over days-with-food; `isOver` → amber; `MACRO_ADHERENCE_BAR_CAP_PCT = 150` but bar clamps at 100 — PRESERVED
- [x] `proteinOnTarget` = days where protein ≥ 90% of target — PRESERVED, now sub-label on Protein row
- [x] Range cards (`buildWeightRangeStats`, `buildCaloriesRangeStats`) over 7/30/90/all — PRESERVED
- [x] `computeWeightTrend`: MFP-style bucket, calendar-day moving average, same-day dedup, iterative min/max, goal line — PRESERVED
- [x] `computeWeightChartDomain`: data-driven padding, goal only if within proximity — PRESERVED
- [x] `calcGoalTimeline`: remaining kg, weeklyRateKg (28-day), `MAX_DAYS_TO_GOAL = 365`, Tukey-robust peak/trough baseline, `daysToGoalUncapped` — PRESERVED, start/goal/current ledger added
- [x] `weightJourneyProgress` / `computeWeightJourneyProgressPct`: pct from Tukey baseline, 540-day lookback, null if span < 0.1 kg — PRESERVED
- [x] Journey copy: "Just starting" / "X% of the way there" / "Goal reached" — PRESERVED
- [x] `projectWeight` (`MIN_DAYS_FOR_PROJECTION = 5`, observed rate preferred when |rate| ≥ 0.05 and direction matches, `weeksOut = 5`, floor 30 kg) — PRESERVED
- [x] `weeklyRecap.ts`: daysLogged, avgCalories/Protein, proteinAdherencePct, streakLength (protected), freezesAvailable, bestDay (closest-to-target, L1 normalised deviation, 80% macros gate, null if no eligible day), weightDeltaKg/First/Last (≥2 weigh-ins else null), avgFiberG, avgHydrationMl — PRESERVED
- [x] `weekKeyFor` = `YYYY-Www` honouring `week_start_day` — PRESERVED
- [x] `shouldShowRecap` window (Sat ≥18:00 → Tue/Wed or Sun ≥18:00 → Wed per `weekStartDay`) — PRESERVED, pre-window teaser added
- [x] `resolveDigestHeadline` first-match: Quiet week / down/up ≥0.3 kg / Closest to target / Streak ≥7 / "at a glance" — PRESERVED, now rendered at Fraunces 22pt
- [x] `classifyDigestHeroTone`: under=green / over=red / within ±4% (min ±40 kcal)=neutral — PRESERVED
- [x] `digestStory.ts` sentence-level suppress-when-lie logic — PRESERVED
- [x] `dayOfWeekPattern.ts`: 28-day window, ≥14 logged days, ≥200 kcal high/low delta gates — PRESERVED
- [x] `progressCommentary.ts` regimes (adjustment / calibrating / steady), calibrating sub-states (first-week <3 days, mid-warmup) — PRESERVED
- [x] `STORY_DATA_FLOOR_DAYS = 3` — PRESERVED, now fraction ring with countdown
- [x] `weeklyCheckin.ts`: `MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE = 3`, `TDEE_NOISE_FLOOR_KCAL = 20`, 6-day cooldown, `MIN_DAYS_LOGGED_FOR_CHECKIN = 5`, `MIN_SUGGESTED_TARGET_KCAL = 1200`, `floorAppliedKcal` explainer — PRESERVED
- [x] `milestone30Day.ts`: `MILESTONE_30_DAY_THRESHOLD = 30` distinct days, top 3 foods excluding HK fallback titles, `longestStreak`, `totalWeightDeltaKg` null-safe (< 2 weigh-ins → null) — PRESERVED
- [x] `streakFreeze.ts`: `computeLoggingStreak` (raw, never mutated), `computeProtectedStreak` (freeze-consumed), `availableFreezes = earned − used`, clamped to `budgetMax` (default 3, range 0–10), `earnFreezeIfMilestone` (1 per 7-day crossing), 90-day ledger compaction — PRESERVED, earn-mechanic now visible
- [x] Weekly recap push (server cron, dual-rail Expo + VAPID, 6-day dedupe, 5000-row cap, tz filter, body variants, `weekly_recap_push_enabled` opt-out) — PRESERVED (no client-side changes)
- [x] Digest suggestion cascade (5 rules, first-match: re_log_prompt / maintenance_recalibration with 14/21-day cooldowns / protein_nudge / streak_protection / weight_trend_mismatch) — PRESERVED, now rendered as "One thing" nudge card

### Interactions + states
- [x] Loading skeleton (30s timeout fallback, never perpetual) — PRESERVED
- [x] Empty state — PRESERVED
- [x] Error (try/finally always flips loading=false, warns to console) — PRESERVED
- [x] Steps sync tri-state (pending=skeleton, success=honest 0, failed=error CTA) — PRESERVED
- [x] Over-budget amber (macro bars, calorie bars) — PRESERVED. Calorie ring destructive-red carve-out NOT on this surface (Progress bars use amber per rules) — CORRECT
- [x] Win-moment (`redesign_winmoment`): new all-time-low — PRESERVED
- [x] Weight surface modes: `show` / `trends_only` / `hide` — PRESERVED
- [x] Range picker haptic (mobile, existing) — PRESERVED
- [x] Digest: dismiss (`weekly_recap_last_seen_week_key`), Share, Adjust Pace (→ Targets), Save Combo / Start Usual Meal (→ Today with pending-save seed) — PRESERVED
- [x] Maintenance "How this works" expand/collapse (in-memory, no network) — PRESERVED, redesigned as ledger
- [x] `chartsReady` RAF defer for first-paint perf — PRESERVED (implementation detail)
- [x] HouseholdBar (hidden for solo user) — PRESERVED

### Feature flags
- [x] `design_system_elevation` (mobile v2 layout / SupprCard) — PRESERVED
- [x] `progress_digest_blend` (blended digest) — PRESERVED
- [x] `progress_trajectory_box` (trajectory card) — PRESERVED
- [x] `redesign_winmoment` (weight win-moment) — PRESERVED
- [x] `progress_plateau_insight_v1` (ENG-954 calm plateau line on the weight chart) — SHIPPED, default-ON (2026-06-30, ENG-1279)
- [x] `progress_milestone_celebration_v1` (ENG-952 quiet two-tier milestone celebration on weigh-in) — SHIPPED, default-OFF

**Total preserved: 67 functional items.** Zero removals. Improvements are additive only.

---

## 12. Net-new additive capabilities

These are flagged as additive — they deepen functionality, do not simplify it, and are all flag-gated:

1. **Stat-pair header on weight chart** (avg weight + Δ vs period) — additive presentation of `buildWeightRangeStats` data that already exists.
2. **Confidence-as-band** on weight chart — additive rendering of existing `confidence` field. Requires `computeEMAResidualBand` helper.
3. **Status chip on maintenance card** (Tracking / Updating / Calibrating / Paused / Estimated) — additive rendering of existing `confidence` + `adaptiveRejectedAsStale` + `source` fields.
4. **Alma-style numbered ledger** for "How this works" — additive rendering of existing `maintenanceChain.ts` output.
5. **Pre-window teaser** for digest — additive state derived from existing `shouldShowRecap` logic.
6. **"One thing" nudge card** for digest suggestions — additive rendering of existing `weeklyDigestSuggestion.ts` output.
7. **Per-day target dots** on daily calories chart — additive use of existing per-day `effectiveTargetCalories`.
8. **Start/goal/current/Δ ledger** on journey card — additive rendering of existing `calcGoalTimeline` + `profiles` data.
9. **Multi-window TDEE change table** (flag `progress_tdee_windows`) — additive; builds from existing range stat windows.
10. **Share card** (flag `progress_share_card`) — new renderer; uses existing data only.
11. **Freeze earn-mechanic visibility** — additive display of the `earnFreezeIfMilestone` 7-day-crossing logic that already runs silently.
12. **Mobile ProgressMetricDetail parity** — closing the documented web-only gap (roadmap item, not in this spec — requires separate ENG issue).
13. **Calm plateau insight** (ENG-954, flag `progress_plateau_insight_v1`, default-ON 2026-06-30 ENG-1279) — `computeWeightTrend(...).plateauInsight` in `src/lib/progress/weightTrend.ts` (re-exported to mobile via `@suppr/shared/progress/weightTrend`). Detects a flat RECENT stretch (≤ `PLATEAU_FLAT_THRESHOLD_KG` = 0.4 kg drift over the trailing window, ≥ `PLATEAU_MIN_FLAT_DAYS` = 7 days) sitting on a LONGER trend still meaningfully moving toward goal (|Δ| ≥ `PLATEAU_MOVING_THRESHOLD_KG` = 0.8 kg). Returns a body-neutral reframe line ("held flat for N days; that's normal — your trend is still down X kg") — the calm-coaching counter to Withings' "flat = no progress" failure mode. Returns `null` when the long trend is also flat, the flat span swallows the whole range, points are too few, or the long trend moves AWAY from goal (suppress-when-it-would-be-dishonest). Same condition web ↔ mobile.
14. **Quiet milestone celebration** (ENG-952, flag `progress_milestone_celebration_v1`, default-OFF) — `computeWeightMilestone` in `src/lib/nutrition/weightWinMoment.ts` (imported on mobile via `@suppr/nutrition-core/weightWinMoment`). Divides the start→goal span into `MILESTONE_COUNT` = 10 evenly spaced thresholds (Happy Scale parity) and fires a RESTRAINED celebration (a soft Light haptic on mobile, not the loud Success notification) when a save crosses into a new milestone band the most recent prior weigh-in had not reached. Suppressed: the goal milestone itself (index 10 — owned by the loud new-all-time-low moment), the first ever weigh-in (no prior band to cross), a re-save inside the same band, no goal set, and start→goal spans below `MILESTONE_MIN_SPAN_KG` = 1 kg (sub-noise). The quiet tier only fires when the save is NOT also a new all-time low. Same thresholds web ↔ mobile.

---

*Spec complete. All 67 functional items preserved. Implementation must ship behind `progress_redesign_v2` flag. All additive capabilities have their own flags and can be ramped independently.*

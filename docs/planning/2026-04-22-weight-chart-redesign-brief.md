# Weight chart — redesign brief (2026-04-22)

Source of brief: `ui-product-designer` agent run 2026-04-22. TestFlight pilot-round C6-chart (`AKuLcrQUR7pf`, `AGM9xRpzTLnD`) + earlier reference screenshots `AF7bS2DQrH_w`.

## 1. What's wrong today

- **Y-axis scale is naive.** Likely `min=0` or `min=floor(all data)` — a 0.9 kg swing on a 72 kg person renders as a flat line.
- **Tick density doesn't adapt to range.** Same tick count for 1W / 1M / 3M / All → noise or emptiness.
- **No baseline of meaning.** No goal line, no starting-weight line, no 7-day moving average — a single heavy-water morning looks like a setback.
- **Sparse data renders as zig-zag** or a single dot in whitespace. No acknowledgement that 2 weigh-ins is not a trend.
- **"Since {date}" label is range-agnostic** — reads as absolute origin even on 1W.
- **Dots are undifferentiated** — today's weigh-in, manual entries, and HealthKit entries all look the same; the latest isn't emphasised.
- **Tone is reactive, not directional** — F-31 patched colour but the chart still flips red/green per datapoint instead of reading the trend.

## 2. Target visual

Reference screenshots (`AF7bS2DQrH_w`): a calm area-fill line with a soft gradient, a dotted goal line, a prominent latest-weight dot, and a compact range switcher above.

- **Y-axis policy:** `[min(data, goal) − padding, max(data, goal) + padding]` where `padding = max(0.8 kg, 8% of range)`. Never starts at 0. Always includes goal line in-frame. 3 horizontal gridlines max, `textMuted` at 11pt, right-aligned inside plot.
- **X-axis range toggle:** segmented control — **1W · 1M · 3M · 1Y · All** — pill style, matches prototype's segmented control token. Default 1M. Persists per session.
- **Primary line:** 7-day moving average, 2px, `accent` (goal-aligned) or `warning` amber (trending away from goal over selected range, not per-point). Gradient fill underneath at 12% → 0% opacity.
- **Goal line:** 1px dashed `textMuted` at goal weight, with a small right-edge chip reading `Goal 72.0`.
- **Raw weigh-in dots:** 4px circles, `surface` fill with 1.5px `accent` stroke, 60% opacity (evidence, not the story). Latest weigh-in: 8px, filled `accent`, floating label `74.2 · Today` above it.
- **No hover/tooltip on mobile** — tap a dot to pin a caption above the chart (`74.2 kg · Mon 18 Apr · HealthKit`).

## 3. Fewer than 3 weigh-ins

Do not render a chart. Render `WeightSparseState` component: centred soft illustration (scale glyph), headline, body, primary button.

- **0 weigh-ins:** "No weigh-ins yet" / "Log your first weight to start a trend." / `[Log weight]`
- **1 weigh-in:** "One weigh-in logged" / "Add two more to see a trend line." / `[Log weight]` · shows the single value as a big number.
- **2 weigh-ins:** Show two dots connected by a thin `textMuted` line, no moving average, no fill, caption "Trend appears after 3 weigh-ins."

## 4. Copy around the chart

- **Overline** (above card): `WEIGHT` — `text-xs`, `letterSpacing 1.2`, `textMuted`.
- **Range-aware since label:** "Last 30 days" / "Last 7 days" / "Since 12 Jan" (All). Never "Since {signup date}" on short ranges.
- **Trend sub-label:** "Down 0.4 kg on average" (moving-average delta over range, not raw first-vs-last). Neutral if |Δ| < 0.2 kg: "Holding steady."
- **Empty state headline:** see §3.
- **Stale guard (carry F-56):** if latest weigh-in > 10 days old, show inline chip `Last logged 14 days ago · Update` above the chart.

## 5. Tokens (`apps/mobile/constants/theme.ts`)

- Colours: `colors.accent` (line + latest dot), `colors.accentMuted` (gradient fill), `colors.warning` (off-track trend), `colors.textMuted` (grid, goal line, axis), `colors.surface` (card + dot fill), `colors.border` (card stroke).
- Spacing: card `padding: spacing.lg` (16), chart height `h.chart` = 180, plot inset `spacing.sm` (8) top, `spacing.md` (12) bottom for axis labels.
- Type: overline `typography.overline`, trend sub-label `typography.bodyStrong`, axis `typography.caption`, pinned dot caption `typography.body`.
- Radii: card `radii.lg` (16), segmented control `radii.pill`.

## 6. Ordered file-level changes (executor)

1. **New:** `apps/mobile/components/progress/WeightChart.tsx` — pure presentational; props `{ points: {dateISO, kg, source}[], goalKg, range, trendDirection }`.
2. **New:** `apps/mobile/components/progress/WeightRangeToggle.tsx` — segmented control, controlled via `range` state on parent.
3. **New:** `apps/mobile/components/progress/WeightSparseState.tsx` — 0/1/2 weigh-in variants.
4. **New:** `apps/mobile/lib/progress/weightTrend.ts` — computes y-domain, 7-day MA, range-filtered points, trend direction, range-aware since-label.
5. **Edit:** `apps/mobile/app/(tabs)/progress.tsx` — `WeightCard` becomes a shell: overline + trend sub-label + toggle + (chart | sparse). Replace raw `weightKgByDay` mapping with `useWeightSeries(range)` hook wrapping the lib.
6. **Edit:** stat-tile above chart — drive delta from the same MA trend, not raw last-vs-prior, so chart and tile agree.
7. **Tests:** snapshot each of 0/1/2/3+/stale/off-track states; unit-test `weightTrend.ts` domain + MA + since-label.

## 7. Web parity

`src/app/components/WeightTracker.tsx` has the same failure modes. **They should converge.** Move `weightTrend.ts` logic to shared `src/lib/progress/weightTrend.ts` with a mobile re-export so domain/MA/since-label are computed identically. Visual: web gets the same segmented toggle, MA line, goal line, sparse-state copy — adapted to web tokens. Flag to `sync-enforcer`: weight chart is a parity item. Land web in the same PR or the next one.

## Open questions

- Goal line source: read `goal_weight_kg` from profile or infer from active plan? (ask `product-lead`).
- HealthKit-sourced dots visually distinct from manual? Proposal: no — source shown only in pinned caption.

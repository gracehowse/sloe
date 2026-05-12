# Weight chart — outstanding polish items (Grace TF feedback, 2026-05-11)

**Context:** PR #233 shipped the Withings-style rebuild (period date range,
visible divider, tighter Y-padding, halo dot, sparse raw dots, tooltip
collision fix, de-duplication of the second weight card). Grace's verdict
after the final iteration: **"still not good enough but lets wrap this
up for now"**.

This file captures what's still off so the next session can pick up
without re-walking the discovery.

## What's already shipped (PR #233 squashed into main)

- ✅ "No data" header bug → falls back to raw first/last delta when MA
  can't compute; single entry → "Stable" not "No data"
- ✅ Duplicate `<WeightRangeCard>` ("WEIGHT 54.3 kg / On track / mini
  chart") above the big chart card removed in `show` mode (mobile + web)
- ✅ Tabs + list-icon button on ONE row (orphan row killed)
- ✅ Period label is real date range "12 Apr – 6 May 2026" (was fuzzy
  "Last 30 days")
- ✅ Visible 1px divider between WEIGHT and TREND columns
- ✅ Floating "Goal X kg ↓" off-chart chip removed
- ✅ Tooltip clamps inside plot bounds, never overlaps Y-axis labels
- ✅ Latest dot has soft halo ring
- ✅ 4 Y-axis labels (was 3)
- ✅ Sparse raw dots when `bucket === "daily" && points.length > 14`
- ✅ Chart container 200 → 170px tall
- ✅ Y-domain padding minimum 0.8 → 0.4 kg per side
- ✅ All-data Withings-style chronological list view (modal sheet,
  month-grouped, long-press → delete)

## What Grace flagged as still not right

She didn't enumerate specifics on this last iteration, but earlier in
the session she used the words "still looks bad / messy / illogical".
After the rebuild + the squish fix, her response was "still not good
enough". Honest reading of what's likely still off, from comparing the
last screenshot vs the Withings reference:

1. **Chart still feels slightly empty on phone** even with the 170px
   height + 0.4 kg padding. The Withings chart on screenshot 4 sits
   tighter against its top + bottom edges. Could push further:
   `CHART_HEIGHT` 170 → 150 and padding 0.4 → 0.3 (with floor 0.6 kg
   span). Risk: 0.2 kg daily fluctuation starts looking like a real
   change.

2. **Tooltip pointer doesn't anchor to the actual dot** when X gets
   clamped (latest dot at right edge, tooltip pushed left of the
   gutter). The arrow triangle points at empty space, not the dot.
   Fix: render the SVG `<polygon>` arrow at the actual dot's x-coord,
   not at the tooltip's centre.

3. **No "Explore Data" or full-screen view** — Withings's chart card
   on the Weight tab is a SMALL surface that opens into a tappable
   full-screen drill with zoom + pinch + weekly delta labels under
   the axis. We have the inline chart only. Adding a tap-to-expand
   pattern would unlock the rest of Withings parity (zoom, period
   nav arrows, weekly deltas).

4. **No "Weight Breakdown" section** below the chart — Withings
   carousels BMI / Basal metabolic rate / Body water tiles. We could
   surface BMI calculated from `profiles.height_cm` + latest weight.

5. **Period nav arrows** (< 12 Apr – 6 May 2026 >) — Withings lets
   you scroll backward through months. Our card is locked to the
   current window for the selected range. Adds state for "which
   period anchor"; defer until #3 lands as a follow-up.

6. **Imperial-mode visual at edge values** — never sim-validated. The
   tooltip width is fixed 130px; "−12.5 lb" + "Wed" might overflow.

## Recommended ordering for next session

1. **Tooltip pointer arrow fix** (small, visible win): render the
   pointer at the dot's X position, not the tooltip centre.
2. **Tighter chart proportions round 2**: CHART_HEIGHT 170 → 150, Y
   padding floor 0.4 → 0.3, min total span 0.8 → 0.6.
3. **Tap-to-expand full-screen "Explore Data" view** — separate PR,
   bigger lift. Unlocks weekly delta labels + period nav.
4. **Weight Breakdown tiles** (BMI from height + weight) — separate
   PR, low-risk content add.

## What NOT to do

- Don't re-add the goal line / off-chart goal chip inside the chart
  surface — Grace explicitly rejected that as visual junk. If the
  goal needs to be visible on Progress at all, surface it as a small
  pill in the Journey card section (which is below the chart and
  already shows "75 days to goal" + "Goal: 50 kg").
- Don't re-add the small `<WeightRangeCard>` above the chart even if
  someone asks "where's my latest weight number at a glance?". The
  big chart card now shows it via the WEIGHT/TREND header + the
  Journey card below shows "Now: 54.3 kg". Two surfaces for one
  number is enough.

## Reference

- `docs/ux/weight-chart-withings-mockup.html` — the mockup Grace
  signed off; reload in a browser to compare against the live build
- Withings screenshots Grace shared 2026-05-11 — see the chat
  transcript for the canonical reference

# Progress + metric-detail elevation, calm header, weight-param fix, weight win-moment (2026-05-31)

**Status:** Resolved
**Area:** Progress tab / metric-detail / weight-entry / cross-platform
**Owner:** Grace
**Tickets:** ENG-822 (metric-detail elevation + calm header + param fix), ENG-824 (Progress win-moments)
**Initiative:** Redesign — Design Direction 2026 (see
`docs/decisions/2026-05-31-design-director-review-and-direction.md`)

## What changed

The Progress + weight surfaces in the 2026-05-31 design-director review scored
**Delight: Prototype** and the macro-detail screens **Depth: Generic, Motion:
Cheap, Delight: Cheap** — the deepest "competent tracker" drop in the product.
Two items address that.

### ENG-822 — metric-detail: soft elevation, calm header, fixed weight param

The per-metric drill-down (`progress-metric.tsx` on mobile,
`ProgressMetricDetail.tsx` on web) had three issues the review flagged:

1. **Flat hairline cards** while the parent Progress tab carries real cards —
   the detail read as a flatter, less-finished surface than the tab it drilled
   in from.
2. **A shouty header.** A saturated-blue, ALL-CAPS, letter-spaced (2px) banner
   ("CALORIES THIS WEEK") — the loudest, least-calm element on the screen.
3. **The `metric` param was silently ignored for `weight`.** A
   `progress-metric?metric=weight` deep-link fell through the unknown-metric
   default to `calories` and rendered a "CALORIES THIS WEEK" screen mislabelled
   as weight. Capture proof: `apps/mobile/screenshots/full/metric-calories-s00.png`
   and `metric-weight-s00.png` were **byte-for-byte identical** (same SHA).

Fixes:

- **Soft elevation behind `design_system_elevation`.** Mobile applies the
  shared `useCardElevation()` hook (spread as `...cardSurface` onto every card:
  the calorie chart card, the per-day rows, the protein stat tiles, the streak
  headline + day rows). Flag ON (light) → soft `Elevation.cardSoft` shadow, no
  border; dark → tonal lift + hairline; flag OFF → today's flat hairline. Web
  mirrors it with the established `isFeatureEnabled("design_system_elevation")`
  → `border-transparent shadow-[var(--elev-card-soft)]` vs flat
  `border border-border` branch (same pattern as the recipe/dialog surfaces).
- **Calmed header.** Mobile: normal-case `{title}` in the foreground colour
  (was `{title.toUpperCase()}` in `Accent.primary` with `letterSpacing: 2`).
  Web: `text-xl font-bold text-foreground` (was
  `text-primary tracking-wide uppercase`). The subtitle below already carries
  the context, so the title doesn't need to shout. This is a calm-down, not a
  new visual pattern, so it is **not** flag-gated.
- **Weight param fixed.** Mobile redirects a `metric=weight` deep-link to the
  Progress tab (`router.replace("/(tabs)/progress")`) and renders a neutral
  spinner while redirecting — the calories chart never flashes. Weight is **not**
  a metric-detail metric: it has its own surface (the Progress-tab chart +
  `LogWeightSheet`). Web never had the bug — `coerceProgressMetric` already
  returns `null` for anything but `calories|protein|streak`, so the dashboard
  simply renders the dashboard (not a wrong chart) for `metric=weight`; a test
  now pins that.

### ENG-824 — reserved weight win-moment on a new all-time low

The weigh-in is a genuine landmark with zero payoff today. Per the 3rd spine
rule (one reserved win-moment, gated to landmarks only — never every save), the
single weight landmark worth a loud celebration is a **new all-time low**.

Behind **`redesign_winmoment`** (old silent save preserved in the flag-off arm
on both platforms), the landmark is detected by a new shared, framework-free
helper `isNewWeightLow()` in `src/lib/nutrition/weightWinMoment.ts` so web and
mobile fire on **identical** conditions:

- A save is a new low only when strictly below the prior minimum (by ≥ a 0.05kg
  epsilon that guards kg↔lb round-trip dither), **and** a prior baseline exists.
- The **first-ever weigh-in is not a low** (no baseline to beat) — celebrating
  it would cheapen the reserved moment.
- An edit of an existing entry is judged against the **rest of history**, never
  its own stale value.

Side-effects (flag-gated):

- **Mobile (`LogWeightSheet.tsx`).** New low → loud `Haptics.notificationAsync(Success)`;
  any other save → quiet `Haptics.impactAsync(Light)` (the <100ms confirm beat).
  `onSaved` now reports `isNewLow`; the Progress tab mounts the reserved
  `WinMomentPlayer celebration="goal-hit"` overlay (lazy Lottie, plays once) and
  emits the shown event.
- **Web (`ProgressDashboard.tsx`).** No Haptics API — the web analog is a brief
  green win-colour pulse on the latest-weight figure (`text-success` for ~200ms,
  honouring `prefers-reduced-motion`) plus the same reserved `WinMomentPlayer`
  mounted over the weight card.
- **Analytics.** New cross-platform event `weight_new_low_win_moment_shown`
  (`{ platform }` only — body-weight is HIGH-class PHI, so no weight value in
  the payload). Distinct from the Today `day_target_hit_win_moment_shown`
  landmark.

## Cross-platform parity

| Aspect | Web | Mobile |
|---|---|---|
| Metric-detail card elevation | `shadow-[var(--elev-card-soft)]` (flag) | `useCardElevation()` (flag) |
| Calm header | `text-foreground` | foreground colour, normal case |
| `metric=weight` deep-link | dashboard (coerced to null) | redirect → Progress tab |
| New-low detector | `isNewWeightLow` (shared) | `isNewWeightLow` (shared) |
| Win flag | `redesign_winmoment` | `redesign_winmoment` |
| New-low feedback | green colour pulse | `notificationAsync(Success)` |
| Ordinary-save confirm | — (no Haptics API) | `impactAsync(Light)` |
| Reserved celebration | `WinMomentPlayer` (goal-hit) | `WinMomentPlayer` (goal-hit) |
| Shown event | `weight_new_low_win_moment_shown` `{platform:"web"}` | …`{platform:"ios"}` |

The haptic-vs-colour-pulse asymmetry is **platform-capability**, not drift — web
has no Haptics API; the colour pulse is the shared payoff. Documented here so
`sync-enforcer` does not flag it.

## Tests

- `tests/unit/weightWinMoment.test.ts` — the pure new-low detector: strict-low,
  first-weigh-in (no fire), tie/over (no fire), sub-epsilon dither (no fire),
  edit-of-today judged against history, non-finite guards.
- `apps/mobile/tests/unit/logWeightSheetWinMoment.test.tsx` — behavioural: flag
  ON + new low → success haptic + `isNewLow:true`; flag ON + not-a-low → quiet
  confirm only; flag OFF → no haptic, silent save preserved.
- `tests/unit/progressDetailRedesign.test.ts` — cross-platform source pins:
  metric-detail soft-elevation flag gate (both), calmed header (no ALL-CAPS
  primary banner survives), `metric=weight` no longer renders calories (mobile
  redirect / web coercion), and the weight win-moment wiring (shared detector +
  `redesign_winmoment` gate + haptic split + reserved player + PHI-safe event).

## Flags

- `design_system_elevation` — gates the metric-detail soft-elevation on both
  platforms (shared with the project-wide card sweep). Calm header + weight
  param fix are correctness/visual cleanups, not flag-gated.
- `redesign_winmoment` — gates the whole weight win layer (detector side-effects,
  haptics/pulse, reserved player, shown event) on both platforms. Already
  provisioned for the Today/Plan win-moment work.

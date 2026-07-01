# Trend-only / hide-weight mode (ENG-713)

**Date:** 2026-07-01
**Status:** Implemented behind `progress_trend_only_v1` (flag default-ON, preference default-OFF).
**Copy status:** DRAFT — **needs `diversity-inclusion` + `legal-reviewer` sign-off before the flag ramps beyond the solo tester.**
**Linear:** ENG-713 (P2 dignity, post-launch). Related: ENG-1098 (Calm mode), T13 (`weight_surface_mode`).

## Problem

Some users — particularly those with an eating-disorder history or weight
dysphoria — want a progress signal without the number. The Progress tab today
shows a numeric weight chart, a current-weight figure, a "this week" delta, a
goal-gap, and a projection. For this cohort, every one of those is a trigger.

## Decision

Add a **body-neutral "Trend-only weight" opt-in** on the Progress tab. When on,
every numeric weight surface on Progress (chart, current figure, delta, goal
row, trajectory, journey/projection) is hidden and replaced with a single calm
qualitative direction card: a neutral phrase ("Holding steady", "Trending down
gently", "Trending up gently") with no number, unit, valence, or goal-gap.

Weigh-in **entry** stays fully available (the user can still log) — the number
is simply never echoed back in this mode.

## How it's built (and why no schema)

### Reuse the calm-mode / display-prefs mechanism — no DB column

The preference is a **client-side display preference**, stored exactly like
`calm_mode` and `macroDisplayStyle`:

- Web: `localStorage["suppr.prefs.trend_only_weight"]`
- Mobile: AsyncStorage `"suppr.prefs.trend_only_weight"`
- Default **OFF** (the feature is opt-in). Same key both platforms.

Shared primitives + copy live in one place:
`src/lib/preferences/trendOnlyWeight.ts` (imported by mobile via
`@suppr/shared/preferences/trendOnlyWeight`). React/RN hooks mirror the
calm-mode hooks (`useTrendOnlyWeight`).

**No migration. No `profiles` column.** This was a hard constraint (ENG-713):
the ENG-1098 "Calm mode" container was explicitly named for an umbrella so the
hide-weight toggle (diversity-inclusion **DI-P0-03**) could fold in later
without a rename (product-lead call 2026-06-14). This is that toggle.

### Composition with the pre-existing T13 `weight_surface_mode` (no fork)

A **separate, DB-backed** `profiles.weight_surface_mode` (`show` / `hide` /
`trends_only`, migration `20260503100100`, T13) already exists and already
gates the Progress weight surfaces on both platforms, rendering a
`trends_only` direction card. That control is **orthogonal and untouched**.

Rather than fork a second weight-hiding render path, the Progress screens compute
an **effective** surface mode via a shared pure helper:

```
resolveEffectiveWeightSurfaceMode(dbMode, prefOn, toggleAvailable)
  → toggleAvailable && prefOn && dbMode === "show" ? "trends_only" : dbMode
```

The client-side pref only **escalates** a `show` surface toward `trends_only`.
It never overrides a user's DB `hide`/`trends_only` back to numbers. When the
flag is off or the pref is off, the DB mode passes through unchanged → today's
behaviour exactly (kill switch). The trend card + all numeric gates already read
the effective mode, so both opt-out sources share one render path.

The T13 card's old copy ("Slightly up/down this week") was replaced with the new
neutral strings from the shared helper, so both opt-out paths now speak the same
body-neutral language (a consolidation, not a divergence).

## The neutral copy (needs DI + legal sign-off)

Authored conservatively per the repo's body-neutral posture. **These strings are
dignity-sensitive and are NOT yet signed off.** `describeTrendOnly(direction)`:

| Direction | String |
|---|---|
| down | `Trending down gently` |
| up | `Trending up gently` |
| steady | `Holding steady` |
| none (no weigh-in) | `Add a weigh-in to see your trend` |

Mode note (always shown under the phrase):
`Showing direction only. Turn numbers back on any time in Settings.`

Settings toggle label / hint:
- **"Show weight as a trend"**
- "Hides the weight chart and numbers on Progress, showing only a gentle
  direction. You can still log weigh-ins — they just won't be shown back to you."

**Copy rules held (pinned by `tests/unit/trendOnlyWeight.test.ts`):**
- never a number, unit (kg/lb), or goal-gap figure
- no good/bad valence; up and down are described symmetrically
- direction is gentle continuous motion, not an achievement or congratulation
- "steady" is neutral ("holding"), not praised
- the empty case invites, it doesn't instruct or shame ("add a weigh-in", not
  "you must log")
- no scale imagery
- the mode note names the exit so the mode never feels like a trap

> **Action for `diversity-inclusion` + `legal-reviewer`:** review the six strings
> above before the `progress_trend_only_v1` flag ramps past the solo tester. The
> flag being default-ON only exposes the *toggle*; the feature stays opt-in
> (preference default-OFF), so nothing renders these strings to a user until they
> opt in — but the strings must be signed off before any real ramp.

## Flag + preference model

- **Flag `progress_trend_only_v1`** — registered in `REDESIGN_DEFAULT_ON` on
  **both** `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`
  ("always flag on" beta-window policy). The flag controls whether the opt-in
  **toggle exists** — nothing more.
- **Preference `suppr.prefs.trend_only_weight`** — client-side, default **OFF**.
  Controls whether the feature is actually active.

So: flag ON (toggle available) + preference OFF (no behaviour change until the
user flips it). Parity of the flag registration is pinned by
`tests/unit/trendOnlyFlagParity.test.ts` and `redesignDefaultOnParity.test.ts`.

## Analytics

`trend_only_weight_toggled` (`{ enabled, platform }`) fires on each committed
toggle, web + mobile, same event name. **Dignity: the payload never carries a
weight value, delta, or direction** — the event must not leak the thing the mode
exists to hide. Pinned by `tests/unit/trendOnlyWiring.test.ts`.

## Parity

Web and mobile both ship the toggle + the effective-mode behaviour. Shared
trend-copy + composition logic live in `@suppr/shared/preferences/trendOnlyWeight`
and are consumed by both — no divergent reimplementation. The Settings toggle is
extracted to a small per-platform component
(`src/app/components/settings/TrendOnlyWeightToggle.tsx` /
`apps/mobile/components/settings/TrendOnlyWeightRow.tsx`) so the pinned Settings
hosts stay thin.

## Files

- `src/lib/preferences/trendOnlyWeight.ts` — pref constants + neutral copy +
  `resolveEffectiveWeightSurfaceMode`
- `src/lib/preferences/useTrendOnlyWeight.ts` / `apps/mobile/lib/trendOnlyWeight.ts`
  — the hooks
- `src/app/components/settings/TrendOnlyWeightToggle.tsx` /
  `apps/mobile/components/settings/TrendOnlyWeightRow.tsx` — the Settings rows
- `src/app/components/ProgressDashboard.tsx` /
  `apps/mobile/app/(tabs)/progress.tsx` — effective-mode wiring + neutral card copy
- `src/app/components/Settings.tsx` /
  `apps/mobile/components/settings/SettingsBundleContent.tsx` — host mounts
- flag registration + `trend_only_weight_toggled` event in the analytics files
- tests: `trendOnlyWeight`, `trendOnlyFlagParity`, `trendOnlyWiring` (web) +
  `trendOnlyWeightSync` (mobile)

# Settings soft elevation, win-moments, and dev-marker gating

**Date:** 2026-05-31
**Status:** Resolved (both platforms implemented; visual changes flag-gated OFF pending sim/browser sign-off)
**Area:** Settings / Membership / Design system (Redesign — Design Direction 2026)
**Flags:** `design_system_elevation` (ENG-823), `redesign_winmoment` (ENG-824)
**Issues:** [ENG-823](https://linear.app/suppr/issue/ENG-823), [ENG-801](https://linear.app/suppr/issue/ENG-801), [ENG-824](https://linear.app/suppr/issue/ENG-824)
**Source direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)

## Context

The 2026-05-31 design-director review scored the Settings group **Depth: Generic,
Motion: Generic, Delight: Generic**. Three concrete gaps in this surface:

1. **No depth model.** Every resting card in Settings was a hand-rolled
   `bg-card + radius-14 + hairline-border` View (mobile) / `card-elevated` +
   `border-border` div (web). On web the static `card-elevated` shadow AND the
   border both rendered — a double edge. None of it derived from the new
   one-elevation-model spine rule.
2. **Flat delight.** Saving daily targets or connecting Apple Health produced no
   positive confirmation — the kind of small landmark the direction wants a quiet
   beat for (distinct from the reserved Today day-landmark celebration).
3. **A dev marker leaked into a user-facing row** (review bug P1). The Build row
   appended a stale internal capture token to the version string.

## Decisions

### ENG-823 — one elevation model in Settings (flag: `design_system_elevation`)

- **Mobile:** introduced a `SettingsCard` wrapper inside `SettingsBundleContent`
  that consumes the existing `useCardElevation` hook. Every resting section card
  (Profile, Membership, People, Goals, Display, Connections, Recipes, App, Legal,
  Build, Danger zone) now renders through it. The 13× hand-rolled card idiom is
  gone. Flag ON (light) → soft `Elevation.cardSoft` shadow, no border; ON (dark)
  → tonal lift + hairline (no shadow — RN renders dark shadows poorly); OFF →
  today's flat hairline card, unchanged.
- **Web:** `Settings.tsx` + `SubscriptionCard.tsx` derive `settingsCardClass` /
  `cardClass` from `isFeatureEnabled("design_system_elevation")`, mirroring the
  `cardElevationClass` pattern already in `RecipeDetail.tsx`. Flag ON →
  `shadow-[var(--elev-card-soft)]`, `border-0`; OFF → `card-elevated` + border.
  Nested list-cards (Preferences toggle group) drop their own shadow when on so
  there is no shadow-on-shadow.
- **Sheets/modals are deliberately NOT converted** — bottom-sheets are a
  different elevation tier (`--elev-sheet` / `Radius.lg` headers), not resting
  cards.

### ENG-824 — quiet Settings win-moments (flag: `redesign_winmoment`)

A new `useSettingsWinMoment` hook on each platform — deliberately separate from
the loud Today day-landmark orchestrator (`useWinMoment` / `<WinMomentPlayer/>`,
which stays reserved for Today landmarks):

- **Mobile** (`apps/mobile/hooks/useSettingsWinMoment.ts`): `celebrate()` fires a
  `Haptics.notificationAsync(Success)` beat + a ~1.4s win-colour wash
  (`Accent.winSoft` fill, `Accent.win` border) on the saved card.
- **Web** (`src/lib/preferences/useSettingsWinMoment.ts`): no haptics; the same
  ~1.4s win-colour wash via `bg-[var(--accent-win-soft)] border-[var(--accent-win)]`.

Trigger points:
- **Health connect** (mobile only — `health-sync.tsx`, on the confirmed
  `outcome.ok` branch). Web has no Apple Health surface (documented
  `Apple Health / Apple Sign-In` carve-out), so there is no web analog — intentional.
- **Target save** (both platforms — `targets.tsx` recalculate + goal-editor
  `onSaved`; web `Targets.tsx` goal-editor `onSaved`).

Colour is the dedicated WIN token (amber `#F2A93B` / `--accent-win`), never
success-green — green stays reserved for the calorie-ring state per the spine
rules. Flag OFF → `celebrate()` is fully inert (no haptic, no flash), preserving
today's silent saves until ramp.

### ENG-801 — dev marker no longer leaks (bug fix, no flag)

The Build row's version string used to append a stale internal capture token
(a one-off `F50` test-build marker). The row was already `__DEV__`-gated (false
in release/TestFlight, so it never shipped), but the token was meaningless noise
to a tester and read as garbage. Removed the token; the row now shows only the
real `v{version} · build {n}`. Gate retained. This is a bug fix with no visual
surface in production (the whole row is dev-only), so it is **not** flag-gated.

## Parity

| Behaviour | Web | Mobile | Note |
|---|---|---|---|
| Settings card soft elevation | `Settings.tsx`, `SubscriptionCard.tsx` | `SettingsCard` in `SettingsBundleContent` | Same flag, same shadow token |
| Target-save win-moment | `Targets.tsx` (colour wash) | `targets.tsx` (haptic + colour wash) | Web has no haptics |
| Health-connect win-moment | — (no Apple Health surface) | `health-sync.tsx` | Documented carve-out, not drift |
| Dev build marker | already gated; no web marker | `__DEV__` + token removed | — |

## Tests

- `apps/mobile/tests/unit/settingsWinMoment.test.tsx` — mobile hook: flag gate +
  success haptic + flash lifecycle.
- `tests/unit/settingsWinMomentWeb.test.tsx` — web hook: flag gate + flash class
  lifecycle; asserts the win-colour (never success-green) token.
- `apps/mobile/tests/unit/settingsElevationAndMarker.test.ts` — `SettingsCard`
  wrapper routes the section cards through `useCardElevation`; no hand-rolled
  card recipe survives; Build row gated + no marker token.
- `tests/unit/settingsElevationFlag.test.ts` — web cards derive from the
  elevation flag; flag-OFF fallback preserved; `SubscriptionCard` parity.

## Follow-ups

- Visual sign-off (sim + browser, before/after at flag ON and OFF) before any
  ramp — `visual-qa`.
- The `health-sync.tsx` (903 lines) and `targets.tsx` (962 lines) screen files
  remain over the 400-line limit (pre-existing); not expanded by this change.
  Extraction tracked separately.

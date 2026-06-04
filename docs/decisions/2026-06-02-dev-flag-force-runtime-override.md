# Dev/QA flag-force — runtime override (ENG-840)

- **Date:** 2026-06-02
- **Area:** Platform / dev-tooling (web + mobile)
- **Status:** Resolved
- **Linear:** [ENG-840](https://linear.app/suppr/issue/ENG-840)
- **Related:** [ENG-839](https://linear.app/suppr/issue/ENG-839),
  `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`

## Problem

The dev/QA flag-force override (`EXPO_PUBLIC_FLAG_FORCE_*` on mobile,
`NEXT_PUBLIC_FLAG_FORCE_*` on web) **never worked in a bundled build** —
only under vitest / SSR. Both platforms read the override via a *computed*
`process.env[key]` access, and neither webpack's `DefinePlugin` nor
Expo/Metro's transform inlines a computed key — they replace only a
**static** `process.env.NEXT_PUBLIC_X` / `process.env.EXPO_PUBLIC_X`. In the
browser bundle and the RN bundle the computed read is `undefined`, so the
override silently never fired.

Net effect: the only way to preview a flag-gated feature was a production
PostHog ramp (which also requires the client to accept analytics consent and
reach PostHog — unreliable on the sim). Proven 2026-06-01: all 8 redesign
flags forced via `EXPO_PUBLIC_FLAG_FORCE_*` on a Metro dev build → the sim
still rendered the flag-OFF UI.

## Decision

Add a **runtime** override on each platform that the flag helpers read at
evaluation time, leaving the (now-documented) env path as test/SSR-only.

### Web — `src/lib/analytics/track.ts`

The client hook `window.__SUPPR_FORCE_FLAGS__` already existed (seeded by
Playwright's `addInitScript`). Added a manual-browsing seeder,
`seedForcedFlagsFromLocation()`, run lazily on the first flag read:

- **Query param:** `?__force_flags=redesign_motion:on,today-status-pills:off`
  (`on`/`true`/`1` → ON, `off`/`false`/`0` → OFF; a bare `flag` = ON).
- **Persistence:** the parsed set is written to `localStorage`
  (`__suppr_force_flags__`) so it survives client-side navigation.
- **Clear:** `?__force_flags=clear` wipes the persisted set.
- Inert in production (`NODE_ENV` guard before the read).

### Mobile — `apps/mobile/lib/analytics.ts`

`isFeatureEnabled` is synchronous, so an AsyncStorage blob
(`__SUPPR_FORCE_FLAGS__`) is primed into an in-memory `Map` at bootstrap
(`primeForcedFlags()`, awaited in `context/AnalyticsProvider.tsx` before the
first flag read). The map is checked **first** in both `isFeatureEnabled` and
`isFeatureDisabled`. Flip flags via the dev-only Settings panel
(`components/settings/DevFlagOverrides.tsx`), which calls `setForcedFlag` /
`clearForcedFlags`. All of it is `__DEV__`-gated, so Hermes DCE drops it from
release builds. After flipping, use **Reload app** (the panel's
`DevSettings.reload()` button) so every screen re-evaluates cleanly.

### Env vars are now explicitly test/SSR-only

`EXPO_/NEXT_PUBLIC_FLAG_FORCE_*` stay (vitest has a real `process.env`; web
SSR and Metro-start E2E rely on them) but are documented as dead in a bundle.
The mobile reads carry an `expo/no-dynamic-env-var` disable with a reason.

## Precedence (both platforms, dev only)

1. Runtime override (web `window.__SUPPR_FORCE_FLAGS__` / mobile `forcedFlags`
   map) — **the device/sim/browser path**.
2. Env var `*_FLAG_FORCE_*` — test/SSR/Metro-start only.
3. `REDESIGN_DEFAULT_ON` set — redesign flags resolve ON un-gated.
4. Live PostHog client (or kill-switch via `isFeatureDisabled`).

## Tests

- Web: `tests/unit/flagForceSeed.test.ts` (query param + localStorage +
  clear + precedence + production-inert), plus the existing
  `tests/unit/flagForceOverride.test.ts`.
- Mobile: `apps/mobile/tests/unit/forcedFlagsRuntimeOverride.test.ts`
  (`primeForcedFlags` / `setForcedFlag` / `clearForcedFlags` / precedence /
  release-build no-op), plus the existing
  `apps/mobile/tests/unit/isFeatureDisabled.test.ts`.

## How to preview a flag-gated screen

- **Web (any build, incl. prod-like dev):** append
  `?__force_flags=<flag>:on` to the URL. It persists; clear with
  `?__force_flags=clear`.
- **iOS (sim or device, dev build):** Settings → scroll to **DEV · Flag
  overrides** → set the flag On/Off (or type any flag key) → **Reload app**.

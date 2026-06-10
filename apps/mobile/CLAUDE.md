# Mobile (iOS) — local conventions

Scoped rules for work under `apps/mobile/`. The global rules (decision
framework, non-negotiables, PR/CI hygiene, no silent deferrals, Notion/Linear
mirroring) live in the root `.claude/CLAUDE.md` and still apply here.

## What this app is

- **iOS-only** build target, shipped via TestFlight. The Android config is a
  vestigial Expo template and is never built — don't treat "Android" behaviour
  (e.g. hardware back) as a real bug until Grace ships Android.
- **Bundle id:** `com.supprclub.supprapp`
- **Auth:** Apple Sign In (no email/password QA form)
- **Tabs:** Today / Plan / ＋(FAB) / Recipes / Progress — Settings via the
  avatar, not a tab.
- **Navigation map:** `sitemap.md` (deep links + tabs).

## Conventions

- **UI write discipline (root CLAUDE.md) applies to every styled line here.**
  The RN specifics: `Spacing` / `Radius` / `Type` / `Colors` / `Elevation` /
  `IconSize` from `constants/theme.ts` — never literal hexes or off-scale
  numbers (Spacing 4/8/12/16/20/24/32/40 — 12 = `Spacing.dense`, ENG-1012;
  Radius 4/6/8/12). Pressables go
  through `PressableScale` with the right `haptic` weight; async commits
  disable + show progress. Same element, same treatment as its nearest
  sibling — or document the divergence.
- **Web/mobile parity is non-negotiable.** A visible change here must land on
  the equivalent web surface in the same change. (iOS is the primary surface —
  lead here, web follows in parity.)
- **400-line screen cap** (root quality bar) applies — extract a
  `use<Screen>()` hook or child components rather than growing
  `(tabs)/index.tsx` (legacy 3,400-line file; move toward the target).
- **Feature flags:** gate visual/structural changes via the mobile equivalent
  in `apps/mobile/lib/analytics.ts` (`isFeatureEnabled`).
- **idb PATH:** `~/.local/bin/idb` via pipx + Python 3.12 (`fb-idb` breaks on
  Python 3.14).

## Testing this app

To drive / visually verify the app in the simulator, use the
**`suppr-ios-sim-testing`** skill (loads on demand) — and never ask Grace to
drag sim screenshots into chat; drive it yourself and Read the PNG.

Key scripts: `npm run mobile:dev` (Metro) · `npm run mobile:ios:simulator`
(dev client). **Scope checks to mobile** while iterating —
`npm run mobile:lint && npm run mobile:typecheck && npm run mobile:test` —
rather than the full `npm run ci`, which only needs to run once before the
final push.

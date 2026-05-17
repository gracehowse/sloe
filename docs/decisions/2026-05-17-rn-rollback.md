---
date: 2026-05-17
area: mobile / dependencies
status: Resolved
linear: ENG-562
---

# React Native 0.85.3 → 0.81.5 rollback + CI bundle-check + dependabot pin

## What changed

- `apps/mobile/package.json`: rolled `react` 19.2.6 → 19.1.0, `react-dom` 19.2.6 → 19.1.0, `react-native` 0.85.3 → 0.81.5, `react-native-screens` 4.25.0 → 4.16.0. Lockfile regenerated.
- `.github/workflows/ci.yml`: added a `Metro bundle-check` step to the `mobile` job that runs `npx expo export --platform ios --dev=false` after typecheck + tests.
- `.github/dependabot.yml`: added a full-block ignore for `react-native` and `react-native-screens` in the mobile group. Any future RN bump must be a manual PR coordinated with an Expo SDK upgrade.

Other deps from PR #243 (Sentry 7.13, Supabase 2.105.4, posthog-react-native 4.45.6, lucide-react-native 1.16, reanimated 4.3.1, worklets 0.8.3, safe-area-context 5.7, svg 15.15.5, gesture-handler 2.31.2, expo-* patch bumps, navigation 7.16.1) all support RN 0.81.5 per their peer ranges and stay.

## Why

PR #243 was a 21-package dependabot batch that bumped React Native from 0.81.5 → 0.85.3 alongside 18 unrelated production-dep bumps. The bump was invalid:

- **No published Expo SDK supports RN 0.85.** Expo SDK 54 (current, stable, latest = `54.0.34`) pins `babel-preset-expo@54.0.10`, which in turn pins `@react-native/babel-preset@0.81.5` and `@react-native/babel-plugin-codegen@0.81.5` (exact). Expo SDK 55 only targets RN 0.83.1. SDK 56 is preview-only and still targets 0.83.6.
- After the bump, fresh `npm ci` produced a tree with **RN 0.85.3 + codegen 0.81.5 mismatched**. RN 0.85's `VirtualViewExperimentalNativeComponent.js` uses `onModeChange` event-schema syntax that the 0.81.5 codegen plugin can't parse. Metro fails at module-load time on any fresh install.
- The bug stayed latent on `main` because:
  - Grace's main clone had stale `node_modules` from before the bump (actual installed RN was 0.81.5 from the older lockfile).
  - CI (lint + typecheck + vitest) doesn't drive Metro through the canonical lockfile-resolved tree — vitest uses an `apps/mobile/vitest.config.ts` `react-native` shim.
  - The next fresh EAS build (TestFlight pipeline) would have failed. The next fresh-clone contributor would have been blocked.

Discovered 2026-05-17 while setting up Metro on a fresh worktree to validate PR #287 in sim. ENG-562 tracked it.

## Why this fix, not an `overrides` patch

The other obvious option was to add `overrides` to force `@react-native/babel-plugin-codegen` and `@react-native/babel-preset` to 0.85.3 transitively, keeping RN at 0.85.3. We rejected this because:

- It overrides Expo SDK 54's exact pin from underneath. Expo's toolchain (babel-preset-expo, metro-config) was built against codegen 0.81.5; substituting 0.85.3 risks subtle output-shape and native-module-ABI drift that won't fail loudly at bundle time but will at runtime.
- We're 7 days from soft launch (2026-05-24). Rolling back to the supported combination (RN 0.81 + Expo SDK 54) keeps us on documented ground.
- Expo SDK 55 + RN 0.83 is the next coherent step. Some future PR will bump Expo SDK 54 → 55 + RN 0.81 → 0.83 together, as one coordinated change. That's a deliberate bump, not a dependabot drive-by.

## Why this didn't get caught

Three guards missing or insufficient:

1. **No CI bundle-check.** Mobile CI ran lint + typecheck + vitest. None of those exercise Metro through the production code path. Added in this PR.
2. **Dependabot bundled RN with 18 unrelated bumps.** PR #243's diff was too noisy to spot the RN-vs-Expo mismatch. The `production-dependencies` group config is correct for ~95% of bumps, but RN/RN-screens need to be excluded entirely. Patched in this PR.
3. **No prior runtime check on `npm ci` output.** The fact that codegen-0.81.5 was nested under babel-preset-expo and codegen-0.84.1 at the top level should have raised a flag for any process that diffs the lockfile across PRs. Not introducing that gate here — too much complexity for one incident.

## How to apply (RN bumps from now on)

1. Wait for an Expo SDK announcement that includes RN >= the version you want.
2. In a single manual PR, bump `expo` + every `expo-*` package + `react-native` + `react-native-screens` together. Match versions to the Expo SDK release notes.
3. Run `npx expo install --check` to verify all the `expo-*` packages match the new SDK.
4. Run the local bundle-check (`cd apps/mobile && rm -rf node_modules && npm ci && npx expo export --platform ios --dev=false`) before pushing — same gate CI will run.

Don't merge a dependabot PR that includes `react-native` or `react-native-screens` — close it and do the manual bump instead. The ignore rules in `.github/dependabot.yml` should prevent this from happening automatically, but if it slips through, kill it.

## Verification done in this PR

- `npm install` in `apps/mobile` from a clean `node_modules` succeeds with 0 vulnerabilities.
- `npm ls @react-native/babel-plugin-codegen` shows two coherent trees: `0.81.5` under `babel-preset-expo` (Expo's expected version) and `0.84.1` under `react-native-worklets`/`metro-config` (forward-compat with 0.81).
- `npx expo export --platform ios --dev=false` produces a 27 MB iOS bundle cleanly.
- `npm run ci` from repo root passes locally (web typecheck + vitest + next build + mobile typecheck + mobile vitest).

## References

- ENG-562 — original issue
- PR #243 — the dependabot batch that introduced the mismatch (commit `f21f5b0`)
- Commit `277340a` — RN 0.85 forward-compat shim shipped 2026-05-16 (harmless under 0.81, kept in place)

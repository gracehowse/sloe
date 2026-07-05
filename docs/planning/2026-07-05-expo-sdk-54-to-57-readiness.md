# Expo SDK 54 → 57 upgrade readiness (ENG-1368)

**Status:** research only — no code changed. Do not attempt the bump from this
document; book it as its own dedicated sprint per the ENG-1368 framing.

**Current state:** `apps/mobile` is on Expo `~54.0.35`, React Native `0.81.5`,
React `19.1.0`, reanimated `~4.1.7` / worklets `0.5.1`, New Architecture
already **on** (`newArchEnabled: true` in `app.json`). Internally consistent —
this is a real, working baseline, not a partially-migrated one.

## 1. What actually changes across 55 → 56 → 57

| SDK | React Native | React | Headline for Suppr |
|---|---|---|---|
| 55 | 0.83 | 19.2 | **New Architecture becomes mandatory — the `newArchEnabled` flag itself is removed.** `expo-av` pulled from Expo Go. `expo-router`'s `ExpoRequest`/`ExpoResponse` types removed. Xcode min → 26. |
| 56 | 0.85 | 19.2 | `expo-router` **drops its dependency on React Navigation** — any code importing `@react-navigation/*` directly needs the `sdk-56-expo-router-react-navigation-replace` codemod. `expo/fetch` becomes the default global `fetch` (opt out via `EXPO_PUBLIC_USE_RN_FETCH=1` if anything depends on the old behavior). `expo-file-system`'s `File`/`Directory` `.copy()`/`.move()` become async (sync variants renamed `copySync()`/`moveSync()`). `@expo/vector-icons` deprecated in favor of `@react-native-vector-icons/*` (codemod available). iOS/tvOS min → 16.4, Xcode min → 26.4. |
| 57 | 0.86 | 19.2 | Advertised as **no breaking changes from 0.85** — the "settling" release. reanimated bumps 4.3→4.5, worklets 0.8→0.10, gesture-handler 2.31→2.32. CNG users must delete `ios`/`android` dirs and re-prebuild. |

**Important correction to the underlying premise:** because Suppr is already
New-Architecture-only at SDK 54 (reanimated v4 and worklets 0.5.1 are both
New-Arch-only packages already), **the SDK 55 New Architecture mandate is a
non-event for this app.** The single largest historical risk in the 54→55
jump (forced Old Arch → New Arch migration) does not apply here. This
materially lowers the risk of this upgrade relative to a codebase still on
Old Architecture.

The two changes that *do* bite Suppr specifically:

- **`expo-router`/React Navigation decoupling at 56.** Suppr uses
  `@react-navigation/bottom-tabs` and `@react-navigation/native` directly
  (`package.json`) alongside `expo-router`. Any direct imports from
  `@react-navigation/*` in app code must be audited against the SDK-56
  codemod before or during that step — this is a real, mechanical
  migration, not just a version bump.
- **`expo-file-system` async `.copy()`/`.move()` at 56.** Grep the codebase
  for `File`/`Directory` sync copy/move calls before that step (recipe
  import / image handling is the likely surface).

## 2. New Architecture (Fabric/TurboModules) status

- **Already on.** `apps/mobile/app.json` sets `newArchEnabled: true` today at
  SDK 54. `react-native-reanimated ~4.1.7` and `react-native-worklets 0.5.1`
  are both New-Architecture-only major versions — the app cannot currently
  run Old Architecture even if it wanted to.
- **Becomes mandatory workspace-wide at SDK 55** (RN 0.83) — the config flag
  is removed entirely, Old Architecture is deleted from the runtime. Since
  Suppr is already there, this SDK bump requires no new New-Architecture
  migration work.
- **What this does NOT mean:** "already on New Architecture" is not the same
  as "every native module is Fabric/TurboModule-native." Several dependencies
  (see §4) still run through React Native's Bridge/interop compatibility
  layer rather than shipping real TurboModule specs. That interop layer is
  exactly what changes shape release to release and is where regressions
  hide — it is the thing that needs re-verification, not the New
  Architecture flag itself.

## 3. Native-module compatibility audit (against actual `package.json`)

Checked via npm registry peer-dependency data + repo/source inspection
(2026-07-05).

| Module | App pin | Latest | Peer deps say | Assessment |
|---|---|---|---|---|
| `expo-camera` | ~17.0.10 | 57.0.0 | `expo:*` (permissive) | **Low risk.** First-party, versioned in lockstep with Expo SDK by convention (`17.x`→54, `57.x`→57 in this case — note Expo renumbered some first-party package majors to track SDK number directly around SDK 56/57; expect a version-string jump, not a behavior break). |
| `expo-notifications` | ~0.32.17 | 57.0.3 | `expo:*` | **Low-medium risk.** First-party; SDK 55 removed the Expo Go push-notification warning→error path (irrelevant — Suppr uses dev builds/TestFlight, not Expo Go) and updated Firebase deps on Android (N/A, iOS-only build target). Re-verify push token registration + background notification handling after each step regardless. |
| `expo-apple-authentication` | ~8.0.8 | 57.0.0 | `expo:*` | **Low risk.** First-party, thin wrapper over ASAuthorization APIs; no changes flagged in any SDK 55–57 changelog. |
| `expo-speech-recognition` (community, not first-party despite the name) | ^3.1.3 | 56.0.1 (as of 2026-06-05) | `expo:*`, `react-native:*` | **Medium risk — no SDK-57 tagged release yet as of this research.** Latest published version tracks SDK 56. Third-party (`jamsch/expo-speech-recognition`), wraps native on-device speech APIs — exactly the class of module (native permission + native UI presentation) that historically breaks on RN bumps. Must confirm a 57-compatible release exists before attempting that step; if none exists, this is a real blocker for the final leg, not just a version bump. |
| `expo-share-intent` | ^5.1.1 | 8.0.0 (2026-07-03) | version-pinned to SDK per major (`5.x`→54, `6.x`→55, `7.x`→56, `8.x`→57) | **Low-medium risk, but confirms the "one SDK per step" pattern concretely.** This package literally majors in lockstep with Expo SDK numbers (6.0.0 requires `expo:^55`, 7.0.0 requires `expo:^56`, 8.0.0 requires `expo:^57`). It is not safe to jump 5.1.1 straight to 8.0.0 — each SDK step needs its matching share-intent major, tested individually (share-intent touches native `NSExtension`/App Group entitlements on iOS — a real regression surface, not cosmetic). |
| `react-native-health` (HealthKit) | ^1.19.0 | 1.19.0 (Oct 2024 — 21 months stale) | peer dep only requires `react-native:>=0.67.3` (no upper bound, no Fabric/TurboModule declaration) | **Highest risk in the whole dependency set — flag this as the pacing item.** This is a legacy Bridge module (`RCTBridgeModule`, no `codegenConfig`, no TurboModule spec) running through RN's Bridge/TurboModule interop shim, not a native New-Arch implementation. Suppr already carries a **hand-written `patch-package` patch** (`patches/react-native-health+1.19.0.patch`) working around a real crash: a comment in the patched source (`RCTAppleHealthKit.m`, dated 2026-04-21, tagged "G-7") documents that "iOS 26.5 + RN 0.76 bridgeless / ObjCTurboModule interop raises an uncaught ObjC exception inside `performVoidMethodInvocation`" when HealthKit auth is dispatched off the main thread — patched by forcing `requiresMainQueueSetup` to `YES` and wrapping methods in `@try/@catch`. **This is documented proof the bridge/TurboModule interop layer is already fragile for this exact module on the current RN version.** Every RN bump (0.81→0.83→0.85→0.86) changes that interop layer's internals and can silently reopen the same class of crash, or introduce a new one the existing patch doesn't cover. The project (`agencyenterprise/react-native-healthkit`) itself states in its README it is not accepting new features, only critical-bug-fix PRs, and has 120 open issues / 36 open PRs — no upstream New Architecture rewrite is imminent. **Treat HealthKit sync as the module needing device-level (not simulator) re-verification at every single step**, and budget time to re-derive or extend the existing patch. |
| `react-native-purchases` / `-ui` (RevenueCat) | ^9.15.2 | 10.4.1 | `react-native:>=0.73.0` | **Low-medium risk.** Actively maintained (published within days of this research), broad RN range. RevenueCat ships real New Architecture support and tracks RN releases closely. Still touches native billing/paywall UI — re-verify real purchase flow (sandbox) after each step, not just typecheck. |
| `react-native-reanimated` | ~4.1.7 | 4.5.1 | `react-native:"0.83 - 0.86"` (as of 4.5.1) | **Medium risk, load-bearing for the whole app (animations + Skia + gesture-handler chain).** Confirms the step-through pattern: reanimated's peer range moves with each RN minor. The app's current 4.1.7 pin will need bumping essentially every SDK step to stay inside its supported `react-native` peer range. Note the known issue surfaced in the SDK 56/57 changelogs: **Android memory usage +25–30% when importing reanimated with Hermes V1** on both SDK 56 and 57 — irrelevant to Suppr's iOS-only build target, but worth confirming it doesn't have an iOS-side analogue before relying on the "Android-only" framing from upstream. |
| `react-native-worklets` | 0.5.1 | 0.10.1 | `react-native:"0.83 - 0.86"` | Moves in lockstep with reanimated (they're co-versioned/co-released) — bump together, never independently. |
| `@shopify/react-native-skia` | 2.6.4 | 2.6.9 | `react:>=19.0`, `react-native:>=0.78`, `react-native-reanimated:>=3.19.1` | **Low risk.** Current pin already satisfies all latest peer ranges; patch-level updates only through SDK 57. Re-verify chart rendering (weight chart, macro rings) visually after each reanimated bump since Skia's worklet integration is reanimated-version-sensitive. |
| `lottie-react-native` | ~7.3.8 | 7.3.8 (already latest) | `react-native:>=0.46` | **Low risk.** Already on latest; permissive peer range. |
| `react-native-screens` | ~4.16.0 | 4.25.2 | latest requires `react-native:>=0.82.0` | **Medium risk, easy to miss.** The *current* app pin (4.16.0) is fine at RN 0.81, but the *latest* screens release already requires RN ≥0.82 — meaning by the time the app reaches SDK 56/57 (RN 0.85/0.86), an old 4.16.x pin will be out of its supported range and must be bumped. Since `react-navigation` (bottom-tabs/native) depends on `react-native-screens` under the hood, this cluster needs bumping together with the router work in §1. |
| `detox` | ^20.50.1 | 20.51.4 | `jest: 30.x / 29.x / 28.x / ^27.2.5` | **Low risk for the dependency itself**, but Detox is uniquely exposed to *any* native/RN change since it drives real native builds end-to-end — treat every Detox E2E run as a canary. Confirm Detox's own compatibility matrix against RN 0.86 before the final step (Detox has historically lagged new RN architecture internals by weeks). |
| `@react-native-async-storage/async-storage` | 2.2.0 | 3.1.1 | permissive | Low risk, first-party-adjacent, wide support. |
| `@sentry/react-native` | ~7.13.0 | 8.17.1 | `expo:>=49.0.0`, `react-native:>=0.65.0` | Low risk; wide range, actively maintained, but a major version bump (7→8) is available and worth doing alongside the SDK work since Sentry ships New Architecture crash-symbolication improvements in 8.x. |
| `posthog-react-native` | ^4.47.2 | 4.54.4 | wide, permissive ranges on all sub-deps | Low risk. |

## 4. Modules with a real blocker vs. a version bump

**Genuine blockers / needs-verification-before-committing-to-the-plan (as of 2026-07-05):**

1. **`react-native-health`** — no upper RN bound declared, legacy Bridge
   module, no TurboModule spec, 21-month-stale upstream, and Suppr is
   already patching a live interop crash on the *current* RN version. This
   is the pacing risk for the whole upgrade. Not a "no compatible version
   exists" blocker in the strict sense (it will probably still load via
   Bridge interop through 0.86), but it is the module most likely to need
   new patches at each step and the one that most needs physical-device
   (not simulator) verification, since HealthKit auth/entitlement behavior
   doesn't fully simulate.
2. **`expo-speech-recognition`** — as of this research, latest published
   version tags SDK 56; no confirmed SDK-57-tagged release located. Verify
   at upgrade time whether a 57-compatible release has shipped before
   planning the final 56→57 leg; if not, that leg is genuinely blocked on
   upstream, not just deferred by choice.

**Version-bump-only (no compatibility red flags found):**
`expo-camera`, `expo-notifications`, `expo-apple-authentication`,
`expo-share-intent` (bump its major in lockstep with each SDK step),
`react-native-purchases`/`-ui`, `react-native-reanimated`/`worklets` (bump
together, every step), `@shopify/react-native-skia`, `lottie-react-native`,
`react-native-screens` (bump alongside the router/navigation work),
`detox`, `@react-native-async-storage/async-storage`, `@sentry/react-native`,
`posthog-react-native`.

## 5. Recommended upgrade plan

**Path: step through 55 → 56 → 57. Do not attempt 54→57 direct.**

Rationale against direct: Expo's own upgrade guides are written and tested
incrementally, one SDK at a time; several of the pinned dependencies above
(`expo-share-intent` most concretely) *only ship majors that match a single
target SDK* — there is no "SDK-57-compatible" version of `expo-share-intent`
that also works on SDK 54, so a direct jump would require bumping every
native module across three majors' worth of native-code changes
simultaneously with no intermediate point to isolate a regression to a
single cause. This directly violates the project's own stated principle
("never two majors' worth of native-module changes at once") and would be
the same mistake at 3x the blast radius. Given `react-native-health`'s
already-documented interop fragility, isolating which step introduced a
regression is the whole game — a direct jump forfeits that.

**Ordered plan (one leg per work block, each independently shippable to
TestFlight before starting the next):**

**Leg 1 — SDK 54 → 55**
- Run `npx expo install expo@^55 --fix` to align all `expo-*` first-party
  packages.
- Bump `react-native-reanimated`/`react-native-worklets` together to the
  4.2–4.3 range matching RN 0.83's peer window.
- Bump `expo-share-intent` to its 6.x line (`expo:^55`).
- No New Architecture migration needed (already on).
- **Re-verify on:** simulator first pass (fast iteration), then a physical
  device pass focused on HealthKit auth flow + camera + Apple Sign-In +
  push notification registration, then one full TestFlight build before
  moving on.
- **Risk focus:** confirm the existing `react-native-health` patch still
  applies cleanly (`patch-package` will fail loudly if the upstream file
  changed shape — it won't have, since react-native-health hasn't been
  touched since Oct 2024, but confirm the *RN-side* interop behavviour
  the patch works around hasn't shifted under 0.83).

**Leg 2 — SDK 55 → 56**
- This is the heaviest leg: run the `sdk-56-expo-router-react-navigation-replace`
  codemod, audit every direct `@react-navigation/*` import in app code
  against its output.
- Grep for `File`/`Directory` `.copy()`/`.move()` sync usage
  (`expo-file-system`) and convert to the async or `*Sync()` forms as
  needed.
- Bump `react-native-screens` (now required ≥0.82 by its own latest — will
  need to land somewhere in this window since RN reaches 0.85 here) and
  `@react-navigation/*` together, physically re-test all tab/stack
  navigation surfaces (this is the surface most likely to visibly break —
  screenshot every tab before/after per the project's visual-validation
  rule).
- Bump `expo-share-intent` to 7.x, re-verify Instagram/TikTok/Pinterest
  share-sheet import end to end on a physical device (App Group /
  extension entitlements don't fully simulate).
- Bump reanimated/worklets again to the 56-supported range.
- **Re-verify on:** physical device mandatory for share-intent and
  navigation; simulator sufficient for most else; one TestFlight build.

**Leg 3 — SDK 56 → 57**
- Confirm `expo-speech-recognition` has a 57-tagged release before starting
  this leg (see §4 blocker) — if not, hold this leg and file a tracking
  issue rather than shipping without voice-logging verified.
- Bump reanimated 4.3→4.5, worklets 0.8→0.10, gesture-handler 2.31→2.32
  (SDK 57's own bumps).
- Bump `expo-share-intent` to 8.x.
- Delete and regenerate `ios`/`android` CNG output per SDK 57's own upgrade
  note.
- Bump `@sentry/react-native` 7→8 here if not done earlier (optional, but
  natural to batch with the final native rebuild).
- **Re-verify on:** full physical-device pass across every native-module
  surface in §3 (camera, HealthKit, Apple Sign-In, notifications, purchases,
  speech recognition, share-intent, charts/Skia), then Detox suite green,
  then one full TestFlight build with Grace smoke-testing before calling
  the upgrade done.

**Cross-cutting for every leg:**
- Re-run `npm run mobile:lint && npm run mobile:typecheck && npm run
  mobile:test` after each dependency bump, before any device testing.
- Re-run the full Detox suite (`npm run test:detox:build` +
  `npm run test:detox`) at the end of each leg, not just the final one —
  Detox is the canary for native-build regressions.
- Physical device (not just simulator) is required specifically for:
  HealthKit auth (`react-native-health`), share-intent (App Group
  entitlements), Apple Sign-In (`expo-apple-authentication`), push
  notification delivery (`expo-notifications` — simulators can't receive
  real APNs pushes), and RevenueCat sandbox purchases. Everything else
  (navigation, Skia charts, Lottie, general UI) is fine to verify in
  simulator first and confirm on device before the TestFlight build.
- Per the feature-flag rule, this upgrade itself has no user-visible
  surface to flag — it's a dependency/build-tooling change, not a UI
  change — so no `isFeatureEnabled` gating is needed for the upgrade
  itself. Any UI that visibly changes as a *side effect* (e.g. if
  `expo-router`'s react-navigation fork renders tab bars differently)
  would need before/after screenshots and would fall under the existing
  visual-validation rule at that point, not a new flag.

## 6. Summary risk ranking

1. **`react-native-health` (HealthKit)** — highest risk, paces the whole
   project. Legacy Bridge module, already-patched interop crash, stale
   upstream, no New Architecture rewrite in sight.
2. **`expo-router` ⇄ React Navigation decoupling (SDK 56)** — highest
   *engineering effort* item; mechanical but must be done carefully with
   the official codemod, and it's the one most likely to visibly change
   navigation UI.
3. **`expo-speech-recognition`** — real possible blocker on the final leg if
   no SDK-57 release exists yet at upgrade time; must be re-checked then,
   not assumed from this research.
4. **`expo-share-intent` + `react-native-screens` + reanimated/worklets** —
   not individually risky, but all three require lockstep bumping at every
   single leg — the discipline risk is skipping a leg's bump and drifting
   out of peer range.
5. Everything else in §3 is standard "bump and re-verify," in line with
   normal Expo SDK upgrade practice.

## Sources

- `expo.dev/changelog/sdk-55`, `/sdk-56`, `/sdk-57`, `/sdk-54` (fetched
  2026-07-05)
- `docs.expo.dev/versions/latest/`, `docs.expo.dev/guides/new-architecture/`
  (fetched 2026-07-05)
- npm registry peer-dependency data for all packages in §3 (fetched
  2026-07-05)
- `github.com/agencyenterprise/react-native-health` repo state (fetched
  2026-07-05)
- In-repo: `apps/mobile/package.json`, `apps/mobile/app.json`,
  `apps/mobile/eas.json`, `apps/mobile/patches/react-native-health+1.19.0.patch`,
  `apps/mobile/node_modules/react-native-health/RCTAppleHealthKit/RCTAppleHealthKit.m`
  (the "G-7" interop-crash comment)

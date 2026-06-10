# iOS app icon + splash → Sloe branding (home-screen label "Sloe")

**Date:** 2026-06-04
**Area:** Mobile / Brand
**Status:** Resolved (shipped to the dev client; not yet a TestFlight build)

## Problem

The iOS home-screen icon was broken: the asset pipeline
(`scripts/render-sloe-brand-png.mjs`) rendered the word "Sloe" in **Newsreader on
a fully white background**, so on the home screen it showed a white tile with the
wordmark floating in the middle (no defined icon edge — it read as "spilling past
the rounded corners"). The native AppIcon in the bare iOS project carried the same
white-background image. Separately the app was still labelled **"Suppr"**.

## Decision

Ship the **approved canonical icon** and rename the home-screen label to **Sloe**.

1. **App icon** — `docs/brand/sloe/assets/gen/wordmark-final/icon-fraunces-1024.png`:
   the full lowercase **"sloe"** wordmark (Fraunces) on the plum gradient field
   (`#3B2A4D` → darker). The artefact has alpha (baked rounded corners); iOS app
   icons must be **fully opaque**, so the pipeline now flattens it by dropping the
   alpha channel while keeping the gradient RGB into the corners. iOS then applies
   its own superellipse mask to the full-bleed square (no double-rounding, no dark
   corner fringe).
   - This is the **full-wordmark** icon, not Concept A's single bloomed-berry-o
     glyph from `sloe-brand.md` §4. Concept A remains a future option; the
     wordmark is Grace's chosen mark and reads clearly at home-screen size.

2. **Splash / launch** — logo-on-background, matching the splash mock
   (`docs/brand/sloe/assets/gen/wordmark-system/splash.png`):
   - **Light:** plum "sloe" wordmark on **cream `#FBF8F3`** (Oat — the brand
     marketing ground; the splash is a brand moment, not in-product chrome).
   - **Dark:** white "sloe" wordmark on **plum `#3B2A4D`**.
   - The logo PNGs are **transparent** wordmarks; the cream/plum field comes from
     the `expo-splash-screen` config + native `SplashScreenBackground` colorset.
   - The in-app boot screen (`components/AppLaunchScreen.tsx`) uses the **same
     cream/plum field** (not the white theme page background) so the native-splash
     → JS handoff is seamless.

3. **Home-screen label** — **"Suppr" → "Sloe"** (`expo.name` +
   native `CFBundleDisplayName`).

## Explicitly NOT changed (trademark-gated)

The **bundle id `com.supprclub.supprapp`**, the **`suppr` URL scheme**, and the
Expo **slug `suppr`** stay as-is. The Suppr→Sloe rename is display-only until the
trademark gate clears (see `2026-05-11-rebrand-and-entity-direction.md` and the
rebrand-checklist memory). Changing the bundle id would orphan the existing
TestFlight build, App Store Connect record, RevenueCat app, and Apple entitlements.

## Why these choices

- **Drop-alpha flatten (not flatten-onto-flat-plum):** keeps the gradient seamless
  into the corners; a flat-fill would seam where the gradient meets the fill.
- **Transparent splash logo + colorset background (not a baked-in background):**
  one source of truth for the field colour; lets light/dark switch the background
  without re-rendering the logo; lets the wide wordmark size by width.
- **Cream splash vs white app UI:** the brand board (`docs/brand/sloe/brand.md`)
  splits ground by surface — white in-product, Oat/cream for brand/marketing
  moments. The launch screen is a brand moment, so cream is correct; continuity
  colours in `AppLaunchScreen` prevent a visible cream→white flash on cold start.

## Native (bare/prebuilt) workflow

The iOS project is **bare** (`apps/mobile/ios/` is committed, with manual native
edits: signing config plugins, the xmldom/`@expo/plist` patch). We do **not** run
`expo prebuild` (it would clobber those). Instead the assets are written into the
committed asset catalog directly:

```
node scripts/render-sloe-brand-png.mjs        # render canonical assets
npm run sync-ios-brand --prefix apps/mobile   # copy into ios/ Images.xcassets
# (combined: npm run build:brand-icons)
npm run ios:simulator --prefix apps/mobile    # rebuild the dev client
```

`app.json` was updated in lockstep with the native catalog, so a future prebuild
would regenerate the same (correct) assets.

## Files

- `scripts/render-sloe-brand-png.mjs` — now sources the approved Fraunces
  artefacts; flattens the icon to opaque; renders transparent wordmark splashes.
- `apps/mobile/scripts/sync-ios-brand-assets.mjs` — copies the opaque icon
  (refuses alpha), writes the transparent splash imageset + cream/plum colorset.
- `apps/mobile/app.json` — `name: "Sloe"`; splash background cream/plum; dark
  splash image `splash-icon-dark.png`.
- `apps/mobile/ios/Suppr/Info.plist` — `CFBundleDisplayName: Sloe`.
- `apps/mobile/ios/Suppr/SplashScreen.storyboard` — cream inline bg + wordmark
  aspect frame.
- `apps/mobile/ios/Suppr/Images.xcassets/{AppIcon,SplashScreenLogo,SplashScreenBackground}` — regenerated.
- `apps/mobile/components/{AppLaunchScreen,SloeLaunchWordmark}.tsx` — splash
  continuity field + correct wordmark aspect.
- Tests: `apps/mobile/tests/unit/brandIconSplash.test.ts` (new),
  `apps/mobile/tests/unit/appLaunchScreen.test.ts` (updated).

## Follow-ups

- Bundle-id / scheme rename is still trademark-gated (do not do it here).
- `expo-notifications` plugin `icon` still points at the app icon — fine on iOS
  (iOS uses the app icon for notifications); only matters if Android ships.
- Consider the single-glyph Concept A icon (`sloe-brand.md` §4) as a cleaner mark
  at the smallest sizes (Settings/Spotlight 29–40pt) — wordmark is fine at 60pt.

## Parity

iOS-only change (app icon + native splash + OS label). The web app has its own
favicon/PWA marks via `scripts/build-icons.mjs` (legacy Suppr web marks +
`public/icon-maskable-512.png`), untouched here. The web wordmark already renders
"Sloe" in-product. No web-app surface regresses.

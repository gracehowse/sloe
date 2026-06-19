# Re-bump React Native Skia with native TestFlight rebuild

**Date:** 2026-06-19  
**Status:** Resolved  
**Issue:** ENG-1208  
**Surface:** Mobile Today tab calorie ring

## Decision

Re-bump `@shopify/react-native-skia` from the emergency TestFlight-compatible
pin `2.2.12` to `2.6.5` for the next native TestFlight build. The dependency is
native and must ship through the rebuilt iOS binary; it must not be repeated as a
JS-only OTA/dependency-only update.

`SkiaRingErrorBoundary` remains in place as the permanent safety net for runtime
Skia render failures. The normal path is still: probe for `RNSkiaModule`, lazy
require `SkiaRingArcs`, and fall back to the SVG ring if the native module is
unavailable or the render throws.

## Why this is safe now

- `2.6.5` is the current `2.6.x` line and remains compatible with Suppr's Expo
  54 / React Native 0.81 stack; React Native Skia documents the current line as
  requiring React Native `>=0.79` and React `>=19`.
- The prior production failure was not a Skia drawing bug; it was JS/native skew
  (`2.6.4` JavaScript loaded against a TestFlight binary containing native
  `2.2.12`). A native rebuild is therefore the required fix boundary.
- The error boundary and native-module probe stay shipped, so an unexpected Skia
  failure degrades to the SVG ring instead of the Today root error boundary.

## Native release checklist

1. On macOS, from `apps/mobile`, regenerate native dependencies for this exact
   lockfile state.
2. Run `npx pod-install ios` or `cd ios && pod install` after the Expo prebuild /
   native project is present.
3. Smoke the rebuilt dev/TestFlight binary on Today with `ring_skia_v1` enabled:
   - Today opens without the root error boundary.
   - The calorie hero ring renders through `SkiaRingArcs`.
   - The SVG fallback still renders if `ring_skia_v1` is disabled or Skia is
     forced to throw in local QA.
4. Upload the rebuilt binary to TestFlight before any OTA that assumes Skia 2.6.x
   native code exists.

## Alternatives considered

- **Stay pinned to `2.2.12`:** safest for the old TestFlight binary, but keeps us
  on the emergency rollback and blocks normal dependency maintenance.
- **Bump JS without native rebuild:** rejected; this is exactly the failure mode
  from ENG-1206 and can crash the Today hero ring.
- **Remove the Skia safety net after rebuild:** rejected; native graphics modules
  remain higher-risk than the SVG fallback, and the boundary is cheap insurance.

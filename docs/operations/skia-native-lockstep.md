# Skia native lockstep

`@shopify/react-native-skia` is a native dependency: the JavaScript package in
`apps/mobile/package.json` must match the Skia native code compiled into the
current TestFlight/dev-client binary. Do not merge a Skia package bump as an
OTA-only change.

## Required bump sequence

1. Rebuild the native mobile client with the target Skia version compiled in.
2. Install the exact same `@shopify/react-native-skia` version in
   `apps/mobile/package.json` and `apps/mobile/package-lock.json`.
3. Verify the Today ring with `ring_skia_v1` enabled: `SkiaRingArcs` should load
   without the JSI `Expected arraybuffer as first parameter` crash.
4. Keep the SVG fallback path covered: if Skia render/import fails,
   `SkiaRingErrorBoundary` must let `CalorieRing` render the SVG arc layer.

CI pins the exact-version lockstep between `package.json` and `package-lock.json`
in `apps/mobile/tests/unit/easUpdateConfig.test.ts` so a partial JS-only bump is
caught before merge.

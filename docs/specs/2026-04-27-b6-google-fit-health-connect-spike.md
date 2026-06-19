# Discovery doc: Google Fit / Health Connect spike (B6 / ENG-202)

**Date:** 2026-04-27
**Verified:** 2026-06-19
**Owner:** Engineering (research only at this stage)
**Status:** Discovery complete — deferred until Android trigger fires
**Effort estimate (full execution):** L (3–4 weeks single engineer, including Android release ops)
**Recommendation:** **DEFER / conditional GO.** Do not build before iOS launch traction. When a trigger fires, build Android health-platform parity with Health Connect, not Google Fit.

---

## TL;DR

Suppr's HealthKit integration is the iOS parity target. Android should use **Health Connect** when Android becomes a product priority; **Google Fit is not a viable new integration path** because Google Fit APIs are deprecated in 2026 and new developer signups were blocked from 2024-05-01.

The 2026-06-19 verification still supports a future Health Connect build:

- `react-native-health-connect` remains the best first-choice React Native bridge. Its public docs cover Expo Dev Client via the companion `expo-health-connect` config plugin, TypeScript types, and old/new RN architecture support.
- Suppr should implement Android in a platform-suffixed adapter: `apps/mobile/lib/healthSync.android.ts`. Do **not** branch inside the current 89KB iOS adapter.
- Health Connect has record coverage for the actual iOS reads/writes we ship: steps, weight, body fat, active calories, basal/total calories, exercise sessions, nutrition, and hydration.
- The build is still appropriately post-iOS-launch. Android has no production shell today: no `apps/mobile/android/` directory, `apps/mobile/eas.json` has iOS submit config only, and the onboarding health card is iOS-gated.

## Recommendation and re-evaluation triggers

**Verdict:** **DEFER now; GO later only if an Android trigger fires.**

Pick up implementation when at least one trigger is true:

1. iOS App Store launch has at least 30 days of install + retention data and HealthKit usage is material.
2. Android demand appears in at least 10% of waitlist signups or support tickets.
3. A high-value partner / enterprise deal explicitly requires Android health-platform sync.

If none fire by 90 days post-iOS launch, Grace should make a product call on whether Android remains a roadmap bet. This is not a technical blocker; it is sequencing discipline. Building now would spend 3–4 weeks on a platform with no current production users.

**Confidence:** 8/10. The package and platform path are viable, but Health Connect approval / Play Console review timings and Android 14+ feature edge cases need validation on real devices during the implementation ticket.

## Current Suppr shape (code-verified 2026-06-19)

### Platform and dependency state

- `apps/mobile/package.json` does **not** include `react-native-health-connect` or `expo-health-connect`.
- `apps/mobile/app.config.ts` only pushes existing iOS / Expo config plugins; no Health Connect config plugin is registered.
- `apps/mobile/eas.json` has iOS submit settings only. Android build profiles exist generically through EAS, but production submit / Play Console wiring is absent.
- There is no committed `apps/mobile/android/` native project. That is expected for an Expo managed / prebuild workflow and must not be added by this spike.

### iOS HealthKit adapter: parity target

`apps/mobile/lib/healthSync.ts` is the iOS HealthKit implementation. It already has partial Android scaffolding because `ENABLED` allows both iOS and Android in native builds, but the native module loader returns a module only on iOS and `isHealthSyncAvailable()` returns `false` on Android.

Actual reads / writes that Android must mirror:

| Suppr capability | Current iOS implementation | Persistence / use | Android target |
|---|---|---|---|
| Steps | `getDailyStepCountSamplesPromise` | `profiles.steps_by_day` | `StepsRecord` read |
| Weight | `getWeightSamplesPromise` | `profiles.weight_kg_by_day`, `profiles.weight_kg` | `WeightRecord` read |
| Body fat | `getBodyFatPercentageSamplesPromise` | `profiles.body_fat_pct` | `BodyFatRecord` read |
| Active energy | `getActiveEnergyBurnedPromise` | `profiles.activity_burn_by_day` | `ActiveCaloriesBurnedRecord` read |
| Basal / resting energy | `getBasalEnergyBurnedPromise` | `profiles.basal_burn_by_day` | `BasalMetabolicRateRecord` or `TotalCaloriesBurnedRecord` read strategy; see note below |
| Workouts | `getWorkoutSamplesPromise` | `profiles.workouts_by_day` | `ExerciseSessionRecord` read, optionally joined to calorie records by time window |
| Dietary import | energy, protein, carbs, fat, fibre, sugar, sodium, saturated fat, cholesterol, caffeine helpers | `nutrition_entries`, caffeine profile map | `NutritionRecord` read |
| Nutrition export | `saveFoodPromise` via `writeNutritionToHealth()` / `exportDayToHealth()` | HealthKit write side-effect | `NutritionRecord` write; `HydrationRecord` write for hydration once Android hydration logging is in scope |

**Basal-energy note:** Health Connect's exact equivalent depends on implementation intent. `BasalMetabolicRateRecord` stores a rate; `TotalCaloriesBurnedRecord` stores total energy expenditure over an interval. Suppr's current profile field stores daily kcal buckets from HealthKit basal energy. The implementation ticket should verify whether Health Connect clients populate `TotalCaloriesBurnedRecord` reliably enough to derive resting burn, or whether Suppr should omit Android basal sync until a source app writes compatible data. Do not guess or synthesize resting energy from BMR formulas.

### UX state

- `apps/mobile/components/onboarding/steps/data-bridges.tsx` shows the Apple Health card only when `Platform.OS === "ios"`.
- `apps/mobile/components/onboarding/steps/permissions.tsx` blocks health permissions on non-iOS with iOS-only copy.
- Notification onboarding already has Android channel handling, but there is no Health Connect card or permission copy.

Future Android UX should fill these stubs with:

- Card title: **Connect Health Connect**.
- Body: explain that Suppr reads activity/body metrics and can write nutrition only with permission.
- CTA: **Review Health Connect permissions**.
- Missing-app path for Android 13 and lower: prompt users to install Health Connect from Google Play, then retry.
- Android 14+ path: direct users to Settings → Security and Privacy → Privacy Controls → Health Connect when managing permissions outside the system sheet.
- Screen-lock edge case: Health Connect requires a device screen lock; surface a plain-language error if permission requests fail because the device is not secured.

## Package due-diligence (2026-06-19)

### First-choice package: `react-native-health-connect`

Verdict: **Use it first, with a fallback native module only if implementation testing finds a blocking gap.**

Verified findings:

- The package describes itself as an Android-only React Native wrapper around Health Connect and documents TypeScript support plus old/new React Native architecture support.
- Version 2 requires React Native 0.71+; Suppr mobile is already on modern Expo / RN.
- It cannot run in Expo Go, but it can run in custom managed apps via Expo Dev Client.
- It requires `minSdkVersion=26`; the Health Connect app itself is usable on Android 9+ and built into Android 14+.
- Google Play release needs a Health Connect declaration / access approval flow. The package docs warn that approval and whitelist propagation can add roughly 2 weeks of calendar time.
- The package API shape (`initialize`, `requestPermission`, `readRecords`, write helpers) is promise-based and differs fundamentally from `react-native-health`'s callback-based HealthKit bridge. That reinforces the platform-suffixed adapter recommendation.

Record coverage for Suppr's target set:

| Required Suppr record | Health Connect record | `react-native-health-connect` verdict |
|---|---|---|
| Steps | `StepsRecord` / `Steps` record type | Covered for read permissions + `readRecords` |
| Weight | `WeightRecord` | Covered |
| Body fat | `BodyFatRecord` | Covered |
| Active calories | `ActiveCaloriesBurnedRecord` | Covered |
| Basal / total calories | `BasalMetabolicRateRecord` / `TotalCaloriesBurnedRecord` | Covered at API level; product semantics need device QA |
| Workouts | `ExerciseSessionRecord` | Covered |
| Nutrition | `NutritionRecord` | Covered for read/write |
| Hydration | `HydrationRecord` | Covered for read/write; include when Android hydration sync is in scope |

### Expo Dev Client / config-plugin path

Use **both** packages during implementation:

1. Add `react-native-health-connect` as the JS/native bridge.
2. Add `expo-health-connect` as the Expo config plugin.
3. Register the plugin in `apps/mobile/app.config.ts` only for Android builds.
4. Ensure `expo-build-properties` is present / configured if the plugin or Android min SDK requires it.
5. Prebuild Android through EAS / Expo Dev Client, not Expo Go.

Native configuration that must be generated or verified:

- Android health permissions for every read/write record type declared in app code and Play Console.
- `<queries>` entry for `com.google.android.apps.healthdata` so availability checks work.
- Permission-rationale Activity for `ACTION_SHOW_PERMISSIONS_RATIONALE` and Android 14+ activity-alias for `START_VIEW_PERMISSION_USAGE`.
- Deep link / intent path to open Health Connect or its Play Store listing when unavailable.

### Fallback if the package blocks us

Fallback is a thin Kotlin native module, not Google Fit:

- Wrap `HealthConnectClient.getSdkStatus`, permission requests, `readRecords`, and `insertRecords`.
- Keep TypeScript API identical to the planned `healthSync.android.ts` adapter.
- Estimated native surface remains small for Suppr's record subset, but the config-plugin / manifest / Play Console work remains required either way.

## Adapter boundary recommendation

**Choose `apps/mobile/lib/healthSync.android.ts`, not in-file Android branches.**

Why:

- The existing `healthSync.ts` is large, iOS-specific, callback-queue-oriented, and contains HealthKit-specific error copy.
- Health Connect is promise/coroutine-oriented, permission names differ, and Android availability has install / screen-lock / Play approval states that do not belong in the iOS adapter.
- A platform-suffixed file can export the same public surface already used by app code:
  - `isHealthSyncAvailable`
  - `probeHealthAccess`
  - `requestHealthPermissions`
  - `requestDietaryHealthPermissions`
  - `syncHealthData`
  - `syncNutritionFromHealth`
  - `syncNutritionFromHealthThrottled`
  - `writeNutritionToHealth`
  - `probeNutritionWrite`
  - `exportDayToHealth`
- Shared persistence stays unchanged. Android should write into the same `profiles.*_by_day` maps and `nutrition_entries` fields, so Today / Progress / Settings surfaces do not fork.

## UX + operations checklist for the future implementation ticket

### UX / product

- Add a Health Connect onboarding card where the iOS-only Apple Health card is currently gated.
- Add Settings re-prompt copy and a diagnostic test-write path equivalent to iOS Health Sync.
- Add missing-Health-Connect prompt for Android 13 and below.
- Add copy for Android 14+ Settings path.
- Add screen-lock-required failure copy.
- Keep one filled CTA per screen; Health Connect should not introduce a second primary CTA in onboarding.

### Revenue / tier gating

**Answer:** Health Connect writes should be **Pro-gated exactly like iOS HealthKit writes**. Reads may remain part of the same free/Pro split as iOS, but nutrition export/write must not become free on Android if it is paid on iOS.

Implementation requirements:

- Create / configure the matching Google Play subscription or product for Suppr Pro.
- Map it to the existing RevenueCat entitlement so app code checks the entitlement, not platform-specific product IDs.
- Verify restore / entitlement state on Android before enabling Health Connect write toggles.
- Include Android paywall parity QA in the implementation ticket.

### Play / Android operations

- Google Play Console enrolment and app creation.
- Android package name / signing key ownership.
- EAS Android build profile and submit profile.
- Internal testing track before production.
- Health Connect declaration form with exact data types and user-facing purpose.
- Privacy policy update that names Health Connect reads/writes and nutrition export.
- RevenueCat Google Play integration and webhook parity.
- Android device QA matrix: Android 9–13 with Health Connect APK, Android 14+, and at least one device with no screen lock.

## Estimated scope when executed

| Phase | Work | Effort |
|---|---|---|
| 0. Android shell / ops | Play Console, signing keys, EAS Android build + submit profiles, internal-testing build, RevenueCat Google Play setup | 1 week ops + setup |
| 1. Native bridge setup | Add `react-native-health-connect`, `expo-health-connect`, Android config plugin, manifest permissions, availability checks | 2-3 days |
| 2. Read parity | `healthSync.android.ts` reads steps, weight, body fat, active calories, workouts, and safe basal/total calories strategy | 1 week |
| 3. Write parity | Pro-gated NutritionRecord writes from meal-log commit path; HydrationRecord if hydration export is in scope | 3-4 days |
| 4. Permissions UX | Onboarding + Settings copy, missing APK prompt, Android 14 settings path, screen-lock edge state | 2-3 days |
| 5. Tests + parity audit | Unit tests mirroring iOS health tests, Android device QA against the health sync matrix, cross-platform parity review | 3-4 days |

Total: ~3–4 weeks single-engineer push, including Android ops setup.

## Risks / pressure test

- **Approval timing risk:** Health Connect Play Console declaration and whitelist propagation can add calendar delay even after code is done. Mitigation: start approval during Phase 0.
- **Record semantics risk:** Basal energy and workout calories may not be populated consistently by source apps. Mitigation: read only records with clear provenance; do not synthesize nutrition or resting energy.
- **Availability risk:** Android 13 and lower require the Health Connect APK; Android 14+ moves Health Connect into Settings. Mitigation: explicit availability state machine and tested copy for each path.
- **Entitlement drift risk:** Android write access accidentally free while iOS write is Pro. Mitigation: gate write toggles on RevenueCat entitlement, not platform.
- **Adapter complexity risk:** In-file branching would destabilize the proven iOS HealthKit path. Mitigation: platform-suffixed adapter with shared public API.

## Sources checked

- Suppr code: `apps/mobile/lib/healthSync.ts`, `apps/mobile/lib/healthKitMealWriter.ts`, `apps/mobile/components/onboarding/steps/data-bridges.tsx`, `apps/mobile/components/onboarding/steps/permissions.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/package.json`, `apps/mobile/eas.json`.
- React Native Health Connect docs: https://matinzd.github.io/react-native-health-connect/docs/get-started/
- React Native Health Connect repository: https://github.com/matinzd/react-native-health-connect
- Expo Health Connect config plugin repository: https://github.com/matinzd/expo-health-connect
- Android Health Connect getting started: https://developer.android.com/health-and-fitness/health-connect/get-started
- Google Fit migration FAQ: https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq

## What this discovery deliberately does NOT cover

- Strava / Garmin / Polar partner APIs — separate cross-platform partner scope.
- Wear OS app surface — separate from Health Connect parity; revisit after Android phone sync ships.
- A new Android design direction — today's implementation assumption remains an Expo Android port with platform-appropriate permission UX.

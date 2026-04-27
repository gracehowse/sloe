# Discovery doc: Google Fit / Health Connect spike (B6)

**Date:** 2026-04-27
**Owner:** Engineering (research only at this stage)
**Status:** Discovery (post-iOS-launch backlog)
**Effort estimate (full execution):** L (3–4 weeks single engineer)
**Re-evaluation trigger:** iOS launch traction signal — defer until we have ≥30-day install + retention data from the App Store. Re-prioritise if Android demand surfaces in support tickets / waitlist signups before that.

---

## TL;DR

Suppr's HealthKit integration ships as a Pro feature on iOS. To reach Android we need the parallel platform integration. The native Android health platform has bifurcated:
- **Google Fit** — deprecated April 2024. New apps should not integrate.
- **Health Connect** — Google's replacement, GA since 2023; bundled into Android 14+, sideloaded as APK on Android 9–13.

This doc captures what we'd need to do to ship Android health-platform parity. We are deliberately NOT executing the spike — recording the discovery so when the trigger fires we can pick up cleanly.

## Why now (at this stage of discovery, not implementation)

iOS launch is the critical path. Android health-platform parity is a 3–4 week effort that delivers nothing for the iOS user base. Build it after we have iOS install data telling us:
- Is HealthKit read/write actually being used? (PostHog: `health_kit_connected` rate, `nutrition_sync_enabled` rate)
- Do users in support tickets ask for Android?
- What's the iOS retention curve — does the app retain users without health-platform integration?

Without those signals the spike is scope inflation. With them we'll know exactly which surfaces to prioritise on Android.

## Current iOS shape (the parity target)

`apps/mobile/lib/healthSync.ts` is the iOS HealthKit adapter. It reads:
- Steps (daily total)
- Weight (most recent)
- Active energy (kcal burned, daily total)
- Resting energy (kcal, daily total)
- Workouts (recent N — surfaced on Today screen)

And writes:
- Nutrition Sync (calories + macros + caffeine + alcohol per logged meal)

Plus a HealthKit-permissions flow at onboarding (`apps/mobile/app/onboarding.tsx` step) and a Settings re-prompt path.

## Health Connect (Android) shape

Health Connect maps closely to HealthKit conceptually — both are platform-mediated stores of health records — but the API model differs:

| HealthKit | Health Connect |
|---|---|
| Native iOS framework, Objective-C / Swift | AndroidX library, Kotlin |
| Apple-mediated permission UI per data type | Google-mediated permission UI per data type |
| Read: `HKHealthStore` queries | Read: `HealthConnectClient.readRecords` |
| Write: `HKQuantitySample` | Write: `NutritionRecord`, `HydrationRecord`, etc. |
| Background delivery via `HKObserverQuery` | Background reads via WorkManager |
| Available on every modern iPhone | APK on Android 9–13; bundled on Android 14+ |

For Suppr's use case (read steps/weight/active energy/workouts; write nutrition) Health Connect has direct equivalents for every record type. No translation layer needed.

## What the spike needs to verify

1. **Expo / React Native package availability.** `react-native-health-connect` exists (community-maintained) — verify it covers all our record types + supports Expo Dev Client. If gaps exist, fallback is a thin native module (Kotlin ~200 LOC).
2. **Android Expo build setup.** Suppr's mobile app is iOS-only in production today. Need: Android signing keys, Expo EAS Android profiles, Google Play Console enrolment, internal testing track. Estimated 1 week of ops work alongside the engineering.
3. **Permission UX parity.** Health Connect's permission sheet looks different from HealthKit's. Onboarding step needs platform branching.
4. **Background sync feasibility.** Expo background tasks on Android have different lifecycle constraints than iOS. The "Nutrition Sync writes happen automatically when a meal is logged" story may need foreground-only on Android initially.
5. **Health Connect availability check.** Android < 14 needs the APK; we need to detect availability + prompt the user to install if missing.

## Estimated scope (when we execute)

| Phase | Work | Effort |
|---|---|---|
| 0. Android shell | Expo Android profile + Play Console enrolment + signing keys + first internal-testing build | 1 week ops + setup |
| 1. Read parity | `apps/mobile/lib/healthSync.android.ts` reading steps / weight / active / resting / workouts via `react-native-health-connect`. Today screen + Progress page render the data. | 1 week |
| 2. Write parity | Nutrition Sync writes from meal-log commit path. HydrationRecord write parallel for hydration log. | 3-4 days |
| 3. Permissions UX | Onboarding step variant; Settings re-prompt path; availability check + APK install prompt for < Android 14. | 2-3 days |
| 4. Tests + parity audit | Unit tests for read/write helpers; cross-platform parity audit; Android-specific QA. | 3-4 days |

Total: ~3-4 weeks single-engineer push, including the 1-week Android ops setup.

## Dependencies / risks

- **Tier gating.** HealthKit write is a Pro feature on iOS. Health Connect write should be the same — but we need to verify RevenueCat entitlements work the same on Google Play (different IAP system). May need a parallel "Pro_Android" product configured in the Play Console.
- **Permission UI surface.** Android users don't expect the same flow as iOS. Onboarding step needs a platform-specific copy variant — the current iOS copy ("Suppr would like to read…") translates literally but the Health Connect modal already says that, so we'd want a higher-level "We use Apple Health on iOS / Health Connect on Android" framing in onboarding.
- **Backfill behaviour.** iOS HealthKit can read a year of historical steps in one query. Health Connect's batch-read limit is 1000 records — for a heavy walker we may need to paginate the historical read. Manageable but needs pagination loop.
- **Apple Watch complication has no Android parallel.** Wear OS exists; Watch complication is Pro on iOS only. Re-scope this for Android: "iOS widget + Watch" → "Android home-screen widget"; Wear OS complication is its own future scope.

## Re-evaluation triggers

Pick this up when at least one of:
1. iOS launch has hit 30 days post-App-Store-live.
2. Support tickets explicitly mention Android in ≥10% of waitlist signups.
3. A specific high-value enterprise / partner deal requires Android.

If none fire by 90 days post-iOS-launch, the question stops being "should we spike?" and becomes "should we deprecate Android plans entirely and double down on iOS?". That's a Grace product call.

## What this discovery deliberately does NOT cover

- Strava / Garmin / Polar partner APIs — separate scope (they're iOS + Android cross-platform, not platform-bound).
- Wear OS app surface (Android equivalent of the iOS Watch complication) — scoped separately from Health Connect; re-evaluate after Health Connect read parity is live.
- Decision on whether Suppr's Android app is a port of the iOS Expo build or a fresh-take design. Today's answer is "port via Expo" but if Phase 3 Today screen v2 introduces Android-specific affordances we'd revisit.

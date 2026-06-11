# Apple Health (HealthKit) integration

## Web (Next.js)

Browsers cannot access Apple Health / HealthKit. Any “sync steps / workouts / weight from Apple” feature belongs in the **native iOS app** (or a companion app), not on the website.

## iOS (Expo / React Native)

1. **Expo Go** does not ship HealthKit entitlements. You need a **development build** or **EAS Build** with a custom `ios` config.
2. Typical libraries:
   - [`react-native-health`](https://github.com/agencyenterprise/react-native-health) (HealthKit bridge)
   - Or a thin native module that reads `HKQuantityTypeIdentifierStepCount` and writes into your backend (e.g. `profiles.steps_by_day` in Supabase).
3. **Permissions**: add `NSHealthShareUsageDescription` (and update if you write) in `Info.plist` via `app.json` / config plugin.
4. **Sync model**: on app open (and optionally background fetch), read steps for “today” and recent days, merge into `steps_by_day` JSON on `profiles` — same shape the Progress screen already expects.

## Android

Google **Health Connect** is the analogue; same idea: native module, not web.

## Current app behaviour

- **Web & mobile** support **manual** steps and weigh-ins on the **Progress** screen (`steps_by_day`, `weight_kg_by_day` on `profiles`).
- **iOS native app:** Apple Health sync and permissions are implemented on **More → Health Sync** (`apps/mobile/app/health-sync.tsx`) with **`react-native-health`** in `apps/mobile/lib/healthSync.ts`.

### If Health Connect breaks again

Use the canonical runbook (timeouts, staged init, AsyncStorage key, the global `enqueueHk` call mutex — one HealthKit call in flight app-wide, ENG-1019):

**[`apple-health-mobile-permissions.md`](./apple-health-mobile-permissions.md)**

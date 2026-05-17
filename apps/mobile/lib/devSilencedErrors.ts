/**
 * Dev-only silenced error patterns.
 *
 * Three kinds of errors hit the RN redbox in dev that should not:
 *
 *   1. **PostHog flush errors** — the SDK queues + retries internally
 *      but yells via `console.error` after a single failed flush. Fires
 *      every time we trip the iOS-18 sim HTTP/3 wedge or background
 *      mid-flush. Production still reports via Sentry through
 *      `initErrorTracking()` so we lose nothing by silencing dev.
 *      (Added 2026-05-14 / 2026-05-15 — see `_layout.tsx` history.)
 *
 *   2. **expo-notifications keychain entitlement failure** — the native
 *      module auto-registers a device push token at app launch, which
 *      hits the iOS keychain. Local `xcodebuild ... CODE_SIGNING_ALLOWED=NO`
 *      builds strip entitlements, so the keychain call rejects with
 *      `Calling the 'getRegistrationInfoAsync' function has failed →
 *      Caused by: Keychain access failed: A required entitlement
 *      isn't present.`. Signed builds (TestFlight, EAS) ship with the
 *      entitlement and never hit this. The rejection is unhandled in
 *      JS because it's emitted from the native module's startup path,
 *      not from any `Notifications.*` call we wrap.
 *      (Added 2026-05-17 — caught while validating the bar-list
 *      macro display PR in an unsigned local sim build.)
 *
 *   3. **Network-flake fallbacks** — Supabase / push-token / weekly-recap
 *      fetches that have explicit warn-and-continue paths. The polyfill
 *      escalates to a redbox even though we handle it. (Added 2026-05-04.)
 *
 * All three escape `LogBox.ignoreLogs` on at least one code path because
 * RN routes unhandled rejections through both console.error/warn AND
 * ExceptionsManager.handleException. The patches in `_layout.tsx` need a
 * shared filter list across all three sinks; this module owns it.
 *
 * Production behaviour: LogBox is disabled in release builds, so these
 * patterns have no production effect. Sentry continues to capture real
 * exceptions via `initErrorTracking()`.
 */

export const DEV_SILENCED_ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  // PostHog flush
  /Error while flushing PostHog/,
  /PostHogFetchNetworkError/,
  // expo-notifications dev-build keychain entitlement failure
  /Calling the 'getRegistrationInfoAsync' function has failed/,
  /Keychain access failed: A required entitlement isn't present/,
  // Network-flake fallbacks (existing, kept for parity with `_layout.tsx`)
  /TypeError: Network request failed/,
  /\[expo-notifications\] Error thrown while updating the device push token/,
  /\[expoPushToken\].*Network request failed/,
  /\[tzSync\] profiles\.tz_iana update failed/,
  /\[tracker\] (?:meal_plan_days|nutrition_entries|fetchMealPlanJson) timed out/,
  /\[useSavedLibraryRecipes\] saves\+recipes batch timed out/,
];

/**
 * Returns true if the given input (string, Error, or anything stringifiable)
 * matches one of the dev-silenced patterns. Used by the console.error /
 * console.warn / ExceptionsManager patches in `_layout.tsx`.
 */
export function matchesSilencedDevError(input: unknown): boolean {
  const text =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? `${input.name}: ${input.message}`
        : String(input);
  return DEV_SILENCED_ERROR_PATTERNS.some((p) => p.test(text));
}

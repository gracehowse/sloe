/**
 * First-log signal helper (L6 G2, 2026-04-18).
 *
 * Not an event — a PostHog user property (`first_log_at`) set via the
 * platform's PostHog client on the FIRST `food_logged` per user.
 *
 * The core predicate + ISO timestamp formatter live here as pure
 * functions so both web (`posthog-js`) and mobile (`posthog-react-native`)
 * can reuse them. The actual `posthog.setPersonProperties` /
 * `posthog.identify` call is thin and platform-specific because the
 * two SDK shapes diverge; that lives in each platform's
 * `markFirstLogIfNeeded` binding.
 *
 * Design notes:
 *  - The web SDK stores a local `first_log_at` in its distinct-id
 *    cookie via `setPersonProperties({}, { first_log_at })` (the second
 *    arg is `$set_once` — idempotent, so repeated calls don't clobber
 *    the earliest value).
 *  - The mobile SDK doesn't expose a `$set_once` helper on the RN
 *    binding today, so we gate with a local flag in `AsyncStorage`
 *    (one-line write per user per install) before calling
 *    `identify(distinctId, { first_log_at })`.
 *  - Fire-and-forget: if the SDK isn't configured (no PostHog key in
 *    dev), all of this is a no-op.
 */

/** ISO-8601 timestamp used as the value of the `first_log_at` person
 * property. Exposed for tests. */
export function firstLogTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}

/** True when the caller should set `first_log_at` on the user. Pass in
 *  the locally-persisted marker (a bool from localStorage / AsyncStorage).
 *  A falsy marker → we have not set it yet on this device → set now. */
export function shouldMarkFirstLog(localMarker: unknown): boolean {
  return !localMarker;
}

/** LocalStorage / AsyncStorage key used by both platforms to dedupe
 *  the `first_log_at` person-property write. The PostHog SDKs already
 *  persist their own state, but using an explicit key keeps this
 *  observable and testable in unit tests. */
export const FIRST_LOG_LOCAL_KEY = "suppr:analytics:first_log_at_set";

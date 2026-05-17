/**
 * ENG-516 (2026-05-16) — Session replay sample-rate flag plumbing.
 *
 * PostHog session replay is currently set to capture every session
 * (sampleRate 1.0). That's the right posture pre-launch when N=1 and
 * every TF/web bug report is high-leverage. Post-launch it must drop
 * to ~0.1 (10%) to keep replay storage from blowing up.
 *
 * This module is the pure-logic layer behind a `session-replay-sample-rate`
 * PostHog feature flag that lets us flip the rate from the PostHog
 * dashboard without a deploy. Default 1.0 today; flip to 0.1 in the
 * dashboard pre-launch.
 *
 * Pattern:
 *   1. On init, read a cached sample-rate value from local persistence
 *      (localStorage on web, AsyncStorage on mobile). Default 1.0.
 *   2. Pass to `session_recording.sampleRate` (web) /
 *      `sessionReplayConfig.sampleRate` (mobile) at SDK init time.
 *   3. After flags load, read the `session-replay-sample-rate` flag's
 *      payload and persist it for the next session.
 *
 * This means a change in the PostHog dashboard takes effect on the
 * user's NEXT session, not the current one. Sampling is a per-session
 * decision in the SDK anyway, so we can't change it mid-session even
 * if we wanted to.
 *
 * First-launch users get the default 1.0. That's fine — capturing the
 * very first session of a fresh user is exactly what we want.
 */

export const SAMPLE_RATE_CACHE_KEY =
  "suppr.posthog.session_replay_sample_rate";

export const SESSION_REPLAY_SAMPLE_RATE_FLAG = "session-replay-sample-rate";

/** Default sample rate when no cached value exists. 1.0 = capture
 *  every session. Matches the pre-flag behaviour wired 2026-05-13. */
export const DEFAULT_SESSION_REPLAY_SAMPLE_RATE = 1.0;

/**
 * Coerce an unknown value to a valid PostHog sample rate (a number in
 * `[0, 1]`). Returns `null` if the value can't be coerced — callers
 * should fall back to {@link DEFAULT_SESSION_REPLAY_SAMPLE_RATE}.
 *
 * Accepts:
 *   - numbers in [0, 1]
 *   - strings that `parseFloat` to a value in [0, 1]
 *   - JSON-stringified numbers wrapped in extra layers (defensive
 *     against PostHog payload variance — payloads come back as
 *     strings of JSON in some SDK versions)
 */
export function parseSampleRate(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    if (raw < 0 || raw > 1) return null;
    return raw;
  }
  if (typeof raw === "string") {
    // PostHog returns payloads as JSON-stringified values on some SDK
    // versions, so a `1.0` payload arrives as the string `"1.0"`. Try
    // both `parseFloat` and `JSON.parse` to be safe.
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const direct = Number.parseFloat(trimmed);
    if (Number.isFinite(direct) && direct >= 0 && direct <= 1) {
      return direct;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parseSampleRate(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolve the effective sample rate given a raw cached value (which
 * may be `null` / `undefined` / a stale-format string). Always returns
 * a usable number — the {@link DEFAULT_SESSION_REPLAY_SAMPLE_RATE} when
 * the cache is unset or malformed.
 */
export function resolveSampleRate(cachedRaw: unknown): number {
  if (cachedRaw == null) return DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
  const parsed = parseSampleRate(cachedRaw);
  return parsed ?? DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
}

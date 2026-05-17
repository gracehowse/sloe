import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
  SAMPLE_RATE_CACHE_KEY,
  SESSION_REPLAY_SAMPLE_RATE_FLAG,
  parseSampleRate,
  resolveSampleRate,
} from "../../../src/lib/analytics/sessionReplaySampleRate";

/**
 * Mobile-side AsyncStorage glue for the `session-replay-sample-rate`
 * PostHog feature flag (ENG-516, 2026-05-16).
 *
 * Split out from `lib/analytics.ts` so it can be tested in isolation
 * without instantiating the real PostHog react-native client (which
 * pulls in native bindings that don't survive the vitest pool).
 *
 * See `src/lib/analytics/sessionReplaySampleRate.ts` for the pure
 * coercion + fallback logic shared with the web side.
 */

/** Minimal PostHog client surface this module reads from. Kept narrow
 *  so tests can pass a plain object without needing the full SDK. */
interface PostHogPayloadReader {
  getFeatureFlagPayload?: (flag: string) => unknown;
}

/**
 * Read the cached sample rate from AsyncStorage, returning the parsed
 * value or the default 1.0 when the cache is unset / malformed /
 * AsyncStorage throws. Used by the mobile AnalyticsProvider before it
 * creates the PostHog client.
 */
export async function readCachedSampleRate(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SAMPLE_RATE_CACHE_KEY);
    return resolveSampleRate(raw);
  } catch {
    return DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
  }
}

/**
 * Persist the current `session-replay-sample-rate` flag payload to
 * AsyncStorage for the next session's `getPostHogClient()` call to
 * pick up. Returns the rate that was written, or `null` if the flag
 * payload was missing / out of range / write failed. Silent on
 * failure — non-fatal for the running session.
 */
export async function writeSampleRateFromClient(
  client: PostHogPayloadReader,
): Promise<number | null> {
  try {
    const payload = client.getFeatureFlagPayload?.(
      SESSION_REPLAY_SAMPLE_RATE_FLAG,
    );
    const rate = parseSampleRate(payload);
    if (rate === null) return null;
    await AsyncStorage.setItem(SAMPLE_RATE_CACHE_KEY, String(rate));
    return rate;
  } catch {
    return null;
  }
}

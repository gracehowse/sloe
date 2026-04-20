import PostHog from "posthog-react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalyticsEventName } from "../../../src/lib/analytics/events";
import {
  FIRST_LOG_LOCAL_KEY,
  firstLogTimestamp,
  shouldMarkFirstLog,
} from "../../../src/lib/analytics/firstLog";

const POSTHOG_KEY =
  Constants.expoConfig?.extra?.posthogKey ??
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  "";
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  "https://us.i.posthog.com";

let client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (client) return client;
  if (!POSTHOG_KEY) return null;

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  });

  return client;
}

type CaptureProps = NonNullable<Parameters<PostHog["capture"]>[1]>;

export function track(
  event: AnalyticsEventName,
  props?: Record<string, unknown>,
): void {
  const c = getPostHogClient();
  if (!c) return;
  c.capture(event, props as CaptureProps);
  // L6 G2 (2026-04-18) — set `first_log_at` person property on the
  // very first `food_logged` per device. Mobile posthog-react-native
  // doesn't expose a `$set_once` helper, so we gate with a one-line
  // AsyncStorage marker. Fire-and-forget.
  if (event === "food_logged") {
    void maybeMarkFirstLog(c);
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  getPostHogClient()?.identify(userId, traits as CaptureProps);
}

export function reset(): void {
  getPostHogClient()?.reset();
}

/** Read a PostHog feature flag synchronously. Returns `false` when
 *  the client isn't initialised or the flag is unloaded. Mirror of
 *  `src/lib/analytics/track.ts#isFeatureEnabled` (web). */
export function isFeatureEnabled(flag: string): boolean {
  const c = getPostHogClient();
  if (!c) return false;
  try {
    return c.isFeatureEnabled(flag) === true;
  } catch {
    return false;
  }
}

/** Convenience wrapper for the `onboarding_v2` PostHog flag.
 *  Centralised so every callsite agrees on the flag key and there's
 *  a single place to flip it for forced rollouts. */
export function isOnboardingV2Enabled(): boolean {
  return isFeatureEnabled("onboarding_v2");
}

/** Subscribe to flag-load events (mirror of the web helper at
 *  `src/lib/analytics/track.ts#subscribeToFlags`). Necessary because
 *  posthog-react-native fetches flags asynchronously after `identify`,
 *  and the redirect from `apps/mobile/app/onboarding.tsx` would
 *  otherwise miss the first flag load.
 *
 *  Returns an unsubscribe function suitable for `useEffect` cleanup. */
export function subscribeToFlags(callback: () => void): () => void {
  const c = getPostHogClient();
  if (!c) return () => {};
  try {
    return c.onFeatureFlags(callback);
  } catch {
    return () => {};
  }
}

async function maybeMarkFirstLog(c: PostHog): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(FIRST_LOG_LOCAL_KEY);
    if (!shouldMarkFirstLog(existing)) return;
    const ts = firstLogTimestamp();
    // On mobile we pass the property via `identify` so it lands on
    // the current distinct-id. posthog-react-native merges this into
    // the user's properties server-side. No-op when distinct-id is
    // still anonymous — the property attaches to the anon profile
    // and follows the user through the next `identify` merge.
    c.identify(c.getDistinctId(), { first_log_at: ts } as CaptureProps);
    await AsyncStorage.setItem(FIRST_LOG_LOCAL_KEY, ts);
  } catch {
    /* storage denied or SDK not ready — ignore, next log retries */
  }
}

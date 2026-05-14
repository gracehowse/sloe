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
// 2026-05-14 — default to the reverse-proxy on suppr-club.com (see
// `next.config.ts` rewrites). The proxy gives all PostHog traffic a
// first-party origin so DNS-level blockers, hostile WiFi, and
// `*.posthog.com` content blockers can't drop the flush — the root
// cause diagnosed for `PostHogFetchNetworkError` flush failures on
// Grace's iPhone over both LTE and WiFi.
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  "https://suppr-club.com/ingest";

let client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (client) return client;
  if (!POSTHOG_KEY) return null;

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Phase A (2026-05-11) — flip mobile session replay ON. Pre-launch
    // we have one tester (Grace), so capturing every session is both
    // affordable and the highest-leverage analytics change we can
    // make: every TF bug report becomes a replayable video instead
    // of a screenshot + memory of "what was the previous screen".
    //
    // SDK defaults we accept as-is (already privacy-conservative):
    //   - maskAllTextInputs:    true (text inputs masked at capture)
    //   - maskAllImages:        true (user images / hero images masked)
    //   - maskAllSandboxedViews:true (iOS UIImagePickerController etc.)
    //   - throttleDelayMs:      1000 (one screenshot per second of activity)
    //
    // OVERRIDES (security review P0, 2026-05-11):
    //   - captureLog:              FALSE. The SDK default is TRUE — every
    //     `console.warn` / `console.error` from the app is embedded in
    //     the replay segment. Suppr's runtime logs include Supabase RLS
    //     error text, vendor API error bodies, push-token failure
    //     messages with `error.message` echoing back row data
    //     (`expoPushToken.ts:172`), and FatSecret vendor messages with
    //     foodIds. None of that is masked by the SDK; it ships as plain
    //     text in the replay. Disable at the SDK layer (belt) and also
    //     keep `consoleLogRecordingEnabled` off in PostHog project
    //     settings (braces).
    //   - captureNetworkTelemetry: FALSE. iOS-only request-timing
    //     capture would include URLs + status codes. Not a hard leak
    //     today but adds an unnecessary capture surface.
    //
    // Anything sensitive (journal text, recipe titles, weight numbers)
    // is masked at the SDK layer before it leaves the device. The
    // replay dashboard sees grey blocks for those regions, not the
    // original text. Use `<PostHogMaskView>` from posthog-react-native
    // to opt MORE elements into masking if needed.
    //
    // sampleRate 1.0 = capture every session. Drop to 0.1 (10%) post-
    // launch when traffic grows; keep at 1.0 while N=1 because partial
    // sampling on one tester is noise.
    enableSessionReplay: true,
    sessionReplayConfig: {
      sampleRate: 1.0,
      captureLog: false,
      captureNetworkTelemetry: false,
    },
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

// `isOnboardingV2Enabled` + `subscribeToFlags` were removed 2026-04-30
// once the onboarding_v2 flag hit 100% and the legacy
// /onboarding redirect was replaced by the canonical route. The
// PostHog flag itself stays — it's the source of truth for the
// rollout history.

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

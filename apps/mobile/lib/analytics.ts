import PostHog from "posthog-react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalyticsEventName } from "@suppr/shared/analytics/events";
import {
  FIRST_LOG_LOCAL_KEY,
  firstLogTimestamp,
  shouldMarkFirstLog,
} from "@suppr/shared/analytics/firstLog";
import { DEFAULT_SESSION_REPLAY_SAMPLE_RATE } from "@suppr/shared/analytics/sessionReplaySampleRate";
import {
  readCachedSampleRate,
  writeSampleRateFromClient,
} from "./sessionReplaySampleRateCache";

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

/** Session-replay sample rate read once at module load and applied at
 *  PostHog SDK init. Default to 1.0 so the first install (and tests
 *  that don't call `primeSessionReplaySampleRate`) match the pre-flag
 *  pre-launch posture. {@link primeSessionReplaySampleRate} overwrites
 *  this from AsyncStorage before the AnalyticsProvider creates the
 *  client. ENG-516 (2026-05-16). */
let initialSampleRate: number = DEFAULT_SESSION_REPLAY_SAMPLE_RATE;

/**
 * Read the cached `session-replay-sample-rate` value from AsyncStorage
 * and prime the SDK init-time sample rate. Must be awaited BEFORE
 * {@link getPostHogClient} is called for the value to take effect on
 * this session — the mobile AnalyticsProvider does this in a one-shot
 * effect before rendering `<PostHogProvider>`.
 *
 * Silent on failure (storage denied / no cached value): the default
 * 1.0 stays in place.
 */
export async function primeSessionReplaySampleRate(): Promise<void> {
  initialSampleRate = await readCachedSampleRate();
}

/** After flags load on the running session, persist the current
 *  `session-replay-sample-rate` flag payload to AsyncStorage for the
 *  next session. Sampling is a per-recording decision in the SDK, so
 *  a dashboard change takes effect on the user's NEXT app launch. */
export async function persistSessionReplaySampleRate(
  c: PostHog,
): Promise<void> {
  await writeSampleRateFromClient(c);
}

/** Test-only: reset the cached sample rate back to the default. Lets
 *  unit tests exercise `primeSessionReplaySampleRate` from a clean
 *  baseline without forcing a module reset. */
export function __resetInitialSampleRateForTests(): void {
  initialSampleRate = DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
  client = null;
}

/** Test-only: read the current module-level initial sample rate. */
export function __getInitialSampleRateForTests(): number {
  return initialSampleRate;
}

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
    // sampleRate driven by the `session-replay-sample-rate` PostHog
    // feature flag (ENG-516, 2026-05-16). Default 1.0 = capture every
    // session — matches the pre-flag pre-launch posture. Flip to 0.1
    // (or lower) in the PostHog dashboard post-launch as traffic
    // grows. The value is read from AsyncStorage cache primed by
    // `primeSessionReplaySampleRate()` before this function is called.
    // Sampling is decided at recording-start, so a dashboard change
    // takes effect on the user's next launch — fine for a slow-moving
    // knob.
    enableSessionReplay: true,
    sessionReplayConfig: {
      sampleRate: initialSampleRate,
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
  const c = getPostHogClient();
  if (!c) return;
  c.identify(userId, traits as CaptureProps);
  // 2026-05-15: force an immediate flag re-evaluation. The SDK's
  // default behaviour is to re-fetch flags on identify, but the call
  // is fire-and-forget and lands on the next flush tick — meaning
  // `isFeatureEnabled` can return a stale `false` for the first
  // render of any screen that depends on a flag-gated layout (e.g.
  // `today_log_usual_row_v2`). Surfaced while wiring Maestro
  // validation for PR #246: the user was identified with email, the
  // flag was correctly targeted, but the Today screen still rendered
  // the flag-off variant because flags hadn't refreshed yet.
  // `reloadFeatureFlagsAsync` triggers an immediate /decide call so
  // the next render sees the right value.
  c.reloadFeatureFlagsAsync().catch(() => { /* swallow */ });
}

export function reset(): void {
  getPostHogClient()?.reset();
}

/** Redesign 2026 flag set — the new design is the DEFAULT in every build
 *  (Grace 2026-06-01: "turn everything on; never flag-gate again"). These
 *  resolve ON regardless of PostHog rollout state or the dead env-force
 *  (ENG-840); the PostHog rows survive only as emergency kill switches via
 *  `isFeatureDisabled`. Keep in sync with the same set in
 *  `src/lib/analytics/track.ts` (web). */
const REDESIGN_DEFAULT_ON = new Set<string>([
  "design_system_elevation",
  "design_system_colours",
  "design_system_brandmark",
  "design_system_icons",
  "redesign_winmoment",
  "redesign_motion",
  "redesign_branded_sheets",
  "redesign_search_results",
]);

/** Read a PostHog feature flag synchronously. Returns `false` when
 *  the client isn't initialised or the flag is unloaded. Mirror of
 *  `src/lib/analytics/track.ts#isFeatureEnabled` (web).
 *
 *  Dev / E2E override (2026-05-15): when `__DEV__` and the env var
 *  `EXPO_PUBLIC_FLAG_FORCE_<FLAG_KEY>` is `"true"` / `"false"`, return
 *  that value directly. Exists because PostHog's local-evaluation
 *  cache races against first render in dev, so a Maestro flow that
 *  exercises a flag-gated screen can't reliably trigger the flag-on
 *  branch via PostHog targeting alone. Production builds ignore this
 *  override completely (the `__DEV__` guard inlines to `false` and
 *  the whole branch is dropped by Hermes' DCE).
 *
 *  Mapping: uppercase the flag and replace hyphens with underscores
 *  (env-var names can't contain hyphens). So `today_log_usual_row_v2`
 *  → `EXPO_PUBLIC_FLAG_FORCE_TODAY_LOG_USUAL_ROW_V2`, and the
 *  hyphenated `log-sheet-slot-selector` →
 *  `EXPO_PUBLIC_FLAG_FORCE_LOG_SHEET_SLOT_SELECTOR`.
 */
export function isFeatureEnabled(flag: string): boolean {
  // `__DEV__` is a React Native runtime global, not defined in the
  // vitest node environment. Guard with `typeof` so the unit tests
  // that render this module under jsdom don't blow up with
  // ReferenceError.
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // Dev/E2E force override (checked FIRST so a test can still force a
    // redesign flag OFF to capture the pre-redesign look). NOTE (ENG-840):
    // the computed `process.env[envKey]` read is inert in a bundled RN app —
    // Metro inlines only static `process.env.X`, never a computed key — so it
    // works under vitest/SSR but not on device/sim. That's fine now: the
    // redesign no longer depends on it (default-ON below), and E2E seeds the
    // static env at Metro start.
    // hyphen→underscore: env-var names can't contain hyphens (see docstring).
    const envKey = `EXPO_PUBLIC_FLAG_FORCE_${flag.toUpperCase().replace(/-/g, "_")}`;
    const override = process.env[envKey];
    if (override === "true") return true;
    if (override === "false") return false;
  }
  // Redesign 2026 — default ON in every build, un-gated (see REDESIGN_DEFAULT_ON).
  if (REDESIGN_DEFAULT_ON.has(flag)) return true;
  const c = getPostHogClient();
  if (!c) return false;
  try {
    return c.isFeatureEnabled(flag) === true;
  } catch {
    return false;
  }
}

/** Fail-safe kill switch over already-shipped, default-ON behaviour.
 *  Mirror of `src/lib/analytics/track.ts#isFeatureDisabled` (web).
 *  Returns `true` ONLY when PostHog is initialised AND the flag resolves
 *  explicitly to `false`; a cold / missing client or an unloaded flag
 *  returns `false` ("not disabled") so the gated behaviour proceeds.
 *
 *  NOT `!isFeatureEnabled(flag)` — that collapses "off" and "not loaded
 *  yet" into one `false`, which would skip the behaviour whenever flags
 *  are cold (the common case during onboarding completion). Use this for
 *  kill switches where the safe cold default is ON (e.g.
 *  `onboarding_default_seeds`, live since 2026-04-30).
 *
 *  Dev / E2E override mirrors `isFeatureEnabled`:
 *  `EXPO_PUBLIC_FLAG_FORCE_<FLAG>` = "false" forces the flag OFF →
 *  disabled `true`; "true" forces ON → disabled `false`. */
export function isFeatureDisabled(flag: string): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // hyphen→underscore: env-var names can't contain hyphens (see docstring).
    const envKey = `EXPO_PUBLIC_FLAG_FORCE_${flag.toUpperCase().replace(/-/g, "_")}`;
    const override = process.env[envKey];
    if (override === "false") return true;
    if (override === "true") return false;
  }
  const c = getPostHogClient();
  if (!c) return false;
  try {
    return c.isFeatureEnabled(flag) === false;
  } catch {
    return false;
  }
}

/** Returns the PostHog payload JSON attached to `flag`, or null when the
 *  client is cold / the flag has no payload. Lets a kill-switch banner's
 *  copy change without an app release — e.g. the `dr-full-outage-banner`
 *  DR kill switch (disaster-recovery runbook row 7). Mirror of
 *  `src/lib/analytics/track.ts#getFeatureFlagPayload` (web). */
export function getFeatureFlagPayload(flag: string): unknown {
  const c = getPostHogClient();
  if (!c) return null;
  try {
    return (
      (c as { getFeatureFlagPayload?: (f: string) => unknown }).getFeatureFlagPayload?.(
        flag,
      ) ?? null
    );
  } catch {
    return null;
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

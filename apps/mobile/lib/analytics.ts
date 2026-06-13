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

/** Dev/QA flag-force overrides (ENG-840). The env-based
 *  `EXPO_PUBLIC_FLAG_FORCE_*` path is DEAD in a bundled app — Metro
 *  inlines only a static `process.env.X`, never a computed
 *  `process.env[key]`, so the env read is `undefined` on device/sim
 *  (it works only under vitest/SSR). A real on-device override must
 *  therefore live in JS state, not the bundle's env. We persist the
 *  forced set in AsyncStorage and prime it into this in-memory map at
 *  bootstrap, because {@link isFeatureEnabled} is synchronous and can't
 *  await storage on every read. `__DEV__`-gated everywhere so Hermes'
 *  dead-code elimination drops the whole mechanism from release builds.
 *
 *  Shape mirrors the web `window.__SUPPR_FORCE_FLAGS__` hook: a flat
 *  `{ [flagKey]: boolean }` map. Flip flags via the dev-only Settings
 *  panel (`DevFlagOverrides`) which calls {@link setForcedFlag}. */
const FORCED_FLAGS_KEY = "__SUPPR_FORCE_FLAGS__";
let forcedFlags: Record<string, boolean> = {};

/** Listeners notified whenever a forced flag changes (ENG-997 fix).
 *  ThemeProvider subscribes so it re-reads the frost flag immediately
 *  after the dev panel flips it — no more "Reload app" dance. */
type ForcedFlagListener = () => void;
const forcedFlagListeners = new Set<ForcedFlagListener>();

/** Subscribe to forced-flag changes. Returns an unsubscribe function.
 *  Dev-only — no-ops in release builds. */
export function onForcedFlagChange(cb: ForcedFlagListener): () => void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return () => {};
  forcedFlagListeners.add(cb);
  return () => { forcedFlagListeners.delete(cb); };
}

function notifyForcedFlagListeners() {
  for (const cb of forcedFlagListeners) {
    try { cb(); } catch { /* listener shouldn't throw, but guard anyway */ }
  }
}

/** Prime the forced-flag map from AsyncStorage. Awaited by the mobile
 *  `AnalyticsProvider` at bootstrap, BEFORE the first flag read, so a
 *  flag forced in a previous session is honoured on first paint. No-op
 *  (and dropped by DCE) in release builds. Silent on failure. */
export async function primeForcedFlags(): Promise<void> {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  try {
    const raw = await AsyncStorage.getItem(FORCED_FLAGS_KEY);
    forcedFlags =
      raw != null ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    forcedFlags = {};
  }
}

/** Dev-only: snapshot of the current forced-flag map (for the toggle
 *  UI). Returns a copy so callers can't mutate module state. */
export function getForcedFlags(): Record<string, boolean> {
  return { ...forcedFlags };
}

/** Dev-only: force `flag` ON (`true`) / OFF (`false`), or `null` to
 *  clear the override and fall back to the live value. Updates the
 *  in-memory map synchronously (so the next read sees it) and persists
 *  to AsyncStorage for the next launch. No-op in release builds. */
export async function setForcedFlag(
  flag: string,
  value: boolean | null,
): Promise<void> {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  if (value === null) {
    delete forcedFlags[flag];
  } else {
    forcedFlags[flag] = value;
  }
  try {
    await AsyncStorage.setItem(FORCED_FLAGS_KEY, JSON.stringify(forcedFlags));
  } catch {
    /* persistence best-effort — in-memory map is already updated */
  }
  notifyForcedFlagListeners();
}

/** Dev-only: clear every forced flag. */
export async function clearForcedFlags(): Promise<void> {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  forcedFlags = {};
  try {
    await AsyncStorage.removeItem(FORCED_FLAGS_KEY);
  } catch {
    /* best-effort */
  }
  notifyForcedFlagListeners();
}

/** Test-only: reset the forced-flag map without a module reset. */
export function __resetForcedFlagsForTests(): void {
  forcedFlags = {};
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

  // ENG-841 — `new PostHog(...)` kicks off an async bootstrap that reads
  // persisted flags / distinct-id from AsyncStorage. If that read rejects
  // (storage unavailable, or a node/jsdom test env where the RN globals are
  // absent) the floating promise surfaces as an UNHANDLED rejection — Sentry
  // noise in production, and a post-test rejection that fails the mobile CI
  // job under vitest even when every test passes. Attach a catch to the
  // readiness promise so the bootstrap can never leak; `isFeatureEnabled`
  // simply falls back to its defaults until flags load.
  void client.ready?.().catch(() => {
    /* bootstrap failed — flags fall back to defaults, never an unhandled rejection */
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
  // Skia hero ring (SPEC 1) — default ON, SAFE for binaries without the
  // native pod: CalorieRing probes TurboModuleRegistry.get("RNSkiaModule")
  // (null, never throws) before requiring the module, so old clients
  // silently keep the SVG layer. Re-enabled 2026-06-10 after the probe
  // landed (the first default-on predated it and red-boxed Grace's phone).
  "ring_skia_v1",
  // ENG-1085 — recipe-detail "Fits your day" confident verdict banner.
  // Default ON (Grace ratified the design-review direction 2026-06-13); the
  // legacy 10%-wash pill stays in the component `else` as the kill switch.
  "fit_verdict_banner_v1",
  "design_system_elevation",
  "design_system_colours",
  "design_system_brandmark",
  "design_system_icons",
  "redesign_winmoment",
  "redesign_motion",
  "redesign_branded_sheets",
  "redesign_search_results",
  "today-weekly-insight-mobile",
  "today_meals_figma_654",
]);

/** Read a PostHog feature flag synchronously. Returns `false` when
 *  the client isn't initialised or the flag is unloaded. Mirror of
 *  `src/lib/analytics/track.ts#isFeatureEnabled` (web).
 *
 *  Dev / QA force override (two layers, `__DEV__`-only, dropped from
 *  release by Hermes DCE):
 *
 *  1. Runtime map ({@link forcedFlags}, ENG-840) — AsyncStorage-backed,
 *     primed at bootstrap, flipped live via the dev Settings panel.
 *     This is the layer that WORKS in a bundled app and is the way to
 *     preview a flag-gated screen on device/sim without a PostHog ramp.
 *  2. Env var `EXPO_PUBLIC_FLAG_FORCE_<FLAG_KEY>` = `"true"`/`"false"`
 *     — test/SSR/Metro-start only. The computed `process.env[key]` read
 *     is `undefined` in a bundled RN app (Metro never inlines a computed
 *     key), so this layer is effectively vitest + E2E-at-Metro-start.
 *
 *  Both exist because PostHog's local-evaluation cache races first
 *  render in dev, so a Maestro/manual flow can't reliably trigger a
 *  flag-on branch via PostHog targeting alone.
 *
 *  Env-key mapping: uppercase the flag and replace hyphens with
 *  underscores (env-var names can't contain hyphens). So
 *  `today_log_usual_row_v2` → `EXPO_PUBLIC_FLAG_FORCE_TODAY_LOG_USUAL_ROW_V2`,
 *  and `log-sheet-slot-selector` → `EXPO_PUBLIC_FLAG_FORCE_LOG_SHEET_SLOT_SELECTOR`.
 */
export function isFeatureEnabled(flag: string): boolean {
  // `__DEV__` is a React Native runtime global, not defined in the
  // vitest node environment. Guard with `typeof` so the unit tests
  // that render this module under jsdom don't blow up with
  // ReferenceError.
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // Runtime override (ENG-840) — checked FIRST. AsyncStorage-backed,
    // primed into `forcedFlags` at bootstrap and flipped live via the
    // dev Settings panel. This is the path that actually works in a
    // bundled app (the env read below does not — see below).
    if (Object.prototype.hasOwnProperty.call(forcedFlags, flag)) {
      return forcedFlags[flag];
    }
    // Legacy env path — test/SSR/Metro-start ONLY. The computed
    // `process.env[envKey]` read is inert in a bundled RN app: Metro
    // inlines only a static `process.env.X`, never a computed key, so
    // this is `undefined` on device/sim. Kept because vitest (real
    // node `process.env`) and Metro-start E2E still rely on it.
    // hyphen→underscore: env-var names can't contain hyphens (see docstring).
    // Intentional dynamic read: does nothing in a bundle (exactly the rule's
    // concern) and is effective ONLY where process.env is real — vitest /
    // Metro-start E2E. The runtime map above is the device/sim path. See ENG-840.
    const envKey = `EXPO_PUBLIC_FLAG_FORCE_${flag.toUpperCase().replace(/-/g, "_")}`;
    // eslint-disable-next-line expo/no-dynamic-env-var -- intentional; see note above (ENG-840)
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
    // Runtime override (ENG-840) — mirrors `isFeatureEnabled`. A flag
    // forced OFF is "disabled" (`true`); forced ON is "not disabled".
    if (Object.prototype.hasOwnProperty.call(forcedFlags, flag)) {
      return forcedFlags[flag] === false;
    }
    // Legacy env path — test/SSR only (computed env read is dead in the
    // bundle; see `isFeatureEnabled`).
    // hyphen→underscore: env-var names can't contain hyphens (see docstring).
    // Dead in the bundle, effective only under vitest / Metro-start E2E; the
    // runtime map above is the device/sim path. See note in `isFeatureEnabled`.
    const envKey = `EXPO_PUBLIC_FLAG_FORCE_${flag.toUpperCase().replace(/-/g, "_")}`;
    // eslint-disable-next-line expo/no-dynamic-env-var -- intentional; see note above (ENG-840)
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

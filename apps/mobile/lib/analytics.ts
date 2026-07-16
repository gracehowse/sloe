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
import {
  getAnalyticsConsent,
  onAnalyticsConsentChange,
} from "./analyticsConsent";

const POSTHOG_KEY =
  Constants.expoConfig?.extra?.posthogKey ??
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  "";
// 2026-05-14 — default to the reverse-proxy on suppr-club.com (see
// `next.config.ts` rewrites). The proxy gives all PostHog traffic a
// first-party origin so DNS-level blockers, hostile WiFi, and
// third-party PostHog content blockers can't drop the flush — the root
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
  return () => {
    forcedFlagListeners.delete(cb);
  };
}

function notifyForcedFlagListeners() {
  for (const cb of forcedFlagListeners) {
    try {
      cb();
    } catch {
      /* listener shouldn't throw, but guard anyway */
    }
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
  // ENG-1286 — consent gate (launch blocker). Mirror of the web
  // `opt_out_capturing_by_default: consent !== "accepted"` posture
  // (src/app/components/AnalyticsProvider.tsx), but STRONGER: on RN the
  // SDK is never constructed at all pre-consent, because
  // `enableSessionReplay` is an init-time option — the native replay
  // recorder starts with the client, so opt-out-after-init is not a
  // reliable replay gate the way it is on posthog-js. No consent → no
  // client → no events, no replay, no device storage writes. `null`
  // (never asked / prime pending) and "declined" are both closed —
  // fail-closed, matching web where the banner-unanswered state is
  // opted out. Every call site already tolerates a null client (track /
  // identify / reset / isFeatureEnabled / isFeatureDisabled /
  // getFeatureFlagPayload all early-return). Known cost, shared with a
  // cold client: PostHog-side kill switches (`isFeatureDisabled`) can't
  // fire for un-consented users — REDESIGN_DEFAULT_ON still resolves.
  if (getAnalyticsConsent() !== "accepted") return null;

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Phase A (2026-05-11) — flip mobile session replay ON. Pre-launch
    // we have one tester (Grace), so capturing every session is both
    // affordable and the highest-leverage analytics change we can
    // make: every TF bug report becomes a replayable video instead
    // of a screenshot + memory of "what was the previous screen".
    // ENG-1286 (2026-07-01): replay is consent-gated — this init only
    // runs once stored consent === "accepted" (gate above), so
    // "every session" means every CONSENTED session, matching web.
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

// ENG-1286 — apply consent flips to the client without an app restart
// (mirror of web's `suppr-consent` event listener in
// AnalyticsProvider.tsx). Accepted → construct the client if this is
// the first accept (the gate above now passes) and ALWAYS optIn(): the
// SDK persists an opt-out flag in its own storage, so a
// decline→re-accept would otherwise stay silently opted out on the
// next construction. Declined → optOut() on the live client (stops
// event capture + session replay per the SDK's opt-out contract); the
// instance is intentionally kept, matching web where posthog stays
// loaded but opted out. On the NEXT launch the gate above returns null
// before construction, so a declined user never re-inits the SDK.
onAnalyticsConsentChange((choice) => {
  if (choice === "accepted") {
    const c = getPostHogClient();
    void c?.optIn?.()?.catch?.(() => {
      /* opt-in persistence failed — capture still proceeds this session */
    });
  } else if (choice === "declined" && client) {
    void client.optOut?.()?.catch?.(() => {
      /* opt-out persistence failed — the consent gate still blocks the
         next launch; in-session capture stops via the SDK flag */
    });
  }
});

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

export function identify(
  userId: string,
  traits?: Record<string, unknown>,
): void {
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
  c.reloadFeatureFlagsAsync().catch(() => {
    /* swallow */
  });
}

export function reset(): void {
  getPostHogClient()?.reset();
}

/**
 * Default-OFF feature flags (NOT in `REDESIGN_DEFAULT_ON`). Listed here so
 * the flag is discoverable on both platforms; a flag absent from every
 * default-on set and not live in PostHog resolves to `false` (the safe
 * dark default). To preview on device, force it ON via the dev Settings
 * panel (`setForcedFlag("reveal-macro-tile-paired-pct", true)`).
 *
 * - `reveal-macro-tile-paired-pct` — onboarding reveal-step layout A/B that
 *   pairs the macro % inline with grams. DEFAULT-OFF *by design*: Grace
 *   ramps it in PostHog only after validating it in TestFlight, so it is
 *   deliberately excluded from the ENG-1225 flag-collapse sweep (not a
 *   built-but-dark v3 surface). Mirror of the web note in
 *   `src/lib/analytics/track.ts`.
 *
 * (The 5 cook-mode flags moved to `REDESIGN_DEFAULT_ON` in the 2026-06-22
 *  flag-collapse sweep, after the ENG-1230 swipe-surface render bug was
 *  fixed — the v3 cook baseline is now default-on.)
 */

/** Redesign 2026 flag set — the new design is the DEFAULT in every build
 *  (Grace 2026-06-01: "turn everything on; never flag-gate again"). These
 *  resolve ON regardless of PostHog rollout state or the dead env-force
 *  (ENG-840); the PostHog rows survive only as emergency kill switches via
 *  `isFeatureDisabled`. Keep in sync with the same set in
 *  `src/lib/analytics/track.ts` (web). */
const REDESIGN_DEFAULT_ON = new Set<string>([
  // ENG-1464 — trust chips/dots show the source name ("USDA") instead of the
  // "USDA verified" over-promise. Default-ON (N=1 tester); flag-off keeps the
  // legacy "USDA verified" copy (kill switch). Keep in sync with web.
  "trust_source_name_v1",
  // ENG-1527 — the shopping-list "Update from plan" re-sync affordance
  // (mobile + web). Default-ON so the dead-end fix ships everywhere; the
  // PostHog gate is the kill switch for the non-destructive DB write path.
  "shopping_update_from_plan_v1",
  // Skia hero ring (SPEC 1) — default ON, SAFE for binaries without the
  // native pod: CalorieRing probes TurboModuleRegistry.get("RNSkiaModule")
  // (null, never throws) before requiring the module, so old clients
  // silently keep the SVG layer. Re-enabled 2026-06-10 after the probe
  // landed (the first default-on predated it and red-boxed Grace's phone).
  "ring_skia_v1",
  // Device-validated 2026-07-07 (device-verify2 pass, 4/4 verbatim contract
  // match) + Fable lens review on ENG-1454's under-eating string — flipped
  // per the growth-builds-default-ON convention.
  "empty_state_grammar_v1", // ENG-1372 slice 1 — Today fresh-day ring + Plan empty week
  "coaching_stages_v1", // ENG-1454 — staged coach copy + broken-streak recap grace

  // Device-validated 2026-07-07 (device-verify2 pass, 4/4 verbatim contract
  // match) + Fable lens review on ENG-1454's under-eating string — flipped
  // per the growth-builds-default-ON convention.

  // ENG-1086 — empty cold-open calorie ring paints the brand-gradient loop
  // (Skia sweep) instead of a grey skeleton. Default-on; off → legacy grey
  // track + hairline empty render.
  "ring_empty_gradient_v1",
  // ENG-1093 — empty + Show-macros parity: an empty day with macros SHOWN renders
  // the populated multi-ring unpopulated (calorie track + 3 grey macro tracks)
  // instead of the single bold cold-open loop, so it matches a populated day
  // exactly, just empty (Grace 2026-06-13). Collapsed-empty keeps the ENG-1086
  // loop. Default-on; off → empty always shows the single loop (pre-ENG-1093).
  "ring_empty_macro_parity_v1",
  // ENG-1092 — "Purposeful empties": empty meal slots (Today + Plan) show a
  // tinted icon + "Aim ~X kcal" (redistributed budget) instead of a bare name /
  // "Empty slot", and empty slots render at full opacity (matching web). Default
  // on; off → pre-ENG-1092 empties (bare name + the 0.55 dim on Today).
  "plan_today_aim_empty_v1",
  // ENG-1225 #22 — Progress weight card "No weigh-ins yet" sparse state
  // (WeightSparseState 0-branch) replaces the broken "—" hero/chart/dashes-row
  // for never-logged users. Default-on; OFF → legacy dashes. Web parity twin is
  // `web_progress_weight_empty` (WEB_ONLY name — see redesignDefaultOnParity).
  "progress_weight_empty",
  // ENG-1131 / ENG-1193 — web Plan parity (move, templates, portion) + smart
  // suggestions (web + mobile). Default-on; keep in sync with track.ts.
  "plan_web_parity_v1",
  // ENG-1129 — cook-mode servings-eaten confirm before journal write. Default-on;
  // off → legacy batch-scale multiply. Keep in sync with track.ts.
  "cook_log_servings_confirm",
  // ENG-1097 — the Today import onboarding nudge renders as a flat WHITE card
  // (matching every sibling Today card via SupprCard) with a solid aubergine
  // "Try it" CTA, instead of the legacy tinted+bordered slab + outline CTA that
  // predated the flat-card law (Grace 2026-06-13: "is this in keeping with
  // styling?"). iOS-only (the nudge has no web surface). Default-on; off → the
  // legacy clay-wash + 1px border + outline CTA (kill switch).
  "import_nudge_flat_white_v1",
  // ENG-898 — CreateRecipeActionSheet 2×2 Julienne-style source grid (import.md
  // §3.1). Default-on; off → legacy stacked ActionRow list.
  "create_recipe_action_sheet_grid_v1",
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
  // ENG-771 (Gate 1) — MFP-refugee logging loop: ship the loop features
  // default-on; PostHog rows remain kill switches via isFeatureDisabled.
  "today_log_again",
  "log-sheet-slot-selector",
  "today_log_usual_row_v2",
  // ENG-978/979 — shareable import-success card + creator credit (keep in sync w/ track.ts).
  "recipe_share_card_v1",
  "log_sheet_nl_text_v1",
  // ENG-980 — save-first import (keep in sync w/ track.ts).
  "import-save-first-v1",
  // ENG-965 / ENG-990 — refugee app-choice step default-on.
  "onboarding-app-choice",
  // ENG-1065 — Planned card empty branch on Today (F-178/F-179). Default-on;
  // off → host hides the card when the plan day has no meals.
  "today_planned_empty_state",
  // ENG-901 — Figma `284:2` inline trust row on paywall. Default-on; off → pills.
  "paywall_trust_inline_v1",
  // ENG-1203 — merchandise the free MFP-switch wins (barcode scanning + custom
  // macros) on the paywall comparison matrix. Default-on; off → legacy four-row
  // matrix without the two free callouts. Keep in sync with track.ts (web).
  "paywall_free_mfp_wins_v1",
  // ENG-1225 #3 — unified "import anything" sheet (detect-anything classifier +
  // single front door). Default-on per the "turn everything on" rule; off → the
  // legacy per-surface nav (Discover card → /import-shared), kept as kill switch.
  "sloe_v3_unified_import",
  // ENG-1225 Block 6 — the v3 Discover editorial sections (Quick weeknight
  // no-photo cards + Collections) above the cuisine clusters. Default-on; off →
  // the legacy feed without those sections (kill switch). Keep in sync w/ web.
  "sloe_v3_discover_editorial",
  // ENG-1225 #14 — the v3 Discover creator plane (creator rail + Following
  // feed; web twin adds the featured hero). RAMPED ON 2026-06-24 (ENG-1247,
  // Grace's call); self-hides when the `creators` table is empty (seed fallback
  // pre-launch), so it is safe on. Off → the legacy feed (kill switch). M+W.
  "discover_creator_rail_v1",
  // ENG-1225 flag-collapse sweep (2026-06-22) — the v3 cook-mode baseline.
  // Built (ENG-944/946/947/948/949) but dark-by-default until this sweep; the
  // audit's launch-blocker #4. On-device SEE found a swipe-surface render bug
  // (step body invisible) — FIXED in ENG-1230 (recipe/[id].tsx top-group flex)
  // before flipping these on. Each default-on now; off → pre-v3 cook (kill
  // switch). Keep in sync with web.
  "cook_step_ingredients_v1", // "For this step" ingredient chip row
  "cook_swipe_steps_v1", // swipe between steps + quiet page indicator
  "cook_ingredient_checklist_v1", // mise-en-place ingredient checklist
  "cook_multi_timers_v1", // concurrent step timers
  "cook_text_size_control_v1", // cook-mode text-size control
  // ENG-1225 Block 8 — Progress energy balance as an EQUATION (intake −
  // maintenance = deficit/day) + "How maintenance works" explainer. Now built
  // on mobile too (ProgressEnergyEquation), so it's a SHARED default-on flag
  // (was web-only). Off → the legacy 3-cell triad (kill switch).
  "sloe_v3_energy_equation",
  // ENG-1225 Block 2 — the v3 Plan IA top section (PlanV3Surface: "Your plan"
  // header + verdict + week-strip day selector + day-detail calorie band).
  // Mobile-only for now (web Plan v3 is a later block). Off → the legacy Plan
  // header/chrome (kill switch). Per-slot cards + meal-filter = Block 3.
  "sloe_v3_plan",
  // ENG-1247 flag-collapse (2026-06-29, Grace) — conformance batch default-on;
  // PostHog remains the kill switch via isFeatureDisabled. Keep in sync w/ web.
  "loghub_quick_actions_v1",
  "recipe_detail_v3_conformance",
  "profile_showcase_v1",
  // ENG-1246 (Gap #16) — the shared editorial Profile block: identity → streak
  // dots + best/freezes line → milestones list → recipe grid, replacing the two
  // divergent inline strips. Default-on; off → the legacy identity strip /
  // showcase (kill switch). Keep in sync with src/lib/analytics/track.ts.
  "sloe_v3_profile",
  "mfp_tracker_reassurance_v1",
  "today_hero_decard_v3",
  "today_quickadd_recents_v3",
  "eng1247_section_a_v1",
  "weekly_recap_detail_v1",
  // ENG-751 — macro-detail per-ingredient display from snapshot rows.
  "nutrition_entry_ingredients_v1",
  // ENG-956 — per-meal lock + "Refresh the rest" partial regenerate.
  "plan_meal_lock_v1",
  // ENG-1261 / B28 — keep vs clear reset-plan sheet before regenerate.
  "reset_plan_confirm_v1",
  // ENG-1260 / B26 — 3-step delete-account sheet.
  "delete_account_sheet_v1",
  // ENG-953 — calm "Expenditure" trend card on Progress, under Maintenance.
  // FLIPPED DEFAULT-ON 2026-06-30 (Grace, "always flag on" for beta-window
  // growth builds). Off → the card hides and the Maintenance "How this works"
  // expandable stays the live path (kill switch: remove here / PostHog). M+W.
  "expenditure_trend_card",
  // ENG-1237 — body fat + derived lean-mass trends on Progress (Pro-gated).
  // DEFAULT-ON per ENG-1279 — off → card hidden (kill switch). Web + mobile.
  "body_composition_trends_v1",
  // ENG-1279 "always flag on" batch (2026-06-30, Grace) — beta-window growth
  // builds flipped default-ON so the solo tester sees them; each keeps its
  // legacy/empty else as the kill switch (remove here / PostHog). Web + mobile.
  "progress_plateau_insight_v1", // ENG-954 — calm plateau insight line
  "weigh_in_reminder_v1", // ENG-955 — opt-in weigh-in reminder Settings surface
  "portion_fit_hint_v1", // ENG-854 — portion-fit hint in food-search preview
  // ENG-855 / make-anything-fit Mode B — distribute-around-anchor on the Plan
  // tab. When the user drops a meal they *want* into the plan, the remaining
  // day budget spreads across the other open slots as per-slot calorie + macro
  // budgets, with a body-neutral, enabling-not-restricting summary line. Math:
  // `distributeAroundAnchor` in `@suppr/nutrition-core/distributeAroundAnchor`;
  // a low-confidence anchor → qualitative fallback, never a fabricated per-slot
  // number. DEFAULT-ON per ENG-1279 ("always flag on"); the legacy Plan view
  // (no Mode-B band) stays in the `else` as the kill switch. Mirror of the web
  // entry in src/lib/analytics/track.ts. M+W.
  "plan_distribute_anchor_v1",
  // ENG-1240 — full Coach screen (Today's read + ranked suggestions + Ask chips).
  "coach_screen_v1",
  // ENG-943 — "Add to shopping list" from a single recipe (mobile recipe/[id] +
  // web RecipeDetail). Parses the recipe's ingredients, aggregates duplicates
  // (count-to-weight normalise where high-confidence, never guesses a weight),
  // and APPENDS to the user's list (merging rows already there). DEFAULT-ON per
  // Grace's "always flag on" policy (ENG-1279) — off → the action is hidden and
  // the list stays plan-only (kill switch: remove here / PostHog). Web + mobile.
  "recipe_shopping_list_v1",
  // ENG-1235 — owner Claim → Official macros provenance toggle. DEFAULT-ON per
  // beta-window policy; off → owner action is hidden while the server route
  // remains protected by auth/ownership/service-role checks. Web + mobile.
  "official_recipe_claim_v1",
  // ENG-728 — CALM one-shot import-success win-moment overlay (log-confirm,
  // reduce-motion → instant). DEFAULT-ON per ENG-1279 ("always flag on") — off →
  // the success sheet renders verbatim (kill switch). Web + mobile.
  "import_magic_moment",
  // ENG-969 — calm single-line projected-weight chart on the Pro paywall (shared
  // computeTrajectory; renders only when a real projection exists). DEFAULT-ON per
  // ENG-1279 — off → paywall without the chart (kill switch). Web + mobile.
  "paywall_trajectory_chart_v1",
  // ENG-957 — plan→shopping-list edit-driven re-sync. Adding / removing /
  // swapping a meal in the Plan keeps the list in sync via the shared appender
  // (ENG-943) + remover: an add appends+merges (preserving checked rows), a
  // remove/swap decrements only the outgoing recipe's contribution (provenance
  // = the `source` field), never a full delete-and-replace. DEFAULT-ON per
  // Grace's "always flag on" policy (ENG-1279) — off → the legacy one-off list
  // (explicit "Generate Shopping List" only; kill switch: remove here / PostHog).
  // Mirror of the web entry in src/lib/analytics/track.ts. M+W.
  "plan_shopping_sync_v1",
  // ENG-722 — log-confirm checkmark micro-animation (Noom teardown element D):
  // a calm sage check scale-fades over the Today ring on every successful log
  // (visual half; the light commit haptic shipped 2026-04-28). DEFAULT-ON per
  // the "always flag on" beta-window policy; off → no animation (kill switch).
  // Reduce-motion → no check. Mirror of the web entry in track.ts. M+W.
  "log_confirm_check_v1",
  // ENG-713 — the opt-in body-neutral "Trend-only weight" Settings toggle (ED +
  // dysphoria dignity). DEFAULT-ON per the "always flag on" beta-window policy,
  // but the FLAG only controls whether the opt-in TOGGLE exists — the FEATURE
  // itself is opt-in (the client-side pref defaults OFF, so no behaviour changes
  // until the user flips it). Off → the toggle is hidden and Progress renders
  // exactly as today (kill switch: remove here / PostHog). The pref reuses the
  // T13 `trends_only` render path (no new weight-surface fork). Mirror of the
  // web entry in src/lib/analytics/track.ts. M+W.
  //
  // COPY GATE: the neutral trend strings in
  // `src/lib/preferences/trendOnlyWeight.ts` need diversity-inclusion +
  // legal-reviewer sign-off before this ramps beyond the solo tester (see
  // docs/decisions/2026-07-01-trend-only-weight-mode.md).
  "progress_trend_only_v1",
  // ENG-1283 — import review honesty: when a URL/social import leaves ≥1
  // ingredient flagged (below the 0.55 confidence floor / quantity-less /
  // unverified) or has no usable macro spine, the review surfaces a calm
  // "N of M ingredients need review — the macro total may be incomplete." line
  // + marks the affected rows, instead of a silent under-counted success.
  // Derives from the SHARED importQualitySignal predicate (no recompute; no
  // parser / floor / legal / persistence change). DEFAULT-ON per the "always
  // flag on" beta-window policy; off → today's silent-success render exactly
  // (kill switch: remove here / PostHog). Mirror of the web entry in
  // src/lib/analytics/track.ts. Web + mobile.
  "import_review_flagged_ingredients_v1",
  // ENG-1300 (was ENG-685 ship-OFF-and-ramp): SmartImage's expo-image path —
  // memory-disk cachePolicy, recyclingKey, 200 ms cross-fade over a DS-tint
  // placeholder. With the flag off, prod fell to the raw RN Image kill-switch
  // and grids refetched every image on scroll. DEFAULT-ON per Grace's "always
  // flag on" beta-window policy (ENG-1279); off → verbatim RN Image, zero
  // visual change (kill switch: remove here / PostHog). Mobile-only surface
  // (web has no expo-image) — listed under MOBILE_ONLY in
  // tests/unit/redesignDefaultOnParity.test.ts, no web mirror entry.
  "expo_image_adoption_v1",
  // ENG-1233/1241 — onboarding conversion funnel: the guided first-log
  // activation step (ENG-1233) then the optional, skippable "See Pro"
  // trial ask (ENG-1241, TERMINAL — skip lands straight on Today). Runs
  // first-log → upgrade after data-bridges. Default-ON per the beta-window
  // house rule (Grace is the N=1 tester); OFF → data-bridges stays terminal
  // (legacy flow, byte-identical). This IS the flag the ENG-1241 brief
  // called "onboarding-see-pro" — reused rather than renamed to avoid
  // breaking the live PostHog funnel dashboards keyed on it. Mirror of the
  // web entry in src/lib/analytics/track.ts.
  "onboarding_conversion_funnel_v1",
  // ENG-1023 — Apple Health meal-import kill switch. Default-ON so existing
  // nutrition import continues after separating core body permissions from
  // dietary import authorization; OFF skips dietary permission requests and
  // nutrition reads without affecting steps / weight / burn sync. Mobile-only.
  "health_nutrition_import_enabled",
  // ENG-974 — "Refine by describing" conversational correction on photo +
  // voice log review (docs/decisions/2026-07-01-log-refine-by-describing.md
  // ratified it Shipped default-ON, but the flag was never added here, so it
  // sat dark — ENG-1302 closed the gap). Off → hosts render their legacy
  // review without the refine input (kill switch: remove here / PostHog).
  // Mirror of the web entry in src/lib/analytics/track.ts. M+W.
  "log_refine_describe_v1",
  // ENG-1303 — the v3 method-grid TILE grammar for the LogSheet input-method
  // row (rounded secondary-surface tiles: Scan / Photo / Voice / Describe /
  // Quick add, frost lock badge in place of the "PRO" text pill) + the sheet
  // header copy "Add to today" (was "Log a meal"). Describe is a first-class
  // tile that expands the inline describe flow. DEFAULT-ON per the beta-window
  // "always flag on" policy (Grace 2026-07-02) — off → the legacy circular
  // input chips + "Log a meal" header render byte-for-byte (kill switch:
  // remove here / PostHog). Mirror of the web entry in
  // src/lib/analytics/track.ts. M+W.
  "sloe_v3_log",
  // ENG-1461 — jargon-gloss system (ENG-1187): TDEE/BMR renders lead with
  // plain English ("Est. daily burn (TDEE)"), acronym secondary. DECIDED
  // (Fable, 2026-07-07, per Grace's delegation) to flip ON and extend beyond
  // onboarding to Progress + pricing + the weekly check-in. Off → the plain
  // (pre-gloss) label at each site — never a broken render, so still a safe
  // kill switch. Mirror of the web entry in src/lib/analytics/track.ts. M+W.
  "onboarding_jargon_gloss_v1",
]);

/**
 * DEFAULT-OFF flags (registered for discoverability — NOT in REDESIGN_DEFAULT_ON,
 * so `isFeatureEnabled` resolves them false until PostHog ramps them). Keep this
 * list in sync with the same block in `src/lib/analytics/track.ts`.
 *
 * - `logsheet_ai_method_tooltip` (ENG-1252) — first-session inline tooltip
 *   ("AI logging — available with Pro.") under the locked Voice / Snap chip
 *   in the LogSheet `InputModeRow`, free-tier, first ~3 sessions. Gate logic:
 *   `@suppr/shared/today/aiMethodTooltip`.
 * - `progress_milestone_celebration_v1` (ENG-952) — quiet two-tier milestone
 *   celebration crossing the 10 Happy-Scale-style milestones. Web + mobile.
 * - `onboarding_progressive_text` (ENG-720) — word/clause-staggered text reveal
 *   on the two onboarding "moment" beats (Welcome wordmark+tagline, Reveal
 *   "Your plan is ready." heading). Each token fades + rises a few px,
 *   staggered by `PROGRESSIVE_TEXT_STAGGER_MS` (`@suppr/shared/motion`). Flag-OFF
 *   or reduce-motion (`useReduceMotion`) → instant text (zero visual change).
 *   Component: `ProgressiveText` (web + mobile). Web + mobile.
 * - `onboarding-why-now` (ENG-963) — the optional "What's bringing you here?"
 *   onboarding step (placed after `goal`). DEFAULT-OFF: when OFF both flow
 *   shells auto-skip the step (same mechanism as `onboarding-app-choice`)
 *   and drop it from the step counter, so the live flow is unchanged and the
 *   change is mergeable headless. Grace ramps it in PostHog after a sim + web
 *   glance at the new step's pixels. Web + mobile.
 * - `empty_state_grammar_v1` (ENG-1372, slice 1) — the first-week empty-state
 *   grammar contract: Today ring fresh-day (warm-tint empty track, time-aware
 *   "Log breakfast/lunch/dinner" pill inside the hero, BONUS stat cell
 *   suppressed at 0) + Plan empty-week (warm invitation card replaces the
 *   dashed-box wall + zero-triad). MOVED to `REDESIGN_DEFAULT_ON` 2026-07-07
 *   after the device-verify2 pass (4/4 verbatim). Off → legacy treatment
 *   exactly (kill switch). Web + mobile.
 * - `coaching_stages_v1` (ENG-1454, 2026-07-06 Fable-day failure-moment
 *   judgment) — staged over/under-budget Today coach line (approaching
 *   85-100% / landed 100-110% / over 110-140% / big >140% of goal — see
 *   `src/lib/nutrition/coachOverBudgetStage.ts`), the neutral net-energy
 *   "Net energy today: +{n} kcal" reframe (replaces the 2nd-person "you've
 *   eaten N more than you've burned" accusation), the two ED-safe
 *   under-eating nudges, and the weekly-recap broken-streak grace rewrite
 *   (achievement-led headline, one-clause reset, streak-freeze mechanic
 *   surfaced at the break, protein digest line). MOVED to
 *   `REDESIGN_DEFAULT_ON` 2026-07-07: device-verify2 matched every contract
 *   string verbatim, and the wired under-eating string passed the
 *   diversity-inclusion + nutrition-engine lens review (on ENG-1454). Off →
 *   every gated surface renders its exact pre-ENG-1454 copy (kill switch). Web +
 *   mobile.
 * - `paywall_fallback_when_unavailable` (ENG-1381) — when RC offerings fail
 *   to load (`subscriptionsUnavailable`), render the plan selector +
 *   auto-renew disclosure with FALLBACK_PRICES + an indicative-price caveat
 *   instead of a stateless "Open App Store" screen. DEFAULT-OFF — enable
 *   only after legal (CMA disclosure w/ indicative price) + design review.
 *   Off → current stateless degraded screen (unchanged). Mobile-only (the
 *   RevenueCat `subscriptionsUnavailable` state is native-IAP-specific; web
 *   billing is Stripe).
 * - `kcal_trust_qualifier_v1` (ENG-1417) — a "~" prefix on kcal displays
 *   that are an unverified estimate rather than a verified nutrition
 *   lookup (`recipes.is_verified`), on decision-driving surfaces only:
 *   the north-star suggestion card, meal planner day totals, Cook Mode,
 *   and Discover's calorie sort — NOT on browse-level recipe cards
 *   (Discover grids, Library editorial shelves), which a prior audit
 *   (2026-04-28, GW-08) found read as decorative noise. DEFAULT-OFF: net
 *   new, not yet sim-validated — Grace ramps in PostHog after a web +
 *   mobile glance. Off → all gated surfaces render their exact
 *   pre-ENG-1417 kcal display (kill switch). Web + mobile.
 * - `discover_verified_filter_v1` (ENG-1417) — a "Verified only" filter
 *   chip on web Discover, wiring the previously-dead `filters.verified`
 *   state (it existed and was checked, but no control ever set it).
 *   DEFAULT-OFF: net new structural control, not yet sim-validated.
 *   Registered here only for the web ↔ mobile KNOWN_DEFAULT_OFF_FLAGS
 *   parity check — the flag is web-only in practice (mobile Discover has
 *   no equivalent filter sheet), so no mobile code reads it.
 * - `energy_numbers_v1` (ENG-1506/1507) — the canonical energy-numbers
 *   reconciliation: every maintenance surface reads `selectMaintenance`
 *   (one input policy — latest weigh-in, strict-null basics), Targets +
 *   Expenditure stop bypassing the resolver, the net-energy "maintenance"
 *   state word becomes "Balanced", and empty todays show an empty state
 *   instead of "0 kcal maintenance". DEFAULT-OFF: real users' displayed
 *   maintenance MOVES when this ramps (the intended convergence) — Grace
 *   ramps in PostHog with before/after screenshots per
 *   `docs/decisions/2026-07-11-canonical-energy-numbers.md`. Off → every
 *   surface renders its exact pre-ENG-1506 numbers AND no write path
 *   adopts the new input policy — the goal-editor recompute baseline,
 *   daily-target snapshot/backfill inputs, and the projection
 *   goal-vocabulary fallback are all host-gated on this flag (kill
 *   switch; re-verified 2026-07-11 review round). The server weekly-recap
 *   push route can't read the flag and stays fully legacy until
 *   flag-collapse. W + M.
 * - `referral_invite_loop_v1` (ENG-1236) — the referral / invite-for-Pro
 *   growth loop card in the household invite surfaces. MOVED to DEFAULT-OFF
 *   2026-07-12 (ENG-1541): the card + landing page (`ReferralRewardCard`,
 *   `app/g/[code]/ReferralLandingClient`) publicly PROMISE "30 days of Pro"
 *   for a referral, but no entitlement-grant path exists yet (needs a
 *   purchase rail). Shipping it on made an unkeepable promise. Keep OFF
 *   until the grant is wired; off → the referral card is hidden and the
 *   existing household invite flow is unchanged. Web + mobile.
 * - `progress_hierarchy_v1` (ENG-1525) — the Progress tab 5-section
 *   hierarchy rebuild (Trajectory hero → This Week → Energy → Body
 *   composition → Your Week) replacing the legacy 13-card stack.
 *   DEFAULT-OFF: a full-surface structural change (the energy_numbers_v1
 *   precedent, not the "always flag on" additive-card one) — Grace ramps
 *   in PostHog with before/after screenshots. Off → the legacy 13-card
 *   stack renders exactly as before (kill switch). Both hosts read the
 *   flag ONCE on mount into state so the layout never flips mid-session.
 *   Keep in sync with `src/lib/analytics/track.ts`. Web + mobile.
 *
 * Moved to `REDESIGN_DEFAULT_ON` (default-ON) — see their entries there:
 * `expenditure_trend_card` (ENG-953); the "always flag on" batch (ENG-1279,
 * 2026-06-30): `progress_plateau_insight_v1` (ENG-954), `weigh_in_reminder_v1`
 * (ENG-955), `portion_fit_hint_v1` (ENG-854); and `import_magic_moment`
 * (ENG-728) + `paywall_trajectory_chart_v1` (ENG-969).
 */
export const KNOWN_DEFAULT_OFF_FLAGS = [
  "logsheet_ai_method_tooltip",
  "progress_milestone_celebration_v1",
  "onboarding_progressive_text",
  "onboarding-why-now",
  "trial_end_reminder_v1", // ENG-968 — Duolingo-style trial-end reminder day picker
  "recipe_yield_portion_v1", // ENG-736 — structured recipe yield + portion-style logging
  "paywall_fallback_when_unavailable", // ENG-1381 — priced fallback for RC-unavailable paywall
  "kcal_trust_qualifier_v1", // ENG-1417 — "~" qualifier on unverified kcal, decision surfaces only
  "discover_verified_filter_v1", // ENG-1417 — Discover "Verified only" filter chip (web-only in practice)
  "energy_numbers_v1", // ENG-1506/1507 — canonical energy numbers (selectMaintenance input policy + qualifiers)
  "referral_invite_loop_v1", // ENG-1541 — OFF until Pro-days entitlement grant is wired (unkeepable promise)
  "mobile_preauth_reveal_v1", // ENG-1513 — fresh installs run onboarding+reveal BEFORE the auth wall (match web/ENG-962). OFF → legacy auth-first gate.
  "progress_hierarchy_v1", // ENG-1525 — Progress 5-section hierarchy; else = legacy 13-card stack (kill switch). Keep in sync with src/lib/analytics/track.ts.
] as const;

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
      (
        c as { getFeatureFlagPayload?: (f: string) => unknown }
      ).getFeatureFlagPayload?.(flag) ?? null
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

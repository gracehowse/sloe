/**
 * Cook handsfree mode (mobile) — preference + keyword routing helpers.
 *
 * Background: Paprika ships a true "handsfree cook" mode that listens
 * for "next" / "previous" / "repeat" / "pause" / "resume" keywords so
 * dirty hands never have to touch the screen. The competitor audit
 * (gap #7) flagged this as a P2-with-high-delight — Suppr's cook mode
 * already keeps the screen awake via `useKeepAwake()` but does not
 * listen for keywords.
 *
 * v1 (initial release) shipped the SHELL of the feature only:
 *   1. A persisted opt-in preference (off by default).
 *   2. A pure keyword-match helper that maps a transcript fragment
 *      to one of the canonical handsfree commands.
 *
 * v2 (this file, 2026-05-02) wires the real on-device speech
 * recognition path behind the `COOK_HANDSFREE_FEATURE_ENABLED` flag.
 * The flag stays DARK at merge time — the v1 banner copy still ships
 * to flag-off users and the v2 listener / consent flow / age gate are
 * inert until Grace flips the flag after review.
 *
 * Architecture: see `docs/decisions/2026-05-01-cook-voice-handsfree.md`.
 *   - Option A (on-device via `expo-speech-recognition`,
 *     `requiresOnDeviceRecognition: true`).
 *   - Zero-retention: no audio is persisted, no transcript leaves
 *     RAM, no network call.
 *   - English-only at launch.
 *   - Web parity intentionally deferred — browser SpeechRecognition
 *     routes audio to Google Cloud, which would break the privacy
 *     claim this implementation rests on.
 *
 * Storage keys (AsyncStorage, all local-only):
 *   - `suppr.cook.handsfree.enabled`         — v1 opt-in pref ("0"/"1").
 *   - `suppr.cook.handsfree.consent_v1`      — v2 explainer-sheet ack.
 *   - `suppr.cook.handsfree.hint_seen`       — v2 in-cook listening
 *                                              banner one-shot.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage key for the per-device opt-in. */
export const COOK_HANDSFREE_ENABLED_KEY = "suppr.cook.handsfree.enabled";

/** AsyncStorage key for the v2 consent/explainer-sheet acknowledgement.
 *  Written after the user taps "Turn on voice control" in the
 *  pre-permission explainer sheet. Once set to "1", the sheet never
 *  re-shows on this device — the iOS mic permission prompt is the
 *  remaining gate. */
export const COOK_HANDSFREE_CONSENT_KEY = "suppr.cook.handsfree.consent_v1";

/** AsyncStorage key for the v2 in-cook "Listening — say next, back…"
 *  hint. Written to "1" after the user has dismissed the hint once,
 *  so subsequent cook sessions don't pile up redundant transparency
 *  banners. */
export const COOK_HANDSFREE_HINT_SEEN_KEY = "suppr.cook.handsfree.hint_seen";

/**
 * Master feature flag for the v2 on-device handsfree implementation.
 * STAYS `false` at merge time — flipping it is a separate action gated
 * on Grace's design + legal sign-off after the PR lands. While `false`
 * the cook screen renders the v1 transparency banner ("We don't record
 * audio yet.") unchanged; while `true` the v2 path lights up
 * (consent sheet, age gate, real listener, listening hint).
 *
 * Why a constant and not a server-controlled flag: this is a privacy-
 * sensitive surface that requires a deliberate code review every time
 * its state changes. A boolean here makes the flip auditable in git
 * history, not in a remote config dashboard. Per
 * `docs/decisions/2026-05-01-cook-voice-handsfree.md`.
 */
export const COOK_HANDSFREE_FEATURE_ENABLED = false;

/** Minimum age (years) at which voice control is available. The value
 *  is the legal-reviewer recommendation (P0 from the 2026-05-02 review)
 *  for an English-only kitchen-voice surface; aligns with iOS Speech
 *  framework consent posture and the COPPA-adjacent risk model for
 *  audio capture. */
export const COOK_HANDSFREE_MIN_AGE = 16;

/** Canonical command set the listener will eventually emit. */
export type HandsfreeCommand =
  | "next"
  | "previous"
  | "repeat"
  | "pause"
  | "resume";

/**
 * Map a recognised transcript fragment to a handsfree command.
 *
 * Matching is intentionally generous — kitchen acoustics are noisy and
 * single-word triggers misfire on regular speech ("a next time" → false
 * positive on "next"). v1 strategy:
 *   - Trim + lowercase.
 *   - Match the WHOLE utterance, not a substring. The listener feeds
 *     short snippets (~5s) so the user is mid-utterance, not mid-cook-
 *     conversation. False positives during background chat are the
 *     dominant failure mode — keep the bar high.
 *   - Accept the canonical command word and the most common natural-
 *     speech variants.
 *   - Returns null on no match — the listener should ignore the snippet
 *     and keep listening.
 *
 * Order of synonyms matters because some are subsequences of others
 * ("next step" contains "next"); we test the longer form first.
 */
export function matchHandsfreeCommand(
  transcript: string,
): HandsfreeCommand | null {
  const t = transcript.trim().toLowerCase();
  if (!t) return null;

  // Two-word synonyms first — these are unambiguous and the user is
  // explicitly addressing the app.
  if (t === "next step" || t === "go next" || t === "step next") return "next";
  if (
    t === "previous step" ||
    t === "go back" ||
    t === "step back" ||
    t === "back step"
  )
    return "previous";

  // Single-word triggers. We accept these only as the WHOLE utterance
  // — `t === "next"` not `t.includes("next")` — so background chatter
  // like "next time we cook this" doesn't advance the step.
  if (t === "next" || t === "forward") return "next";
  if (t === "previous" || t === "back") return "previous";
  if (t === "repeat" || t === "again" || t === "say it again")
    return "repeat";
  if (t === "pause" || t === "hold" || t === "stop") return "pause";
  if (t === "resume" || t === "continue" || t === "go" || t === "play")
    return "resume";

  return null;
}

/** Read the opt-in flag from AsyncStorage. Defaults to OFF. */
export async function readHandsfreeEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COOK_HANDSFREE_ENABLED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

/** Persist the opt-in flag. Failures are swallowed — UX is non-fatal. */
export async function writeHandsfreeEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      COOK_HANDSFREE_ENABLED_KEY,
      enabled ? "1" : "0",
    );
  } catch {
    /* storage flaky — fail closed */
  }
}

/** Has the user acknowledged the pre-permission explainer sheet?
 *  Determines whether the next "toggle ON" action shows the sheet
 *  (returns false) or skips straight to the iOS mic prompt
 *  (returns true). Failures default to false (re-show — safer for
 *  privacy: better to over-explain than to under-explain). */
export async function readHandsfreeConsent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COOK_HANDSFREE_CONSENT_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

/** Persist the explainer-sheet acknowledgement. Called once, after the
 *  user taps "Turn on voice control" in
 *  `CookHandsfreeConsentSheet.tsx`. */
export async function writeHandsfreeConsent(): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_HANDSFREE_CONSENT_KEY, "1");
  } catch {
    /* storage flaky — sheet will re-show next time, which is the
     * privacy-safe failure mode (over-explain rather than under-). */
  }
}

/** Has the in-cook "Listening — say next, back…" hint been
 *  dismissed before? Used to render the hint as a one-shot banner
 *  per device. Failures default to false → show the hint (safer
 *  for transparency). */
export async function readHandsfreeHintSeen(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COOK_HANDSFREE_HINT_SEEN_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

/** Persist the listening-hint dismissal. Called when the user
 *  dismisses the hint or the cook session ends successfully. */
export async function writeHandsfreeHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_HANDSFREE_HINT_SEEN_KEY, "1");
  } catch {
    /* storage flaky — hint will re-show, mildly annoying but not
     * a privacy issue. */
  }
}

/**
 * Resolve whether the handsfree toggle is permitted for a given user
 * age. Pure function — no I/O, no React. Used by both the cook screen
 * and the unit test that pins the legal age-gate behaviour.
 *
 * Decision matrix (legal review 2026-05-02):
 *   - Age unknown / null / undefined → BLOCK. We err on the side of
 *     not capturing audio from minors. The toggle renders disabled
 *     with an explanatory tooltip.
 *   - Age < 16 → BLOCK with the same disabled-state UX.
 *   - Age >= 16 → ALLOW. The toggle is interactive and proceeds to
 *     the consent sheet on first tap.
 *
 * This is a **gate**, not the only gate — even after this returns
 * `"allowed"`, `supportsOnDeviceRecognition()` and the iOS mic
 * permission prompt still apply.
 */
export type AgeGateResult = "allowed" | "blocked_too_young" | "blocked_unknown";

export function resolveHandsfreeAgeGate(
  age: number | null | undefined,
): AgeGateResult {
  if (age === null || age === undefined || !Number.isFinite(age)) {
    return "blocked_unknown";
  }
  if (age < COOK_HANDSFREE_MIN_AGE) return "blocked_too_young";
  return "allowed";
}

/**
 * Map an age-gate result to the disabled-state tooltip copy.
 * Centralised here so the cook screen, the consent sheet, and the
 * test all read from the same source of truth.
 */
export function ageGateTooltip(result: AgeGateResult): string | null {
  switch (result) {
    case "allowed":
      return null;
    case "blocked_too_young":
    case "blocked_unknown":
      // Same copy for both — we don't tell the unknown-age user "we
      // don't know how old you are", because that's information they
      // can't act on without finishing onboarding.
      return "Voice control is available for users 16 and older.";
  }
}

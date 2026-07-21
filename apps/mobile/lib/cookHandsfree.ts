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
 * v1 (this file) ships the SHELL of the feature only:
 *   1. A persisted opt-in preference (off by default) — privacy
 *      non-negotiable for any audio-capture surface.
 *   2. A pure keyword-match helper that maps a transcript fragment
 *      to one of the canonical handsfree commands. Useful now for
 *      tests, ready to drop into a real listener later.
 *
 * v2 (deferred, no target date) will add the real audio capture path.
 * This file's API is the seam the listener will plug into so the cook
 * screen never grows a direct dep on the recognition backend. (A
 * decision doc for this shell-now/listener-later split was intended
 * but never made it into the repo — see
 * `docs/journeys/discover-and-library.md`'s Cook-mode section for the
 * open question this leaves: whether the approach is still right, or
 * the dark toggle should come out until v2 is properly scoped.)
 *
 * Storage: a single AsyncStorage key `suppr.cook.handsfree.enabled` with
 * the value `"1"` or `"0"`. Local-only by design — pushing this into
 * Supabase before voice actually ships would create a column with no
 * read site, and a wasted migration. When v2 ships, mirror to a real
 * `voice_handsfree_enabled` column on `profiles`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage key for the per-device opt-in. */
export const COOK_HANDSFREE_ENABLED_KEY = "suppr.cook.handsfree.enabled";

/**
 * Feature flag — gates whether the in-cook header toggle renders at
 * all. Defaults to **OFF** because v1 ships the SHELL only; the audio
 * listener itself is queued for v2 (no decision doc — see the file
 * header). Shipping the toggle dark avoids the journey-architect
 * concern that users will tap it, see no microphone behaviour, and
 * conclude the app is broken.
 *
 * Opt-in via `EXPO_PUBLIC_COOK_HANDSFREE_ENABLED=true`. The flag is
 * read once at module load — flipping it requires a JS reload (or
 * an OTA update), which is the point: this is a kill-switch for the
 * v1 shell, not a per-user toggle. The per-user toggle is the
 * AsyncStorage-backed `readHandsfreeEnabled()` below, which already
 * defaults to OFF.
 *
 * When v2 lights up the listener, flip the default to `true` here
 * and remove this guard at the same commit (the persisted
 * AsyncStorage pref then becomes the user-facing on/off).
 */
export const COOK_HANDSFREE_FEATURE_ENABLED: boolean =
  process.env.EXPO_PUBLIC_COOK_HANDSFREE_ENABLED === "true";

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

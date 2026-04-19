/**
 * "What's new" auto-surface gate (mobile).
 *
 * Spec: on the first launch after an app build-number bump, show the
 * What's new screen once, then record the current build number in
 * AsyncStorage so we don't re-show on every subsequent launch.
 *
 * Why a build number (not an app version string):
 *   - Multiple TestFlight builds can ship under the same `expoConfig.version`
 *     (e.g. 1.0.0 #10 and 1.0.0 #11 are both "1.0.0"). Storing only the
 *     version would mean 1.0.0 #11 never re-surfaces for users already on
 *     1.0.0 #10.
 *   - `expoConfig.ios.buildNumber` / `expoConfig.android.versionCode` are
 *     monotonically incremented on every release, so numeric comparison
 *     is the right test.
 *
 * Failure mode: a failed AsyncStorage read must NOT block app launch or
 * force the screen. Callers treat `false` as the safe default. Any
 * error is swallowed; we neither auto-show nor mark-seen so the gate
 * can self-heal on the next launch if storage recovers.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Canonical storage key. Versioned so a future schema change can
 *  re-prompt without a user-visible upgrade step. */
export const WHATS_NEW_STORAGE_KEY = "whats_new_last_seen_build_v1";

type StorageLike = Pick<typeof AsyncStorage, "getItem" | "setItem">;

/**
 * Parse a stored build-number value. Accepts numeric strings only.
 * Returns `null` for missing / corrupt values so callers can treat
 * "no prior record" the same as "never seen".
 */
function parseStoredBuild(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 0) return null;
  return n;
}

/**
 * Returns true when the screen should be auto-surfaced on this
 * launch.
 *
 * Rules:
 *   - `currentBuild <= 0` or not a finite integer → `false` (we
 *     cannot reliably compare).
 *   - Storage read throws → `false` (fail closed; don't interrupt
 *     launch). The gate will retry on the next cold start.
 *   - No stored value → `true` (first launch, or first launch after
 *     a clean install). The caller must persist the current build
 *     via `markWhatsNewSeen` after navigation.
 *   - Stored < current → `true` (build-number bump).
 *   - Stored >= current → `false` (already seen this build, or a
 *     downgrade — never show on a downgrade).
 */
export async function shouldAutoShowWhatsNew(
  currentBuild: number,
  storage: StorageLike = AsyncStorage,
): Promise<boolean> {
  if (!Number.isFinite(currentBuild) || !Number.isInteger(currentBuild) || currentBuild <= 0) {
    return false;
  }
  try {
    const raw = await storage.getItem(WHATS_NEW_STORAGE_KEY);
    const last = parseStoredBuild(raw);
    if (last == null) return true;
    return currentBuild > last;
  } catch {
    // Swallow — a failed storage read must not block launch.
    return false;
  }
}

/**
 * Persist the current build as "seen". Called after the auto-surface
 * has navigated. Errors are swallowed so a storage write failure
 * doesn't surface as a user-facing error; the worst-case consequence
 * is the screen re-appears next launch, which is preferable to
 * hiding it permanently.
 */
export async function markWhatsNewSeen(
  currentBuild: number,
  storage: StorageLike = AsyncStorage,
): Promise<void> {
  if (!Number.isFinite(currentBuild) || !Number.isInteger(currentBuild) || currentBuild <= 0) {
    return;
  }
  try {
    await storage.setItem(WHATS_NEW_STORAGE_KEY, String(currentBuild));
  } catch {
    // Swallow — see docstring.
  }
}

/**
 * Resolve the current build number from expo-constants. iOS exposes
 * it at `expoConfig.ios.buildNumber` (string), Android at
 * `expoConfig.android.versionCode` (number). Returns `null` when we
 * cannot read a valid integer so the caller falls back to "don't
 * auto-show" rather than guessing.
 */
export function resolveCurrentBuildNumber(expoConfig: unknown): number | null {
  if (!expoConfig || typeof expoConfig !== "object") return null;
  const cfg = expoConfig as {
    ios?: { buildNumber?: unknown };
    android?: { versionCode?: unknown };
  };
  const ios = cfg.ios?.buildNumber;
  if (typeof ios === "string" && ios.trim().length > 0) {
    const n = Number(ios.trim());
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return n;
  }
  if (typeof ios === "number" && Number.isFinite(ios) && Number.isInteger(ios) && ios > 0) {
    return ios;
  }
  const android = cfg.android?.versionCode;
  if (typeof android === "number" && Number.isFinite(android) && Number.isInteger(android) && android > 0) {
    return android;
  }
  if (typeof android === "string" && android.trim().length > 0) {
    const n = Number(android.trim());
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

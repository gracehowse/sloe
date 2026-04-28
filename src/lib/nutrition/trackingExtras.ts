/**
 * Tracking-extras opt-in preferences (Phase 2 / B1.4, 2026-04-27).
 *
 * Authority — D-2026-04-27-08:
 *   "Caffeine + alcohol removed from Today; behind Settings opt-in,
 *    default off. Hydration stays — it's a near-universal target."
 *
 * Rationale:
 *   "Macro tracker's job is macros. Caffeine and alcohol bloat the
 *    daily card and are feature creep dressed as wellness."
 *
 * The toggles are stored client-side under a stable AsyncStorage /
 * localStorage key. We deliberately do NOT add columns to the
 * `profiles` table for Phase 2 because (a) the toggle is purely a
 * presentation choice (data is already captured if logged), and
 * (b) avoiding a schema change keeps Phase 2 reversible. Phase 4
 * settings consolidation can promote these to server-side prefs if
 * cross-device sync becomes important.
 *
 * Defaults: BOTH OFF. Users explicitly opt in via "Tracking extras"
 * in Settings (You tab → Settings sub-route).
 *
 * Existing data is preserved (no schema change). When `trackCaffeine`
 * is `false`, the caffeine row is hidden but `extra_caffeine_by_day`
 * remains in the database. Re-enabling the toggle surfaces the data
 * unchanged.
 */

export const TRACKING_EXTRAS_STORAGE_KEY = "suppr.tracking-extras.v1";

export interface TrackingExtras {
  /** Whether the user has opted in to caffeine tracking on Today. */
  trackCaffeine: boolean;
  /** Whether the user has opted in to alcohol tracking on Today. */
  trackAlcohol: boolean;
}

export const DEFAULT_TRACKING_EXTRAS: TrackingExtras = {
  trackCaffeine: false,
  trackAlcohol: false,
};

/**
 * Parses a stored JSON blob into a `TrackingExtras` object. Falls back
 * to defaults on any malformed input — we never throw because the
 * setting is purely presentational.
 */
export function parseTrackingExtras(raw: string | null | undefined): TrackingExtras {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_TRACKING_EXTRAS };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_TRACKING_EXTRAS };
    const obj = parsed as Record<string, unknown>;
    const trackCaffeine = typeof obj.trackCaffeine === "boolean" ? obj.trackCaffeine : DEFAULT_TRACKING_EXTRAS.trackCaffeine;
    const trackAlcohol = typeof obj.trackAlcohol === "boolean" ? obj.trackAlcohol : DEFAULT_TRACKING_EXTRAS.trackAlcohol;
    return { trackCaffeine, trackAlcohol };
  } catch {
    return { ...DEFAULT_TRACKING_EXTRAS };
  }
}

/** Serialises a `TrackingExtras` object to a stable JSON string. */
export function serializeTrackingExtras(extras: TrackingExtras): string {
  return JSON.stringify({
    trackCaffeine: !!extras.trackCaffeine,
    trackAlcohol: !!extras.trackAlcohol,
  });
}

/**
 * Returns whether the hydration / stimulants card on Today should
 * render at all.
 *
 * Phase 2 / B1.4 rule: hydration is a near-universal target so the
 * card surfaces whenever water target > 0 OR water has been logged.
 * Caffeine + alcohol gate independently on their respective opt-in
 * toggles — even if `extra_caffeine_by_day` has data, the row is
 * hidden when `trackCaffeine` is false.
 *
 * The card itself is shown if EITHER:
 *   - the hydration sub-rule is true (water target / water logs), OR
 *   - the user has opted in to caffeine AND has logged caffeine, OR
 *   - the user has opted in to alcohol AND has logged alcohol.
 *
 * The intent: a fresh user with both extras off and no water target
 * sees no card. A long-time user with hydration but no extras-opt-in
 * sees only the hydration row. Opting back in restores the cached
 * data on the corresponding row without any backend call.
 */
export function shouldRenderHydrationCard(input: {
  hydrationGateOpen: boolean;
  trackCaffeine: boolean;
  trackAlcohol: boolean;
  hasCaffeineLogs: boolean;
  hasAlcoholLogs: boolean;
}): boolean {
  if (input.hydrationGateOpen) return true;
  if (input.trackCaffeine && input.hasCaffeineLogs) return true;
  if (input.trackAlcohol && input.hasAlcoholLogs) return true;
  return false;
}

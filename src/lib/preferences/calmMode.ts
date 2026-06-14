/**
 * Shared types + constants for "Calm mode" — the body-neutral display
 * preference that quiets numeric nudges (ENG-1098).
 *
 * v1 gates the per-slot "Aim ~X kcal" lines on empty meal slots (Today + Plan,
 * ENG-1092). The preference is named for the umbrella, not the one thing it
 * does today: when the diversity-inclusion body-surface work lands (hide-weight
 * DI-P0-03, streak toggle DI-P1-01), those become additional toggles under the
 * same "Calm mode" Settings section — no row moves, no rename. (product-lead
 * call 2026-06-14: name the container, don't furnish it yet.)
 *
 * Persistence (mirrors `macroDisplayStyle` — client-side, no DB migration):
 *   - Web: `localStorage["suppr.prefs.calm_mode"]`
 *     (see `src/lib/preferences/useCalmMode.ts` for the React hook)
 *   - Mobile: AsyncStorage `"suppr.prefs.calm_mode"`
 *     (see `apps/mobile/lib/calmMode.ts`)
 * Both platforms use the same key + the same `false` fallback so the value
 * reads identically across surfaces when cross-device sync lands.
 */

export const CALM_MODE_STORAGE_KEY = "suppr.prefs.calm_mode";

/** Off by default — the aims show unless the user opts into quiet. */
export const DEFAULT_CALM_MODE = false;

/**
 * Coerce an unknown value (from localStorage / AsyncStorage / DB) to a boolean.
 * Storage holds the stringified boolean; accept the native boolean too so a
 * future DB-backed value reads the same.
 */
export function resolveCalmMode(raw: unknown): boolean {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return DEFAULT_CALM_MODE;
}

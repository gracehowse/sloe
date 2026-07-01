/**
 * ENG-713 — "Trend-only" weight display preference (ED + dysphoria dignity).
 *
 * A body-neutral, client-side display preference that lets a user turn OFF the
 * numeric weight chart + every raw weight figure on the Progress tab, leaving a
 * calm qualitative direction ("holding steady", "trending down gently",
 * "trending up gently") and a de-numbered sparkline in their place.
 *
 * Why this file exists (and why NOT a new DB column):
 *   The umbrella "Calm mode" pref (ENG-1098) was explicitly named for a
 *   container so the "hide-weight" toggle (diversity-inclusion DI-P0-03) could
 *   fold in later without a rename (product-lead 2026-06-14). This is that
 *   toggle. It mirrors `calmMode` / `macroDisplayStyle` exactly: a device-local
 *   display preference, no `profiles` column, no migration.
 *
 *   A separate DB-backed `profiles.weight_surface_mode` (T13) already exists and
 *   stays untouched — that's an orthogonal, server-synced control. When the
 *   trend-only pref is ON, the Progress screens compute an EFFECTIVE surface
 *   mode of `trends_only` and reuse the exact rendering path T13 already ships
 *   (chart hidden, direction card shown), so we don't fork a competing render.
 *
 * Persistence (mirrors `calmMode` — client-side, no DB migration):
 *   - Web: `localStorage["suppr.prefs.trend_only_weight"]`
 *     (see `src/lib/preferences/useTrendOnlyWeight.ts` for the React hook)
 *   - Mobile: AsyncStorage `"suppr.prefs.trend_only_weight"`
 *     (see `apps/mobile/lib/trendOnlyWeight.ts`)
 * Both platforms use the same key + the same `false` fallback so the value
 * reads identically across surfaces when cross-device sync lands.
 *
 * COPY OWNERSHIP: the neutral direction strings below are dignity-sensitive.
 * They MUST be signed off by `diversity-inclusion` + `legal-reviewer` before the
 * `progress_trend_only_v1` flag ramps beyond the solo tester (see the decision
 * doc `docs/decisions/2026-07-01-trend-only-weight-mode.md`).
 */

export const TREND_ONLY_WEIGHT_STORAGE_KEY = "suppr.prefs.trend_only_weight";

/** Off by default — the feature is opt-in. The flag controls whether the
 *  Settings toggle EXISTS; this default controls whether it's ON when it does.
 *  Off → today's behaviour exactly (kill switch). */
export const DEFAULT_TREND_ONLY_WEIGHT = false;

/**
 * Coerce an unknown value (from localStorage / AsyncStorage / a future synced
 * value) to a boolean. Storage holds the stringified boolean; accept the native
 * boolean too so a DB-backed value would read the same.
 */
export function resolveTrendOnlyWeight(raw: unknown): boolean {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return DEFAULT_TREND_ONLY_WEIGHT;
}

/**
 * Neutral trend directions. `null` means "no direction to state" (not enough
 * data / no weigh-in) — renderers surface a calm prompt rather than inventing a
 * "steady".
 */
export type TrendOnlyDirection = "down" | "up" | "steady";

/**
 * Same "stable" band as the T13 policy + the Digest headline (0.3 kg): below
 * this in absolute terms the week reads as steady rather than up/down. Kept in
 * one place so the trend-only copy can't disagree with the T13 `trends_only`
 * threshold.
 */
export const TREND_ONLY_STABLE_KG = 0.3;

/** Map a weekly delta (kg) to a neutral direction, or `null` when absent. */
export function trendOnlyDirection(
  deltaKg: number | null | undefined,
): TrendOnlyDirection | null {
  if (deltaKg == null || !Number.isFinite(deltaKg)) return null;
  if (Math.abs(deltaKg) < TREND_ONLY_STABLE_KG) return "steady";
  return deltaKg < 0 ? "down" : "up";
}

/**
 * Body-neutral copy for the trend-only card. The crux of ENG-713.
 *
 * Rules the strings hold to (per the ticket + the repo's diversity-inclusion
 * posture — `docs/product/diversity-inclusion.md`):
 *   - never a number, never a goal-gap figure, never a unit (kg/lb)
 *   - no valence: no "great", no "on track", no congratulation for a direction
 *   - direction stated as gentle continuous motion, not an achievement
 *   - "steady" is neutral, not praised ("stable" reads clinical; "holding
 *     steady" reads calm and human)
 *   - the empty case invites, it doesn't instruct or shame
 *
 * `describeTrendOnly` returns ONLY the phrase; the eyebrow ("Weight trend") and
 * the mode note live in the card component so both platforms share this text.
 */
export function describeTrendOnly(direction: TrendOnlyDirection | null): string {
  switch (direction) {
    case "down":
      return "Trending down gently";
    case "up":
      return "Trending up gently";
    case "steady":
      return "Holding steady";
    default:
      // No weigh-in yet — invite, don't instruct. No "you must", no "start".
      return "Add a weigh-in to see your trend";
  }
}

/** The always-present mode note under the phrase. Neutral, and points at the
 *  exit so the choice never feels like a trap. */
export const TREND_ONLY_MODE_NOTE =
  "Showing direction only. Turn numbers back on any time in Settings.";

/**
 * The one place both Progress screens agree on how the client-side trend-only
 * pref composes with the DB-backed T13 `weight_surface_mode`. Kept as a pure
 * helper so the (pinned, line-budgeted) Progress hosts stay thin and the two
 * platforms can't drift.
 *
 * The pref only ESCALATES a `show` surface toward `trends_only` — it never
 * overrides a user's DB `hide`/`trends_only` back to numbers. When the flag is
 * off (`toggleAvailable === false`) or the pref is off, the DB mode is returned
 * unchanged (kill switch → today's behaviour exactly).
 */
export function resolveEffectiveWeightSurfaceMode<
  T extends "show" | "hide" | "trends_only",
>(dbMode: T, prefOn: boolean, toggleAvailable: boolean): T | "trends_only" {
  return toggleAvailable && prefOn && dbMode === "show" ? "trends_only" : dbMode;
}

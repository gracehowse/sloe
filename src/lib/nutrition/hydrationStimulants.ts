/**
 * Hydration + stimulants (caffeine / alcohol) shared helpers.
 *
 * Pure: no React, no Supabase, no network. Imported by both the web
 * `HydrationStimulantsCard` + `AppDataContext`, and the mobile
 * `HydrationStimulantsCard` + `(tabs)/index.tsx`, so the two platforms
 * cannot drift on preset amounts, week-sum semantics, or defensive summing.
 *
 * Design notes:
 *   - All amounts are positive integers; negatives are clamped to 0 (defensive —
 *     mobile storage occasionally races with local state and can briefly hold
 *     a negative delta during undo).
 *   - Alcohol is tracked in **grams of ethanol**, not "units" or volumes.
 *     One UK unit ≈ 8 g, one US "standard drink" ≈ 14 g. We default the
 *     weekly target to 0 (hidden) and let the user opt-in via Settings.
 *   - Week-rolling alcohol sum respects the user's `week_start_day` profile
 *     preference so Monday-start and Sunday-start users see the same number
 *     Suppr-wide.
 */

/** Daily totals for the hydration + stimulants card. */
export type HydrationTotals = {
  waterMl: number;
  caffeineMg: number;
  alcoholG: number;
};

/**
 * User-set targets. `alcoholGWeekly === 0` means "no target, hide the row".
 * Water target is daily, caffeine target is daily, alcohol is weekly.
 */
export type StimulantTargets = {
  waterMl: number;
  caffeineMg: number;
  alcoholGWeekly: number;
};

/**
 * Sum water contributed by logged meals for a single day. Defensive:
 *   - `undefined` / `null` → 0
 *   - negative values → 0 (never subtract from intake)
 *   - returns an integer
 */
export function sumWaterFromMeals<M extends { waterMl?: number | null }>(
  meals: readonly M[] | null | undefined,
): number {
  if (!meals || meals.length === 0) return 0;
  let total = 0;
  for (const m of meals) {
    const raw = m?.waterMl;
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    total += n;
  }
  return Math.round(total);
}

/** Water quick-add presets in millilitres. */
export const WATER_QUICK_ADDS_ML = [100, 250, 500, 750] as const;

/**
 * Caffeine quick-add presets in milligrams.
 * Values are reasonable UK/EU averages, rounded to the nearest integer.
 *   - Espresso 30 ml ≈ 64 mg
 *   - Coffee (shop, 240 ml / 8 oz) ≈ 95 mg
 *   - Filter coffee (large mug, ~350 ml) ≈ 120 mg
 *   - Black tea 240 ml ≈ 48 mg
 *   - Green tea 240 ml ≈ 28 mg
 *   - Energy drink 250 ml ≈ 80 mg
 *   - Cola 330 ml ≈ 34 mg
 */
export const CAFFEINE_QUICK_ADDS: ReadonlyArray<{ label: string; mg: number }> = [
  { label: "Espresso", mg: 64 },
  { label: "Coffee", mg: 95 },
  { label: "Filter coffee", mg: 120 },
  { label: "Black tea", mg: 48 },
  { label: "Green tea", mg: 28 },
  { label: "Energy drink", mg: 80 },
  { label: "Cola", mg: 34 },
] as const;

/**
 * Alcohol quick-add presets in grams of ethanol.
 *   - Beer 5% ABV, 500 ml ≈ 16 g
 *   - Wine 12% ABV, 150 ml ≈ 14 g
 *   - Spirit 40% ABV, 44 ml (single) ≈ 14 g
 *   - Cider 4.5% ABV, 330 ml ≈ 12 g
 * (1 UK unit ≈ 8 g ethanol; 1 US standard drink ≈ 14 g.)
 */
export const ALCOHOL_QUICK_ADDS: ReadonlyArray<{ label: string; grams: number }> = [
  { label: "Beer 500ml", grams: 16 },
  { label: "Wine 150ml", grams: 14 },
  { label: "Spirit 44ml", grams: 14 },
  { label: "Cider 330ml", grams: 12 },
] as const;

/** FDA guidance for healthy adults (milligrams of caffeine per day). */
export const DEFAULT_CAFFEINE_TARGET_MG = 400;

/** Alcohol default is 0 → row is hidden until the user opts in. */
export const DEFAULT_ALCOHOL_WEEKLY_TARGET_G = 0;

/** Positive non-NaN coercion. Returns 0 for anything else. */
function clampPositive(n: unknown): number {
  if (typeof n !== "number") {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return 0;
    return x;
  }
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Valid `YYYY-MM-DD` that round-trips through a real local Date?
 * Rejects shape-valid but impossible keys like "2026-13-99".
 */
function isDateKey(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return false;
  return formatDateKey(dt) === s;
}

/**
 * Parse a date-key into a local Date anchored at noon (DST-safe).
 * Returns `null` for invalid keys.
 */
function parseAtNoon(key: string): Date | null {
  if (!isDateKey(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/**
 * Return the seven `YYYY-MM-DD` keys for the calendar week containing
 * `anchorDateKey`, ordered from week-start to week-end.
 *
 * `weekStartDay === "monday"` → Monday–Sunday.
 * `weekStartDay === "sunday"` → Sunday–Saturday.
 */
export function weekKeysForAnchor(
  anchorDateKey: string,
  weekStartDay: "monday" | "sunday",
): string[] {
  const anchor = parseAtNoon(anchorDateKey);
  if (!anchor) return [];
  const anchorDow = anchor.getDay(); // 0=Sun..6=Sat
  const offset =
    weekStartDay === "monday"
      ? (anchorDow + 6) % 7 // Mon=0, Tue=1, …, Sun=6
      : anchorDow; // Sun=0, Mon=1, …, Sat=6
  const start = new Date(anchor);
  start.setDate(start.getDate() - offset);
  const out: string[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    out.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Sum alcohol grams across the seven days of the calendar week
 * containing `anchorDateKey`, respecting the profile's week-start day.
 *
 * Missing days count as 0 (never throws); non-numeric map values are
 * clamped to 0. Returns an integer sum rounded to the nearest gram.
 */
export function weeklyAlcoholG(
  extraByDay: Record<string, number> | null | undefined,
  anchorDateKey: string,
  weekStartDay: "monday" | "sunday",
): number {
  if (!extraByDay || typeof extraByDay !== "object") return 0;
  const keys = weekKeysForAnchor(anchorDateKey, weekStartDay);
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) {
    total += clampPositive(extraByDay[k]);
  }
  return Math.round(total);
}

/**
 * Normalise an unknown JSON value into a clean `{dayKey: number}` map.
 * Non-date-key keys and non-positive values are dropped. Safe for
 * data coming back from Supabase JSONB columns that may contain
 * string-encoded numbers or stale keys.
 */
export function parseDayNumberMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDateKey(k)) continue;
    const n = clampPositive(v);
    if (n <= 0) continue;
    out[k] = Math.round(n);
  }
  return out;
}

/** Whether an over-target warning should show (factual, not shaming). */
export function isOverTarget(value: number, target: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  if (target <= 0) return false;
  return value > target;
}

/**
 * Weight-trend smoothing — the shared TrendWeight / Hacker's Diet model.
 *
 * Raw scale weight swings 1–2 kg/day on water + glycogen alone, so any
 * surface that judges "is the user on track / how fast are they moving"
 * off a **raw** two-point weigh-in delta is reading noise as signal. Every
 * trend app (MacroFactor, TrendWeight, Hacker's Diet) smooths first.
 *
 * ENG-1026 fixed this for the on-track tile (`weightTrendTile.ts`).
 * ENG-1039 fixes the SAME class for the goal-date timeline
 * (`calcGoalTimeline` in `weightProjection.ts`), which drives goal DATES
 * and overrides the projection. Both consume this one module so a single
 * water blip can no longer move either surface much — but they use
 * different exports because their needs differ:
 *
 *   - `smoothedTrendByDate` (EMA, the #3 gap-fill the audit cites):
 *     interpolate the weigh-ins to a daily series so a weekly weigher and
 *     a daily weigher get the same smoothing per unit time, then EMA at
 *     α=0.1 so each raw reading nudges the trend by ~10%. Used by the
 *     **on-track tile**, which only reads the trend's *direction* — EMA
 *     lag is harmless there.
 *   - `smoothedWeeklyRateKg` (least-squares slope): the **timeline** needs
 *     the *magnitude* of the rate to compute a date, where EMA lag would
 *     understate a short-window rate and push the date too far out. The
 *     least-squares best-fit line is unbiased (recovers the true rate) yet
 *     bounds a single endpoint spike's leverage to ~1/N.
 *
 * Pure: no React, no I/O, no `Date.now()`. React-Native-safe and
 * dependency-free so mobile imports it via
 * `@suppr/shared/nutrition/weightTrendSmoothing`.
 *
 * Pinned by `tests/unit/weightTrendSmoothing.test.ts`.
 */

/** EMA smoothing constant — the Hacker's Diet / TrendWeight standard. */
export const TREND_EMA_ALPHA = 0.1;

/**
 * Minimum weigh-ins before a *smoothed* trend is trustworthy. With only
 * two readings the latest IS the only new signal — there's no surrounding
 * context to tell a blip from a real move — so callers fall back to the
 * raw two-point delta below this floor. At ≥3 weigh-ins the window has
 * structure to smooth and a lone spike can't dominate. (Matches the
 * ENG-1026 on-track-tile gate exactly.)
 */
export const MIN_WEIGH_INS_FOR_SMOOTHING = 3;

function dayKeyToMs(key: string): number {
  return new Date(`${key}T12:00:00`).getTime();
}

/**
 * Smoothed trend value (kg) at each weigh-in's date.
 *
 * Fills the gaps between weigh-ins by linear interpolation to a daily
 * series, then runs an EMA (α=0.1) over that daily series. Returns a map
 * of the SAME date keys passed in (must be ascending) to their smoothed
 * trend value, so callers can read the trend at any two dates and
 * difference them.
 *
 * Interpolating to daily first (rather than EMA-ing per weigh-in) is what
 * makes the smoothing time-uniform.
 */
export function smoothedTrendByDate(
  ascendingEntries: Array<[string, number]>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (ascendingEntries.length === 0) return out;
  if (ascendingEntries.length === 1) {
    out.set(ascendingEntries[0][0], ascendingEntries[0][1]);
    return out;
  }

  // Build the gap-filled daily series across the full span.
  const firstMs = dayKeyToMs(ascendingEntries[0][0]);
  const daily: number[] = [];
  for (let i = 0; i < ascendingEntries.length - 1; i++) {
    const [kA, vA] = ascendingEntries[i];
    const [kB, vB] = ascendingEntries[i + 1];
    const msA = dayKeyToMs(kA);
    const msB = dayKeyToMs(kB);
    const gapDays = Math.max(1, Math.round((msB - msA) / 86_400_000));
    for (let d = 0; d < gapDays; d++) {
      const frac = d / gapDays;
      daily.push(vA + (vB - vA) * frac);
    }
  }
  // Append the final actual reading.
  const last = ascendingEntries[ascendingEntries.length - 1];
  daily.push(last[1]);

  // EMA over the daily series, seeded at the first daily value.
  const trend: number[] = [];
  let ema = daily[0];
  for (let i = 0; i < daily.length; i++) {
    ema = i === 0 ? daily[i] : ema + TREND_EMA_ALPHA * (daily[i] - ema);
    trend.push(ema);
  }

  // Map each ORIGINAL weigh-in date to its smoothed trend value (nearest
  // daily index — keys align because the daily grid starts at firstMs).
  for (const [k] of ascendingEntries) {
    const idx = Math.round((dayKeyToMs(k) - firstMs) / 86_400_000);
    const clamped = Math.max(0, Math.min(trend.length - 1, idx));
    out.set(k, trend[clamped]);
  }
  return out;
}

/**
 * Least-squares slope (kg/day) of a weigh-in series. x = days elapsed from
 * the first weigh-in, y = kg. Returns 0 for <2 points or an all-same-day
 * (degenerate-x) series. Mirrors `adaptiveTdee.ts`'s slope — the model
 * already trusted for the TDEE energy term — kept here so this module is
 * React-Native-safe + dependency-free and the timeline can share it.
 */
function leastSquaresSlopeKgPerDay(entries: Array<[string, number]>): number {
  if (entries.length < 2) return 0;
  const x0 = dayKeyToMs(entries[0][0]);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [k, y] of entries) {
    const x = (dayKeyToMs(k) - x0) / 86_400_000;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const n = entries.length;
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0; // every weigh-in on the same calendar day
  return (n * sxy - sx * sy) / denom;
}

/**
 * Signed smoothed weekly rate of change (kg/week) across an ascending
 * weigh-in series. Negative = losing, positive = gaining.
 *
 * Two different smoothing needs, two models — deliberately:
 *   - The **on-track tile** (`weightTrendTile.ts`) needs the *direction*
 *     of the trend, and uses the EMA-smoothed trend (`smoothedTrendByDate`)
 *     whose lag is fine because only the sign is read.
 *   - The **goal-date timeline** needs the *magnitude* of the rate to
 *     compute a date, so EMA lag (which understates a short-window rate
 *     and pushes the date too far out) is the wrong tool. Least-squares is
 *     the unbiased best-fit line: it recovers the true rate on a clean
 *     series AND bounds the leverage of a single endpoint water spike to
 *     ~1/N instead of letting it own the whole endpoint. This is the
 *     `adaptiveTdee.ts` model, reused for consistency with the TDEE
 *     engine.
 *
 * Behaviour:
 *   - **≥3 weigh-ins** (`MIN_WEIGH_INS_FOR_SMOOTHING`): least-squares slope
 *     ×7 → `smoothed: true`.
 *   - **2 weigh-ins**: no surrounding context to damp a blip — falls back
 *     to the raw two-point delta (the long-standing behaviour),
 *     `smoothed: false`.
 *   - **<2 / degenerate span**: rate 0.
 *
 * `daySpan` is floored at 1 to avoid a divide-by-zero when the two
 * fallback weigh-ins share a calendar day.
 *
 * Returns `{ weeklyRateKg, smoothed }` so the caller can report whether
 * the rate it used was the smoothed slope or the raw fallback.
 */
export function smoothedWeeklyRateKg(
  ascendingEntries: Array<[string, number]>,
): { weeklyRateKg: number; smoothed: boolean } {
  if (ascendingEntries.length < 2) return { weeklyRateKg: 0, smoothed: false };

  if (ascendingEntries.length >= MIN_WEIGH_INS_FOR_SMOOTHING) {
    const slopePerDay = leastSquaresSlopeKgPerDay(ascendingEntries);
    return { weeklyRateKg: slopePerDay * 7, smoothed: true };
  }

  // 2 weigh-ins (or a smoothing miss) → raw two-point delta.
  const firstKey = ascendingEntries[0][0];
  const lastKey = ascendingEntries[ascendingEntries.length - 1][0];
  const daySpan = Math.max(
    1,
    Math.round((dayKeyToMs(lastKey) - dayKeyToMs(firstKey)) / 86_400_000),
  );
  const first = ascendingEntries[0][1];
  const last = ascendingEntries[ascendingEntries.length - 1][1];
  return { weeklyRateKg: ((last - first) / daySpan) * 7, smoothed: false };
}

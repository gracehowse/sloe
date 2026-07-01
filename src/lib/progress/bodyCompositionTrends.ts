/**
 * ENG-1237 — Body-composition trend copy (body fat % + derived lean mass).
 *
 * Pure functions shared by web + mobile `BodyCompositionTrendCard` and the
 * Pro-gated `/api/progress/body-composition-trends` route so the two platforms
 * cannot drift.
 *
 * Lean mass is DERIVED, never stored: on any calendar day where both weight and
 * body-fat % exist, `lean_mass_kg = weight_kg × (1 − body_fat_pct / 100)`.
 * We do not guess lean mass without a paired weight reading.
 */

export const BODY_COMP_TREND_WINDOW_DAYS = 90;
export const MAX_BODY_FAT_JSONB_DAYS = 400;

function pruneBodyFatMap(map: Record<string, number>): Record<string, number> {
  const keys = Object.keys(map)
    .sort()
    .reverse()
    .slice(0, MAX_BODY_FAT_JSONB_DAYS);
  const pruned: Record<string, number> = {};
  for (const key of keys) pruned[key] = map[key];
  return pruned;
}

export type BodyCompositionTrendInput = {
  bodyFatPctByDay: Record<string, number>;
  weightKgByDay: Record<string, number>;
  /** Scalar fallback when the by-day map is empty but `body_fat_pct` exists. */
  bodyFatPctLatest: number | null;
  trendWindowDays?: number;
  /** Optional clock for deterministic tests. */
  now?: number;
};

export type BodyCompositionMetric = {
  current: number | null;
  /** Signed change over the trend window (current − baseline). */
  delta: number | null;
  /** Human label, e.g. "−1.3% / 90d" or "+0.4 kg / 90d". */
  deltaLabel: string | null;
  unit: "%" | "kg";
};

export type BodyCompositionTrendCopy = {
  bodyFat: BodyCompositionMetric;
  leanMass: BodyCompositionMetric;
  /** True when at least one metric has a current value to show Pro users. */
  hasReadableData: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatSignedDelta(delta: number, unit: "%" | "kg", windowDays: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = Math.abs(delta);
  const value = unit === "%" ? round1(abs) : round1(abs);
  const suffix = unit === "%" ? "%" : " kg";
  return `${sign}${value}${suffix} / ${windowDays}d`;
}

function sortedFiniteEntries(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

function valueOnOrBefore(
  entries: Array<[string, number]>,
  targetKey: string,
): number | null {
  let best: number | null = null;
  for (const [key, value] of entries) {
    if (key <= targetKey) best = value;
    else break;
  }
  return best;
}

function dateKeyDaysAgo(fromMs: number, days: number): string {
  const d = new Date(fromMs);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function deriveLeanMassSeries(
  bodyFatEntries: Array<[string, number]>,
  weightEntries: Array<[string, number]>,
): Array<[string, number]> {
  const weightByKey = new Map(weightEntries);
  const out: Array<[string, number]> = [];
  for (const [dk, bf] of bodyFatEntries) {
    const w = weightByKey.get(dk) ?? valueOnOrBefore(weightEntries, dk);
    if (w == null || !Number.isFinite(w) || w <= 0) continue;
    if (!Number.isFinite(bf) || bf <= 0 || bf >= 100) continue;
    out.push([dk, round1(w * (1 - bf / 100))]);
  }
  return out;
}

function buildMetric(
  entries: Array<[string, number]>,
  unit: "%" | "kg",
  windowDays: number,
  nowMs: number,
): BodyCompositionMetric {
  if (entries.length === 0) {
    return { current: null, delta: null, deltaLabel: null, unit };
  }
  const current = entries[entries.length - 1]![1];
  const baselineKey = dateKeyDaysAgo(nowMs, windowDays);
  const baseline = valueOnOrBefore(entries, baselineKey);
  const delta =
    baseline != null && current != null ? round1(current - baseline) : null;
  return {
    current,
    delta,
    deltaLabel:
      delta != null && Math.abs(delta) >= 0.05
        ? formatSignedDelta(delta, unit, windowDays)
        : null,
    unit,
  };
}

export function pruneBodyFatPctByDay(
  map: Record<string, number>,
): Record<string, number> {
  return pruneBodyFatMap(map);
}

export function buildBodyCompositionTrendCopy(
  input: BodyCompositionTrendInput,
): BodyCompositionTrendCopy {
  const windowDays = input.trendWindowDays ?? BODY_COMP_TREND_WINDOW_DAYS;
  const nowMs = input.now ?? Date.now();

  const bfEntries = sortedFiniteEntries(input.bodyFatPctByDay);
  if (bfEntries.length === 0 && input.bodyFatPctLatest != null && Number.isFinite(input.bodyFatPctLatest)) {
    const today = new Date(nowMs).toISOString().slice(0, 10);
    bfEntries.push([today, round1(input.bodyFatPctLatest)]);
  }

  const weightEntries = sortedFiniteEntries(input.weightKgByDay);
  const leanEntries = deriveLeanMassSeries(bfEntries, weightEntries);

  const bodyFat = buildMetric(bfEntries, "%", windowDays, nowMs);
  const leanMass = buildMetric(leanEntries, "kg", windowDays, nowMs);

  return {
    bodyFat,
    leanMass,
    hasReadableData: bodyFat.current != null || leanMass.current != null,
  };
}

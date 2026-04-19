/**
 * Pure helpers for HealthKit dietary sample correlation.
 *
 * Background — TestFlight build 7 (`AJHZNp8NHTiFNk9TjQfdYBk`): when MFP (and
 * other third-party loggers) flush a day's meals via Apple Health they often
 * write every food item with the same wall-clock `startDate` (= local midnight
 * or sync time). Our previous correlation strategy bucketed dietary samples by
 * `effectiveMinute|bundleId`, which collapsed every meal in the bulk batch into
 * a single bucket — summing all carbs / protein / fat into one inflated entry.
 *
 * The correct grouping is **per HKCorrelation**: HealthKit emits a parent
 * `HKCorrelationTypeIdentifierFood` whose children are the per-meal energy +
 * macro `HKQuantitySample`s. Each child sample carries the parent UUID under
 * `metadata.HKCorrelationUUID`; the parent itself exposes its child UUIDs via
 * `quantitySampleIds`.
 *
 * Strategy implemented by `dietaryCorrelationKeyForSample`:
 *   1. Use the food-correlation parent UUID derived from the
 *      `quantitySampleId → correlationId` map (built from native
 *      `getFoodCorrelationSamples`) — most reliable.
 *   2. Else, fall back to the child sample's own
 *      `metadata.HKCorrelationUUID`.
 *   3. Else, fall back to the legacy `effectiveMinute|bundleId` key (for
 *      writers that don't emit food correlations at all).
 *
 * Kept in its own module (no React Native imports) so unit tests can exercise
 * the bug fix without going through `healthSync.ts` and the `react-native-health`
 * native module.
 */

export type CorrelationDietarySample = {
  value: number;
  startDate: string;
  endDate?: string;
  /** HKQuantitySample UUID (react-native-health bridges this as `id`). */
  id?: string;
  sourceName?: string;
  sourceBundleId?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

/** Native row shape from `getFoodCorrelationSamples` (see healthSync.ts). */
export type CorrelationParentRow = {
  id: string;
  quantitySampleIds: readonly string[];
};

/** Metadata keys various bridges expose for the parent food correlation UUID. */
const CORRELATION_UUID_META_KEYS = [
  "HKCorrelationUUID",
  "HKMetadataKeyCorrelationUUID",
  "HKFoodCorrelationUUID",
  "correlationUUID",
  "CorrelationUUID",
];

function metaString(meta: Record<string, unknown> | undefined, keys: readonly string[]): string | null {
  // Guard: HealthKit bridges (and especially the RN 0.76 newArch callback
  // path on iOS 26+) have been observed handing us non-object values for
  // `metadata` (string, null, array, Proxy). Any lookup on those throws.
  // Treat anything that isn't a plain object as "no metadata" — safer than
  // crashing the entire `Connect Apple Health` flow (F-1, 2026-04-19).
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  for (const k of keys) {
    let v: unknown;
    try {
      v = (meta as Record<string, unknown>)[k];
    } catch {
      continue;
    }
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

function parseInstant(isoOrDate: string | Date | null | undefined): Date {
  try {
    if (isoOrDate instanceof Date) {
      return Number.isFinite(isoOrDate.getTime()) ? isoOrDate : new Date(0);
    }
    if (typeof isoOrDate !== "string" || isoOrDate.length === 0) {
      return new Date(0);
    }
    const d = new Date(isoOrDate);
    return Number.isFinite(d.getTime()) ? d : new Date(0);
  } catch {
    return new Date(0);
  }
}

/**
 * Replica of `effectiveConsumptionInstant` from `healthSync.ts` — kept in this
 * pure-helper module so the legacy fallback key matches byte-for-byte without
 * pulling RN-shaped types across files. Behaviour and thresholds must stay in
 * sync with the original.
 */
function effectiveConsumptionInstant(s: CorrelationDietarySample): Date {
  try {
    const start = parseInstant(s?.startDate);
    if (!s?.endDate) return start;
    const end = parseInstant(s.endDate);
    if (!Number.isFinite(end.getTime())) return start;
    const deltaMs = end.getTime() - start.getTime();
    if (deltaMs <= 60_000) return start;
    const sameLocalDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    if (sameLocalDay && deltaMs >= 5 * 60_000) return end;
    if (deltaMs > 0) return end;
    return start;
  } catch {
    return new Date(0);
  }
}

function bundleIdOf(s: CorrelationDietarySample): string {
  try {
    if (!s || typeof s !== "object") return "";
    const b = s.sourceBundleId;
    if (typeof b === "string" && b.length > 0) return b;
    const sid = s.sourceId;
    if (typeof sid === "string" && sid.length > 0) return sid;
    return "";
  } catch {
    return "";
  }
}

/**
 * Build a `quantitySampleId → correlationParentId` map from the rows returned
 * by `getFoodCorrelationSamples`. When a child quantity sample appears in
 * multiple correlations (rare but legal), the **first** correlation wins —
 * downstream macro grouping then stays deterministic.
 *
 * Defensive: any non-array input, row without a string `id`, or row whose
 * `quantitySampleIds` isn't iterable is skipped rather than thrown. The
 * native bridge has been observed returning malformed rows on iOS 26 in
 * the `Connect Apple Health` flow (F-1, 2026-04-19) — we must not crash.
 */
export function buildQuantityIdToCorrelationId(
  rows: readonly CorrelationParentRow[] | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (!rows || !Array.isArray(rows)) return map;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const id = (row as CorrelationParentRow).id;
      if (typeof id !== "string" || id.length === 0) continue;
      const qids = (row as CorrelationParentRow).quantitySampleIds;
      if (!qids || !Array.isArray(qids)) continue;
      for (const qid of qids) {
        if (typeof qid !== "string" || qid.length === 0) continue;
        if (!map.has(qid)) map.set(qid, id);
      }
    }
  } catch {
    /* fall through — partial map is still safe to use */
  }
  return map;
}

/** Result with provenance so callers can log / instrument bulk-sync detection. */
export type CorrelationKeyResult = {
  key: string;
  /** "parentMap" = derived from food-correlation parent rows; "metaUuid" = read from sample metadata; "minuteBundle" = legacy fallback. */
  source: "parentMap" | "metaUuid" | "minuteBundle";
};

/**
 * Group HealthKit dietary samples so that each food item produced by a
 * third-party logger maps to its own bucket. See module docstring for why
 * minute-only bucketing fails on MFP-style bulk syncs.
 *
 * Every code path is wrapped in try/catch with a legacy `minuteBundle`
 * fallback — a malformed `sample` or Proxy `metadata` from the native
 * bridge must never crash the HealthKit sync (F-1, 2026-04-19).
 */
export function dietaryCorrelationKeyForSample(
  sample: CorrelationDietarySample,
  quantityIdToCorrelationId: ReadonlyMap<string, string> | null | undefined,
): CorrelationKeyResult {
  try {
    if (!sample || typeof sample !== "object") {
      return { key: `unknown|${Math.floor(Date.now() / 60000)}|unknown`, source: "minuteBundle" };
    }
    const bundle = bundleIdOf(sample) || "unknown";

    try {
      if (
        typeof sample.id === "string" &&
        sample.id.length > 0 &&
        quantityIdToCorrelationId &&
        typeof quantityIdToCorrelationId.get === "function"
      ) {
        const parentId = quantityIdToCorrelationId.get(sample.id);
        if (typeof parentId === "string" && parentId.length > 0) {
          return { key: `corr|${parentId}|${bundle}`, source: "parentMap" };
        }
      }
    } catch {
      /* parent-map lookup failed — fall through to metadata path */
    }

    let metaCorr: string | null = null;
    try {
      metaCorr = metaString(sample.metadata, CORRELATION_UUID_META_KEYS);
    } catch {
      metaCorr = null;
    }
    if (metaCorr) return { key: `corr|${metaCorr}|${bundle}`, source: "metaUuid" };

    const t = effectiveConsumptionInstant(sample).getTime();
    const startDateKey = typeof sample.startDate === "string" ? sample.startDate : "";
    if (!Number.isFinite(t)) {
      return { key: `${startDateKey}|${bundle}`, source: "minuteBundle" };
    }
    const minute = Math.floor(t / 60000);
    return { key: `${minute}|${bundle}`, source: "minuteBundle" };
  } catch {
    // Last-resort fallback — never let this function propagate an exception
    // up into the HealthKit sync pipeline, which runs on Today-tab focus.
    return { key: `fallback|${Math.floor(Date.now() / 60000)}|unknown`, source: "minuteBundle" };
  }
}

/**
 * Per-sample kcal share of its correlation bucket — used by `healthSync.ts`
 * to **proportionally distribute** a bucket's macros (protein / carbs / fat /
 * fiber / micros) across the energy samples that share the bucket.
 *
 * Without this, a TestFlight build-7 bug (2026-04-18) had the symptom where
 * two MFP meals at the same wall-clock minute (e.g. Dinner 828 kcal + Snacks
 * 545 kcal both flushed at 18:18) both received the **same** macros from the
 * legacy `minute|bundle` bucket — duplicating ~80g protein into the day total
 * and inflating it by ~50%.
 *
 * Behaviour:
 *   - Single-sample bucket → `share = 1` (unchanged from prior code path).
 *   - Multi-sample bucket  → `share = sample.kcal / sum(bucket.kcal)`.
 *
 * Why proportional rather than "drop all macros" or "give all to the largest"?
 *   - Proportional preserves the bucket's *total* macros, so the daily total
 *     stays accurate when MFP wrote a single combined macro set per day.
 *   - It's symmetric — no implicit "largest meal wins" heuristic that quietly
 *     mis-attributes when the largest meal is the one without macros.
 *   - Worst-case error is bounded by the ratio of meal sizes, not unbounded
 *     duplication.
 *
 * The `legacyAmbiguousBuckets` count is exposed for a single per-sync log
 * line so we can see how often this code rescues real users.
 */
export function bucketEnergyShares(
  energySamples: readonly CorrelationDietarySample[] | null | undefined,
  quantityIdToCorrelationId: ReadonlyMap<string, string> | null | undefined,
): {
  shareForSample: (sampleId: string | undefined, key: string) => number;
  legacyAmbiguousBuckets: number;
} {
  type Bucket = { totalKcal: number; sampleCount: number; legacy: boolean };
  const buckets = new Map<string, Bucket>();
  const sampleKcal = new Map<string, number>();
  // Defensive: the native bridge has handed us non-array payloads on crash
  // reports — treat anything non-iterable as "no samples" (F-1, 2026-04-19).
  try {
    if (energySamples && Array.isArray(energySamples)) {
      for (const s of energySamples) {
        if (!s || typeof s !== "object") continue;
        const r = dietaryCorrelationKeyForSample(s, quantityIdToCorrelationId);
        const kcal = Number.isFinite(s.value) && s.value > 0 ? s.value : 0;
        let b = buckets.get(r.key);
        if (!b) {
          b = { totalKcal: 0, sampleCount: 0, legacy: r.source === "minuteBundle" };
          buckets.set(r.key, b);
        }
        b.totalKcal += kcal;
        b.sampleCount += 1;
        if (typeof s.id === "string" && s.id.length > 0) sampleKcal.set(s.id, kcal);
      }
    }
  } catch {
    /* partial buckets are still safe — proportional split over a subset */
  }
  let legacyAmbiguousBuckets = 0;
  for (const b of buckets.values()) {
    if (b.legacy && b.sampleCount > 1) legacyAmbiguousBuckets++;
  }
  return {
    legacyAmbiguousBuckets,
    shareForSample(sampleId, key) {
      try {
        const b = buckets.get(key);
        if (!b || b.sampleCount <= 1) return 1;
        if (b.totalKcal <= 0) return 1 / b.sampleCount;
        const own = sampleId ? sampleKcal.get(sampleId) ?? 0 : 0;
        if (own <= 0) return 0;
        return own / b.totalKcal;
      } catch {
        // Preserve the pre-fix behaviour for the caller — share=1 means
        // "use the bucket's macros unchanged", same as the legacy path.
        return 1;
      }
    },
  };
}

/**
 * Detect bulk-sync (e.g. MFP daily flush): more than one *distinct correlation
 * UUID* lands in the same `effectiveMinute|bundleId` bucket. Used for a single
 * production log line per sync cycle so we can see how often the new
 * per-correlation grouping rescues a day from inflation.
 */
export function detectBulkSync(
  energySamples: readonly CorrelationDietarySample[] | null | undefined,
  quantityIdToCorrelationId: ReadonlyMap<string, string> | null | undefined,
): { detected: boolean; bundles: string[] } {
  const minuteToCorrIds = new Map<string, Set<string>>();
  // Diagnostic-only helper; must not throw into the sync pipeline (F-1).
  try {
    if (!energySamples || !Array.isArray(energySamples)) {
      return { detected: false, bundles: [] };
    }
    for (const s of energySamples) {
      if (!s || typeof s !== "object") continue;
      const t = effectiveConsumptionInstant(s).getTime();
      if (!Number.isFinite(t)) continue;
      const minute = Math.floor(t / 60000);
      const bundle = bundleIdOf(s) || "unknown";
      const minuteKey = `${minute}|${bundle}`;
      let mapped: string | undefined;
      try {
        mapped =
          typeof s.id === "string" && s.id.length > 0 && quantityIdToCorrelationId
            ? quantityIdToCorrelationId.get(s.id) ?? undefined
            : undefined;
      } catch {
        mapped = undefined;
      }
      const corrId = mapped || metaString(s.metadata, CORRELATION_UUID_META_KEYS);
      if (!corrId) continue;
      let set = minuteToCorrIds.get(minuteKey);
      if (!set) {
        set = new Set<string>();
        minuteToCorrIds.set(minuteKey, set);
      }
      set.add(corrId);
    }
  } catch {
    return { detected: false, bundles: [] };
  }
  const bundles = new Set<string>();
  let detected = false;
  for (const [minuteKey, ids] of minuteToCorrIds) {
    if (ids.size > 1) {
      detected = true;
      const bundle = minuteKey.split("|")[1] ?? "unknown";
      bundles.add(bundle);
    }
  }
  return { detected, bundles: Array.from(bundles) };
}

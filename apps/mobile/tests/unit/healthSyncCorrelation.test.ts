/**
 * Regression tests for the HealthKit dietary-sample correlation fix shipped
 * for TestFlight build 7 (`AJHZNp8NHTiFNk9TjQfdYBk` — MFP day import inflated
 * carbs because every meal in a daily bulk-sync was collapsed into one
 * `nutrition_entries` row).
 *
 * The pure helpers under test live in `apps/mobile/lib/healthSyncCorrelation.ts`
 * deliberately so this file does not pull in `react-native-health` or any
 * RN module — it can run under the mobile vitest config without the known RN
 * ESM loader issues that affect `*.test.tsx` render tests.
 *
 * These tests demonstrate the actual fix: revert the diff in
 * `healthSyncCorrelation.ts` (e.g. drop the `parentMap` / `metaUuid` branches
 * and always return the legacy minute-bucket key) and they fail.
 */
import { describe, expect, it } from "vitest";
import {
  buildQuantityIdToCorrelationId,
  detectBulkSync,
  dietaryCorrelationKeyForSample,
  type CorrelationDietarySample,
  type CorrelationParentRow,
} from "../../lib/healthSyncCorrelation";

const MFP_BUNDLE = "com.myfitnesspal.mfp";
const MIDNIGHT = "2026-04-17T00:00:00Z";

function energySample(
  id: string,
  value: number,
  metadata?: Record<string, unknown>,
  startDate: string = MIDNIGHT,
): CorrelationDietarySample {
  return { id, value, startDate, sourceBundleId: MFP_BUNDLE, metadata };
}

function macroSample(
  id: string,
  value: number,
  metadata?: Record<string, unknown>,
  startDate: string = MIDNIGHT,
): CorrelationDietarySample {
  return { id, value, startDate, sourceBundleId: MFP_BUNDLE, metadata };
}

/**
 * Group an arbitrary set of dietary samples into per-correlation totals using
 * the same algorithm `syncNutritionFromHealth` runs in production. Returned
 * shape is `correlationKey → permissionKey → summed value`, mirroring the
 * `correlated` map inside `syncNutritionFromHealth`.
 */
function groupByCorrelation(
  perPermission: Record<string, CorrelationDietarySample[]>,
  qIdToCorrId: ReadonlyMap<string, string>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [permissionKey, samples] of Object.entries(perPermission)) {
    for (const s of samples) {
      const { key } = dietaryCorrelationKeyForSample(s, qIdToCorrId);
      if (!out[key]) out[key] = {};
      out[key][permissionKey] = (out[key][permissionKey] ?? 0) + s.value;
    }
  }
  return out;
}

describe("dietaryCorrelationKeyForSample — MFP bulk-sync fix", () => {
  it("two energy samples sharing a minute|bundle but with distinct correlation parents produce two separate macro entries", () => {
    // Two MFP foods written at the same wall-clock midnight with their own
    // food-correlation parents (typical MFP daily flush).
    const energyA = energySample("e-a", 500);
    const energyB = energySample("e-b", 200);
    const carbA = macroSample("c-a", 60); // pasta
    const carbB = macroSample("c-b", 5); // chicken

    const correlations: CorrelationParentRow[] = [
      { id: "food-a-uuid", quantitySampleIds: ["e-a", "c-a"] },
      { id: "food-b-uuid", quantitySampleIds: ["e-b", "c-b"] },
    ];
    const qIdToCorrId = buildQuantityIdToCorrelationId(correlations);

    const totals = groupByCorrelation(
      { EnergyConsumed: [energyA, energyB], Carbohydrates: [carbA, carbB] },
      qIdToCorrId,
    );

    const keys = Object.keys(totals);
    expect(keys).toHaveLength(2);

    const keyA = dietaryCorrelationKeyForSample(energyA, qIdToCorrId).key;
    const keyB = dietaryCorrelationKeyForSample(energyB, qIdToCorrId).key;
    expect(keyA).not.toBe(keyB);

    expect(totals[keyA]).toEqual({ EnergyConsumed: 500, Carbohydrates: 60 });
    expect(totals[keyB]).toEqual({ EnergyConsumed: 200, Carbohydrates: 5 });
  });

  it("metadata.HKCorrelationUUID is enough — no parent rows needed (bridges that don't expose getFoodCorrelationSamples)", () => {
    const energyA = energySample("e-a", 500, { HKCorrelationUUID: "food-a-uuid" });
    const energyB = energySample("e-b", 200, { HKCorrelationUUID: "food-b-uuid" });
    const carbA = macroSample("c-a", 60, { HKCorrelationUUID: "food-a-uuid" });
    const carbB = macroSample("c-b", 5, { HKCorrelationUUID: "food-b-uuid" });

    const totals = groupByCorrelation(
      { EnergyConsumed: [energyA, energyB], Carbohydrates: [carbA, carbB] },
      new Map(),
    );

    expect(Object.keys(totals)).toHaveLength(2);
    const keyA = dietaryCorrelationKeyForSample(energyA, null).key;
    const keyB = dietaryCorrelationKeyForSample(energyB, null).key;
    expect(totals[keyA]).toEqual({ EnergyConsumed: 500, Carbohydrates: 60 });
    expect(totals[keyB]).toEqual({ EnergyConsumed: 200, Carbohydrates: 5 });
  });

  it("two macro samples sharing one correlation UUID with one energy sample produce one entry with summed macros (legitimate single-meal case)", () => {
    // Stir-fry: one HKCorrelationTypeIdentifierFood, three children
    // (energy + two carb sources, e.g. rice + noodles).
    const energy = energySample("e-stir", 800);
    const carb1 = macroSample("c-rice", 70);
    const carb2 = macroSample("c-noodles", 30);

    const correlations: CorrelationParentRow[] = [
      { id: "food-stirfry-uuid", quantitySampleIds: ["e-stir", "c-rice", "c-noodles"] },
    ];
    const qIdToCorrId = buildQuantityIdToCorrelationId(correlations);

    const totals = groupByCorrelation(
      { EnergyConsumed: [energy], Carbohydrates: [carb1, carb2] },
      qIdToCorrId,
    );

    const keys = Object.keys(totals);
    expect(keys).toHaveLength(1);
    const key = keys[0]!;
    expect(totals[key]).toEqual({ EnergyConsumed: 800, Carbohydrates: 100 });
  });

  it("legacy fallback: samples with no correlation info are still bucketed by minute|bundle (no behaviour regression)", () => {
    // Old-style writer (no food correlation, no per-sample correlation UUID).
    // These should keep the pre-fix bucketing behaviour so users don't see
    // existing imports flip shape on upgrade.
    const energy = energySample("e-legacy", 400);
    const carb = macroSample("c-legacy", 50);

    const totals = groupByCorrelation(
      { EnergyConsumed: [energy], Carbohydrates: [carb] },
      new Map(),
    );
    expect(Object.keys(totals)).toHaveLength(1);
    const result = dietaryCorrelationKeyForSample(energy, new Map());
    expect(result.source).toBe("minuteBundle");
    expect(totals[result.key]).toEqual({ EnergyConsumed: 400, Carbohydrates: 50 });
  });

  it("mixed batch: correlated samples group per-correlation; legacy-style samples in the same minute do NOT contaminate them", () => {
    const energyMfpA = energySample("e-mfp-a", 500, { HKCorrelationUUID: "mfp-a" });
    const energyMfpB = energySample("e-mfp-b", 200, { HKCorrelationUUID: "mfp-b" });
    const energyLegacy: CorrelationDietarySample = {
      id: "e-legacy",
      value: 100,
      startDate: MIDNIGHT,
      sourceBundleId: "com.legacy.app",
    };

    const carbMfpA = macroSample("c-mfp-a", 60, { HKCorrelationUUID: "mfp-a" });
    const carbMfpB = macroSample("c-mfp-b", 5, { HKCorrelationUUID: "mfp-b" });
    const carbLegacy: CorrelationDietarySample = {
      id: "c-legacy",
      value: 10,
      startDate: MIDNIGHT,
      sourceBundleId: "com.legacy.app",
    };

    const totals = groupByCorrelation(
      {
        EnergyConsumed: [energyMfpA, energyMfpB, energyLegacy],
        Carbohydrates: [carbMfpA, carbMfpB, carbLegacy],
      },
      new Map(),
    );

    expect(Object.keys(totals)).toHaveLength(3);
    const sums = Object.values(totals).map((t) => t.Carbohydrates).sort((a, b) => a - b);
    expect(sums).toEqual([5, 10, 60]);
  });

  it("parent-row mapping wins over per-sample metadata (richer data path is preferred)", () => {
    const energy = energySample("e-x", 500, { HKCorrelationUUID: "from-meta" });
    const correlations: CorrelationParentRow[] = [
      { id: "from-parent", quantitySampleIds: ["e-x"] },
    ];
    const qIdToCorrId = buildQuantityIdToCorrelationId(correlations);
    const result = dietaryCorrelationKeyForSample(energy, qIdToCorrId);
    expect(result.source).toBe("parentMap");
    expect(result.key).toContain("from-parent");
    expect(result.key).not.toContain("from-meta");
  });

  it("HealthKit may bridge the parent-correlation key under different metadata names; all are recognised", () => {
    const variants = [
      "HKCorrelationUUID",
      "HKMetadataKeyCorrelationUUID",
      "HKFoodCorrelationUUID",
      "correlationUUID",
      "CorrelationUUID",
    ];
    for (const key of variants) {
      const e = energySample("e-1", 100, { [key]: "shared-uuid" });
      const r = dietaryCorrelationKeyForSample(e, null);
      expect(r.source).toBe("metaUuid");
      expect(r.key).toContain("shared-uuid");
    }
  });
});

describe("buildQuantityIdToCorrelationId", () => {
  it("maps every child quantity sample to its parent correlation UUID", () => {
    const map = buildQuantityIdToCorrelationId([
      { id: "food-1", quantitySampleIds: ["a", "b", "c"] },
      { id: "food-2", quantitySampleIds: ["d"] },
    ]);
    expect(map.get("a")).toBe("food-1");
    expect(map.get("b")).toBe("food-1");
    expect(map.get("c")).toBe("food-1");
    expect(map.get("d")).toBe("food-2");
    expect(map.get("missing")).toBeUndefined();
  });

  it("first correlation wins when a quantity sample appears under multiple parents (deterministic)", () => {
    const map = buildQuantityIdToCorrelationId([
      { id: "first", quantitySampleIds: ["x"] },
      { id: "second", quantitySampleIds: ["x"] },
    ]);
    expect(map.get("x")).toBe("first");
  });

  it("ignores rows with empty id or empty/non-string quantitySampleIds", () => {
    const map = buildQuantityIdToCorrelationId([
      { id: "", quantitySampleIds: ["a"] },
      { id: "ok", quantitySampleIds: ["", "valid"] },
    ]);
    expect(map.has("a")).toBe(false);
    expect(map.get("valid")).toBe("ok");
    expect(map.has("")).toBe(false);
  });
});

describe("detectBulkSync", () => {
  it("flags as bulk when two distinct correlation parents share one effective minute + bundle", () => {
    const energyA = energySample("e-a", 500, { HKCorrelationUUID: "food-a" });
    const energyB = energySample("e-b", 200, { HKCorrelationUUID: "food-b" });
    const result = detectBulkSync([energyA, energyB], null);
    expect(result.detected).toBe(true);
    expect(result.bundles).toContain(MFP_BUNDLE);
  });

  it("does not flag when all energy samples share one correlation parent (single legitimate meal)", () => {
    const energy = energySample("e", 500, { HKCorrelationUUID: "food-a" });
    const result = detectBulkSync([energy], null);
    expect(result.detected).toBe(false);
    expect(result.bundles).toHaveLength(0);
  });

  it("does not flag when there is no correlation information (legacy writers)", () => {
    const energyA = energySample("e-a", 500);
    const energyB = energySample("e-b", 200);
    const result = detectBulkSync([energyA, energyB], null);
    expect(result.detected).toBe(false);
  });

  it("does not flag when correlated samples sit in different minute buckets (spread-out manual logging)", () => {
    const energyA = energySample("e-a", 500, { HKCorrelationUUID: "food-a" }, "2026-04-17T08:00:00Z");
    const energyB = energySample("e-b", 200, { HKCorrelationUUID: "food-b" }, "2026-04-17T13:30:00Z");
    const result = detectBulkSync([energyA, energyB], null);
    expect(result.detected).toBe(false);
  });
});

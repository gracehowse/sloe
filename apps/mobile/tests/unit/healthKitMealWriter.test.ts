/**
 * Tests for `lib/healthKitMealWriter` — the per-meal Apple HealthKit
 * writer added 2026-04-30 for competitive parity with MFP / Cal AI.
 *
 * The native bridge (`writeNutritionToHealth` from `lib/healthSync`) is
 * mocked so these tests cover the policy layer only: feature flag,
 * dedupe by mealId, low-confidence skip, and prime/seed.
 *
 * 2026-05-05 (audit Y02) — every call now requires a `userId` so the
 * AsyncStorage dedupe set is userId-scoped instead of global. Calls
 * with a missing userId are treated as disabled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeNutritionMock = vi.fn(async (_meals: unknown) => 1);

vi.mock("@/lib/healthSync", () => ({
  writeNutritionToHealth: writeNutritionMock,
}));

const TEST_USER_A = "00000000-0000-0000-0000-00000000000a";
const TEST_USER_B = "00000000-0000-0000-0000-00000000000b";

async function freshModule(): Promise<typeof import("@/lib/healthKitMealWriter")> {
  vi.resetModules();
  return await import("@/lib/healthKitMealWriter");
}

async function setExportFlag(value: "true" | "false" | null): Promise<void> {
  // Re-import so we hit the same AsyncStorage shim instance the
  // freshly-imported module will use after `vi.resetModules`.
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  if (value == null) await AsyncStorage.removeItem("health_export_nutrition");
  else await AsyncStorage.setItem("health_export_nutrition", value);
}

describe("healthKitMealWriter.writeMealToHealthKitIfEnabled", () => {
  beforeEach(async () => {
    writeNutritionMock.mockClear();
    writeNutritionMock.mockResolvedValue(1);
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.clear();
  });
  afterEach(async () => {
    const mod = await import("@/lib/healthKitMealWriter");
    await mod._resetHealthKitMealWriterForTests(TEST_USER_A);
    await mod._resetHealthKitMealWriterForTests(TEST_USER_B);
  });

  it("is a no-op when the export flag is unset", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    const r = await writeMealToHealthKitIfEnabled({
      mealId: "m1",
      userId: TEST_USER_A,
      name: "Yoghurt",
      calories: 120,
    });
    expect(r).toEqual({ ok: true, written: false, reason: "disabled" });
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("is a no-op when the export flag is explicitly false", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("false");
    const r = await writeMealToHealthKitIfEnabled({
      mealId: "m1",
      userId: TEST_USER_A,
      name: "Yoghurt",
      calories: 120,
    });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("disabled");
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("is a no-op when userId is missing (audit Y02 — won't write to a global key)", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r = await writeMealToHealthKitIfEnabled({
      mealId: "m1",
      name: "Yoghurt",
      calories: 120,
    });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("disabled");
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("writes the meal to HealthKit when the export flag is true", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r = await writeMealToHealthKitIfEnabled({
      mealId: "m1",
      userId: TEST_USER_A,
      name: "Yoghurt",
      calories: 120,
      protein: 10,
      carbs: 8,
      fat: 4,
      fiberG: 1,
      date: "2026-04-30T12:00:00Z",
      origin: "barcode",
    });
    expect(r).toEqual({ ok: true, written: true });
    expect(writeNutritionMock).toHaveBeenCalledTimes(1);
    const [meals] = writeNutritionMock.mock.calls[0]!;
    expect(meals).toEqual([
      {
        name: "Yoghurt",
        calories: 120,
        protein: 10,
        carbs: 8,
        fat: 4,
        fiber: 1,
        date: "2026-04-30T12:00:00Z",
      },
    ]);
  });

  it("dedupes a repeat call for the same mealId", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const a = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    const b = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(a.written).toBe(true);
    expect(b.written).toBe(false);
    expect(b.reason).toBe("duplicate");
    expect(writeNutritionMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT dedupe across different users (audit Y02 — User B's writes must not be suppressed by User A's set)", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    // User A writes mealId "shared".
    const a = await writeMealToHealthKitIfEnabled({ mealId: "shared", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(a.written).toBe(true);
    // User B writes the same mealId — should not be deduped, since
    // their dedupe sets live under different AsyncStorage keys.
    const b = await writeMealToHealthKitIfEnabled({ mealId: "shared", userId: TEST_USER_B, name: "X", calories: 100 });
    expect(b.written).toBe(true);
    expect(writeNutritionMock).toHaveBeenCalledTimes(2);
  });

  it("skips meals whose source contains 'ai-estimate' (low-confidence guard)", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r = await writeMealToHealthKitIfEnabled({
      mealId: "m1",
      userId: TEST_USER_A,
      name: "AI guess",
      calories: 100,
      source: "ai-estimate (photo)",
    });
    expect(r).toEqual({ ok: true, written: false, reason: "low-confidence" });
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("skips meals with non-positive calories", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r1 = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 0 });
    const r2 = await writeMealToHealthKitIfEnabled({ mealId: "m2", userId: TEST_USER_A, name: "X", calories: Number.NaN });
    expect(r1.reason).toBe("no-calories");
    expect(r2.reason).toBe("no-calories");
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("returns hk-failed when the bridge writes zero samples (still marks id so we don't retry on every render)", async () => {
    writeNutritionMock.mockResolvedValueOnce(0);
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r1 = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r1).toEqual({ ok: true, written: false, reason: "hk-failed" });
    // Second attempt is a duplicate (id was marked optimistically).
    const r2 = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r2.reason).toBe("duplicate");
    expect(writeNutritionMock).toHaveBeenCalledTimes(1);
  });

  it("returns ok=true even when the bridge throws (fire-and-forget contract)", async () => {
    writeNutritionMock.mockRejectedValueOnce(new Error("bridge boom"));
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r.ok).toBe(true);
    expect(r.written).toBe(false);
  });

  it("rejects empty mealId early without calling the bridge", async () => {
    const { writeMealToHealthKitIfEnabled } = await freshModule();
    await setExportFlag("true");
    const r = await writeMealToHealthKitIfEnabled({ mealId: "", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r.written).toBe(false);
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });
});

describe("healthKitMealWriter.primeWrittenMealIds", () => {
  beforeEach(async () => {
    writeNutritionMock.mockClear();
    writeNutritionMock.mockResolvedValue(1);
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.clear();
  });
  afterEach(async () => {
    const mod = await import("@/lib/healthKitMealWriter");
    await mod._resetHealthKitMealWriterForTests(TEST_USER_A);
  });

  it("marks ids as already-written so subsequent writes are duplicates", async () => {
    const { writeMealToHealthKitIfEnabled, primeWrittenMealIds } = await freshModule();
    await setExportFlag("true");
    await primeWrittenMealIds(TEST_USER_A, ["m1", "m2"]);
    const r = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r.reason).toBe("duplicate");
    expect(writeNutritionMock).not.toHaveBeenCalled();
  });

  it("does not affect ids that were not primed", async () => {
    const { writeMealToHealthKitIfEnabled, primeWrittenMealIds } = await freshModule();
    await setExportFlag("true");
    await primeWrittenMealIds(TEST_USER_A, ["m1"]);
    const r = await writeMealToHealthKitIfEnabled({ mealId: "m2", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r.written).toBe(true);
    expect(writeNutritionMock).toHaveBeenCalledTimes(1);
  });

  it("ignores empty / non-string ids without throwing", async () => {
    const { primeWrittenMealIds } = await freshModule();
    await primeWrittenMealIds(TEST_USER_A, [] as string[]);
    await primeWrittenMealIds(TEST_USER_A, ["", "  ", "valid-id"] as string[]);
    // No assertion needed — just must not throw.
  });

  it("is a no-op when userId is missing", async () => {
    const { writeMealToHealthKitIfEnabled, primeWrittenMealIds } = await freshModule();
    await setExportFlag("true");
    await primeWrittenMealIds(undefined, ["m1"]);
    // Without a userId, primeWrittenMealIds should not have populated
    // any dedupe set; a subsequent write under a real user should
    // succeed as a fresh write.
    const r = await writeMealToHealthKitIfEnabled({ mealId: "m1", userId: TEST_USER_A, name: "X", calories: 100 });
    expect(r.written).toBe(true);
    expect(writeNutritionMock).toHaveBeenCalledTimes(1);
  });
});

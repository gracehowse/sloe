import { describe, expect, it } from "vitest";
import {
  resolveMaintenance,
  buildMaintenancePopoverCopy,
  ADAPTIVE_STALE_DAYS,
} from "@/lib/nutrition/resolveMaintenance";

/**
 * F-3 (TestFlight `ADFYpDgEEb0QH-j3BXshPTo`, 2026-04-19) — the shared
 * resolver that the Today Activity Bonus tile and the Progress
 * Maintenance card both read. A regression here would let the two
 * surfaces disagree again ("Maintenance 1,675" vs "Your TDEE 1,777").
 */
describe("resolveMaintenance", () => {
  const baseProfile = {
    sex: "male" as const,
    weight_kg: 80,
    height_cm: 180,
    age: 30,
    activity_level: "sedentary" as const,
  };

  it("returns adaptive when confidence is medium and value is fresh", () => {
    const now = new Date("2026-04-19T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2500,
        adaptive_tdee_confidence: "medium",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe("adaptive");
    expect(resolved!.kcal).toBe(2500);
    expect(resolved!.confidence).toBe("medium");
    expect(resolved!.adaptiveRejectedAsStale).toBe(false);
  });

  it("returns adaptive when confidence is high and value is fresh", () => {
    const now = new Date("2026-04-19T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2700,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now },
    );
    expect(resolved!.source).toBe("adaptive");
    expect(resolved!.kcal).toBe(2700);
  });

  it("falls back to formula when adaptive confidence is low", () => {
    const resolved = resolveMaintenance({
      ...baseProfile,
      adaptive_tdee: 2500,
      adaptive_tdee_confidence: "low",
    });
    expect(resolved!.source).toBe("formula");
    // Formula: sedentary (1.2) × Mifflin for an 80 kg / 180 cm / 30 yo
    // male ≈ 2,136 kcal. Assert a tight band around that.
    expect(resolved!.kcal).toBeGreaterThan(2100);
    expect(resolved!.kcal).toBeLessThan(2200);
    expect(resolved!.confidence).toBe("low"); // surfaces the stored value
  });

  it("falls back to formula when adaptive value is missing", () => {
    const resolved = resolveMaintenance({
      ...baseProfile,
      adaptive_tdee: null,
      adaptive_tdee_confidence: "high",
    });
    expect(resolved!.source).toBe("formula");
    expect(resolved!.kcal).toBeGreaterThan(0);
  });

  it("falls back to formula when adaptive_tdee is 0 even at high confidence", () => {
    const resolved = resolveMaintenance({
      ...baseProfile,
      adaptive_tdee: 0,
      adaptive_tdee_confidence: "high",
    });
    expect(resolved!.source).toBe("formula");
  });

  it("rejects stale adaptive (> 14 days old) and marks `adaptiveRejectedAsStale`", () => {
    const now = new Date("2026-04-19T12:00:00Z");
    const stale = new Date(now.getTime() - (ADAPTIVE_STALE_DAYS + 2) * 86_400_000).toISOString();
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2500,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: stale,
      },
      { now },
    );
    expect(resolved!.source).toBe("formula");
    expect(resolved!.adaptiveRejectedAsStale).toBe(true);
    // `formulaKcal` is still populated so the card can keep showing it
    expect(resolved!.formulaKcal).toBeGreaterThan(0);
  });

  it("still uses adaptive when updated_at is exactly at the staleness edge", () => {
    const now = new Date("2026-04-19T12:00:00Z");
    const edge = new Date(now.getTime() - (ADAPTIVE_STALE_DAYS - 1) * 86_400_000).toISOString();
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2500,
        adaptive_tdee_confidence: "medium",
        adaptive_tdee_updated_at: edge,
      },
      { now },
    );
    expect(resolved!.source).toBe("adaptive");
    expect(resolved!.adaptiveRejectedAsStale).toBe(false);
  });

  it("ignores missing updated_at — adaptive still wins at medium+ confidence", () => {
    // We don't penalise missing timestamps because pre-2026-04-14
    // migrations shipped without `adaptive_tdee_updated_at`. A null
    // timestamp means "we don't know"; that's not automatic staleness.
    const resolved = resolveMaintenance({
      ...baseProfile,
      adaptive_tdee: 2500,
      adaptive_tdee_confidence: "medium",
      adaptive_tdee_updated_at: null,
    });
    expect(resolved!.source).toBe("adaptive");
    expect(resolved!.kcal).toBe(2500);
  });

  it("returns null when formula inputs are incomplete (no fabricated number)", () => {
    expect(
      resolveMaintenance({
        sex: null,
        weight_kg: null,
        height_cm: null,
        age: null,
      }),
    ).toBeNull();
    expect(
      resolveMaintenance({
        ...baseProfile,
        weight_kg: 0,
      }),
    ).toBeNull();
    expect(
      resolveMaintenance({
        ...baseProfile,
        height_cm: -5,
      }),
    ).toBeNull();
  });

  it("normalises an unknown confidence string to `null`", () => {
    const resolved = resolveMaintenance({
      ...baseProfile,
      adaptive_tdee: 2500,
      adaptive_tdee_confidence: "wat" as any,
    });
    expect(resolved!.source).toBe("formula");
    expect(resolved!.confidence).toBeNull();
  });
});

describe("buildMaintenancePopoverCopy", () => {
  it("renders the adaptive sentence with confidence word", () => {
    const copy = buildMaintenancePopoverCopy({
      kcal: 1777,
      source: "adaptive",
      confidence: "medium",
      formulaKcal: 1675,
      adaptiveRejectedAsStale: false,
    });
    expect(copy).toContain("Maintenance is the calories you'd burn in a normal day.");
    expect(copy).toContain("actual intake");
    expect(copy).toContain("medium confidence");
  });

  it("renders the formula sentence when source is formula", () => {
    const copy = buildMaintenancePopoverCopy({
      kcal: 1675,
      source: "formula",
      confidence: null,
      formulaKcal: 1675,
      adaptiveRejectedAsStale: false,
    });
    expect(copy).toContain("Maintenance is the calories you'd burn in a normal day.");
    expect(copy).toContain("Formula estimate");
    expect(copy).toContain("activity level");
  });

  it("falls back to a safe confidence label when the value is null", () => {
    const copy = buildMaintenancePopoverCopy({
      kcal: 1800,
      source: "adaptive",
      confidence: null,
      formulaKcal: null,
      adaptiveRejectedAsStale: false,
    });
    // Shouldn't contain "null confidence" — should pick a sensible default.
    expect(copy).not.toContain("null");
    expect(copy).toMatch(/(low|medium|high) confidence/);
  });
});

import { describe, expect, it } from "vitest";
import {
  resolveMaintenance,
  buildMaintenancePopoverCopy,
  ADAPTIVE_STALE_DAYS,
  MAINTENANCE_SEED_ACTIVITY,
} from "@/lib/nutrition/resolveMaintenance";
import { calculateTDEE } from "@/lib/nutrition/tdee";

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

  it("falls back to formula when adaptive sits below the sedentary formula (ENG-1057)", () => {
    const now = new Date("2026-06-11T12:00:00Z");
    const femaleProfile = {
      sex: "female" as const,
      weight_kg: 62,
      height_cm: 165,
      age: 34,
      activity_level: "sedentary" as const,
    };
    const resolved = resolveMaintenance(
      {
        ...femaleProfile,
        adaptive_tdee: 1270,
        adaptive_tdee_confidence: "medium",
        adaptive_tdee_updated_at: "2026-06-10T12:00:00Z",
      },
      { now },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe("formula");
    expect(resolved!.kcal).toBeGreaterThan(1400);
    expect(resolved!.adaptiveRejectedBelowFormula).toBe(true);
    expect(resolved!.rejectedAdaptiveKcal).toBe(1270);
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

  it("ENG-1111 — prefers measured TDEE when flag on and confidence is medium+", () => {
    // Measured (2,400) is above the sedentary formula (~2,136 for this 80 kg /
    // 180 cm / 30 yo male) so the FIX 3 under-eating floor does NOT bind — the
    // trustworthy-measured number wins. (Pre-FIX 3 this used 1,900, which now
    // sits below the formula and would correctly fall back; the happy-path
    // assertion is the measured-ABOVE-formula case.)
    const now = new Date("2026-06-14T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 1329,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-06-13T12:00:00Z",
        measured_tdee: 2400,
        measured_tdee_confidence: "medium",
        measured_tdee_updated_at: "2026-06-13T12:00:00Z",
      },
      { now, enableMeasured: true },
    );
    expect(resolved!.source).toBe("measured");
    expect(resolved!.kcal).toBe(2400);
    expect(resolved!.confidence).toBe("medium");
  });

  it("ENG-1111 — measured off → adaptive wins over measured columns", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2500,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-06-13T12:00:00Z",
        measured_tdee: 1900,
        measured_tdee_confidence: "high",
        measured_tdee_updated_at: "2026-06-13T12:00:00Z",
      },
      { now, enableMeasured: false },
    );
    expect(resolved!.source).toBe("adaptive");
    expect(resolved!.kcal).toBe(2500);
  });

  it("ENG-1111 — stale measured falls through to adaptive", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const stale = new Date(now.getTime() - (ADAPTIVE_STALE_DAYS + 2) * 86_400_000).toISOString();
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2500,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-06-13T12:00:00Z",
        measured_tdee: 1900,
        measured_tdee_confidence: "high",
        measured_tdee_updated_at: stale,
      },
      { now, enableMeasured: true },
    );
    expect(resolved!.source).toBe("adaptive");
  });

  it("ENG-1111 FIX 3 — measured BELOW the sedentary formula surfaces the FORMULA (under-eating floor)", () => {
    // Truncated-wear days can pull the measured median below the user's own
    // sedentary maintenance. For an 80 kg / 180 cm / 30 yo male, sedentary
    // formula ≈ 2,136. A measured value of 1,900 < formula must NOT be shown as
    // Maintenance — surface the formula instead, mirroring the adaptive ENG-1057
    // guard. Without this floor measured would recommend below sedentary.
    const now = new Date("2026-06-14T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: null,
        adaptive_tdee_confidence: null,
        measured_tdee: 1900,
        measured_tdee_confidence: "high",
        measured_tdee_updated_at: "2026-06-13T12:00:00Z",
      },
      { now, enableMeasured: true },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe("formula");
    expect(resolved!.kcal).toBe(resolved!.formulaKcal);
    expect(resolved!.kcal).toBeGreaterThan(1900);
    expect(resolved!.measuredRejectedBelowFormula).toBe(true);
    expect(resolved!.rejectedMeasuredKcal).toBe(1900);
  });

  it("ENG-1111 FIX 3 — measured ABOVE the sedentary formula still surfaces measured (happy path intact)", () => {
    // Same profile (sedentary formula ≈ 2,136). A measured value of 2,400 is
    // above the floor, so the measured number must still win — the floor must
    // not regress the trustworthy-measured happy path.
    const now = new Date("2026-06-14T12:00:00Z");
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 1329,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-06-13T12:00:00Z",
        measured_tdee: 2400,
        measured_tdee_confidence: "high",
        measured_tdee_updated_at: "2026-06-13T12:00:00Z",
      },
      { now, enableMeasured: true },
    );
    expect(resolved!.source).toBe("measured");
    expect(resolved!.kcal).toBe(2400);
    expect(resolved!.measuredRejectedBelowFormula).toBe(false);
    expect(resolved!.rejectedMeasuredKcal).toBeNull();
  });
});

/**
 * Seed-multiplier (sedentary) — TDEE gating 2026-06-10. The maintenance
 * number that COEXISTS WITH THE PER-DAY ACTIVITY BONUS must be the lazy-day /
 * NEAT (sedentary 1.2) burn, so the bonus (`computeActivityBonusKcal`) doesn't
 * double-count activity the profile multiplier already baked in. Survey §4 +
 * `docs/decisions/2026-06-10-adaptive-tdee-gating.md`.
 */
describe("resolveMaintenance — sedentary seed (bonus-coexisting chain)", () => {
  // Grace's profile basics (forensic §4): 55 kg · 157 cm · 31 F.
  const grace = {
    sex: "female" as const,
    weight_kg: 55,
    height_cm: 157,
    age: 31,
  };

  it("seeds the formula at sedentary (1.2), IGNORING a non-sedentary activity_level", () => {
    // Grace's stored level is `light` (1.375 → 1,671). The seed must NOT use
    // it — it must use sedentary (1.2 → 1,458) so the activity bonus pays for
    // activity exactly once.
    const resolvedLight = resolveMaintenance({
      ...grace,
      activity_level: "light",
    });
    const resolvedModerate = resolveMaintenance({
      ...grace,
      activity_level: "moderate",
    });
    const sedentaryKcal = calculateTDEE("female", 55, 157, 31, "sedentary"); // 1,458

    expect(resolvedLight!.source).toBe("formula");
    expect(resolvedLight!.kcal).toBe(sedentaryKcal);
    expect(resolvedLight!.kcal).toBe(1458);
    // The light multiplier (1,671) must NOT leak through.
    expect(resolvedLight!.kcal).not.toBe(
      calculateTDEE("female", 55, 157, 31, "light"),
    );
    // Activity level is ignored entirely — light and moderate resolve identically.
    expect(resolvedModerate!.kcal).toBe(resolvedLight!.kcal);
  });

  it("resolves the same number whether activity_level is missing or active", () => {
    const missing = resolveMaintenance({ ...grace, activity_level: null });
    const active = resolveMaintenance({ ...grace, activity_level: "very_active" });
    expect(missing!.kcal).toBe(active!.kcal);
    expect(missing!.kcal).toBe(calculateTDEE("female", 55, 157, 31, "sedentary"));
  });

  it("MAINTENANCE_SEED_ACTIVITY is sedentary (the constant the comment cites)", () => {
    expect(MAINTENANCE_SEED_ACTIVITY).toBe("sedentary");
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
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
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
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
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
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
    });
    // Shouldn't contain "null confidence" — should pick a sensible default.
    expect(copy).not.toContain("null");
    expect(copy).toMatch(/(low|medium|high) confidence/);
  });

  it("ENG-1111 — measured source mentions Apple Health", () => {
    const copy = buildMaintenancePopoverCopy({
      kcal: 1900,
      source: "measured",
      confidence: "medium",
      formulaKcal: 2100,
      adaptiveRejectedAsStale: false,
      adaptiveRejectedBelowFormula: false,
      rejectedAdaptiveKcal: null,
      measuredRejectedBelowFormula: false,
      rejectedMeasuredKcal: null,
    });
    expect(copy).toMatch(/Apple Health/);
  });
});

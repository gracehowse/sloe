/**
 * Action 5 Item 7 (2026-04-19) — pin the adaptive-vs-formula one-liner
 * surfaced on the WeeklyRecapCard.
 *
 * Spec:
 *  - Format: "Your maintenance landed at X kcal this week (formula said Y)."
 *  - Render only when adaptive won (high or medium confidence) AND the
 *    formula prediction is known AND the two values differ.
 *  - Render condition is identical on web + mobile (shared helper —
 *    `formatMaintenanceRecapLine`).
 *
 * Cases covered: high-confidence (renders), medium-confidence (renders),
 * low-confidence (suppressed — formula fallback), formula source (suppressed),
 * stale adaptive (suppressed), missing chain data (suppressed),
 * identical values (suppressed).
 */

import { describe, expect, it } from "vitest";
import {
  formatMaintenanceRecapLine,
  resolveMaintenance,
  type ResolvedMaintenance,
} from "../../src/lib/nutrition/resolveMaintenance";

const baseProfile = {
  sex: "female" as const,
  weight_kg: 62,
  height_cm: 165,
  age: 34,
  activity_level: "sedentary" as const,
};

describe("formatMaintenanceRecapLine — happy path", () => {
  it("renders when adaptive (high) won and differs from formula", () => {
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2150,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe("adaptive");
    const line = formatMaintenanceRecapLine(resolved);
    expect(line).not.toBeNull();
    expect(line).toContain("2,150");
    expect(line).toContain("formula said");
    expect(line).toMatch(/^Your maintenance landed at /);
    expect(line).toMatch(/\.$/);
  });

  it("renders when adaptive (medium) won and differs from formula", () => {
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 1900,
        adaptive_tdee_confidence: "medium",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(resolved!.source).toBe("adaptive");
    const line = formatMaintenanceRecapLine(resolved);
    expect(line).not.toBeNull();
    expect(line).toContain("1,900");
  });

  it("uses thousands separators on both numbers", () => {
    const resolved: ResolvedMaintenance = {
      kcal: 2150,
      source: "adaptive",
      confidence: "high",
      formulaKcal: 2050,
      adaptiveRejectedAsStale: false,
    };
    const line = formatMaintenanceRecapLine(resolved);
    expect(line).toBe(
      "Your maintenance landed at 2,150 kcal this week (formula said 2,050).",
    );
  });
});

describe("formatMaintenanceRecapLine — suppression rules", () => {
  it("suppresses when adaptive confidence is low (formula fallback)", () => {
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2200,
        adaptive_tdee_confidence: "low",
        adaptive_tdee_updated_at: "2026-04-18T12:00:00Z",
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(resolved!.source).toBe("formula");
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });

  it("suppresses for the formula branch (no adaptive number)", () => {
    const resolved = resolveMaintenance(
      { ...baseProfile },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(resolved!.source).toBe("formula");
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });

  it("suppresses when adaptive is rejected as stale (formula fallback)", () => {
    const resolved = resolveMaintenance(
      {
        ...baseProfile,
        adaptive_tdee: 2200,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-03-01T12:00:00Z", // 49 days old
      },
      { now: new Date("2026-04-19T12:00:00Z") },
    );
    expect(resolved!.source).toBe("formula");
    expect(resolved!.adaptiveRejectedAsStale).toBe(true);
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });

  it("suppresses when resolved is null (incomplete profile)", () => {
    expect(formatMaintenanceRecapLine(null)).toBeNull();
    expect(formatMaintenanceRecapLine(undefined)).toBeNull();
  });

  it("suppresses when formulaKcal is null on the resolved object", () => {
    // Defensive — `resolveMaintenance` returns null when inputs are
    // missing (we never get this shape from the resolver), but the
    // helper guards anyway in case a caller hand-builds the object.
    const resolved: ResolvedMaintenance = {
      kcal: 2100,
      source: "adaptive",
      confidence: "high",
      formulaKcal: null,
      adaptiveRejectedAsStale: false,
    };
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });

  it("suppresses when the two values are identical (nothing to compare)", () => {
    const resolved: ResolvedMaintenance = {
      kcal: 2050,
      source: "adaptive",
      confidence: "high",
      formulaKcal: 2050,
      adaptiveRejectedAsStale: false,
    };
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });

  it("suppresses for hand-built low-confidence adaptive (belt-and-braces)", () => {
    // The resolver never produces this shape (low confidence forces the
    // formula branch), but guard anyway — the spec says "render only
    // when chain.confidence !== 'low'".
    const resolved: ResolvedMaintenance = {
      kcal: 2100,
      source: "adaptive",
      confidence: "low",
      formulaKcal: 2000,
      adaptiveRejectedAsStale: false,
    };
    expect(formatMaintenanceRecapLine(resolved)).toBeNull();
  });
});

describe("formatMaintenanceRecapLine — direction", () => {
  it("works when adaptive < formula (resolved smaller than formula)", () => {
    const resolved: ResolvedMaintenance = {
      kcal: 1850,
      source: "adaptive",
      confidence: "medium",
      formulaKcal: 2000,
      adaptiveRejectedAsStale: false,
    };
    const line = formatMaintenanceRecapLine(resolved);
    expect(line).toBe(
      "Your maintenance landed at 1,850 kcal this week (formula said 2,000).",
    );
  });

  it("works when adaptive > formula (resolved larger than formula)", () => {
    const resolved: ResolvedMaintenance = {
      kcal: 2300,
      source: "adaptive",
      confidence: "high",
      formulaKcal: 2050,
      adaptiveRejectedAsStale: false,
    };
    const line = formatMaintenanceRecapLine(resolved);
    expect(line).toBe(
      "Your maintenance landed at 2,300 kcal this week (formula said 2,050).",
    );
  });
});

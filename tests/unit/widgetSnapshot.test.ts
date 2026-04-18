/**
 * Batch 5.12 — shared widget snapshot builder.
 *
 * This file covers the pure helper at `src/lib/nutrition/widgetSnapshot.ts`
 * via the root test runner. The mobile-specific wrapper (I/O) is tested in
 * `apps/mobile/tests/unit/widgetSnapshot.test.ts` — both suites import the
 * same `buildWidgetSnapshot`, so the shared code stays covered by web's CI.
 */
import { describe, it, expect } from "vitest";
import { buildWidgetSnapshot } from "../../src/lib/nutrition/widgetSnapshot";

const BASE = {
  kcalConsumed: 0,
  kcalTarget: 2000,
  proteinTargetG: 140,
  proteinConsumedG: 0,
  carbsTargetG: 220,
  carbsConsumedG: 0,
  fatTargetG: 70,
  fatConsumedG: 0,
};

describe("buildWidgetSnapshot (shared)", () => {
  it("returns full remaining at start of day", () => {
    const now = new Date("2026-04-17T06:00:00Z");
    const snap = buildWidgetSnapshot({ ...BASE, now });
    expect(snap.kcalConsumed).toBe(0);
    expect(snap.kcalTarget).toBe(2000);
    expect(snap.proteinLeftG).toBe(140);
    expect(snap.carbsLeftG).toBe(220);
    expect(snap.fatLeftG).toBe(70);
    expect(snap.fastActive).toBe(false);
  });

  it("returns negatives over-budget without hiding the overshoot", () => {
    const snap = buildWidgetSnapshot({
      ...BASE,
      kcalConsumed: 2400,
      proteinConsumedG: 160,
      carbsConsumedG: 260,
      fatConsumedG: 80,
    });
    expect(snap.proteinLeftG).toBe(-20);
    expect(snap.carbsLeftG).toBe(-40);
    expect(snap.fatLeftG).toBe(-10);
  });

  it("marks fastActive only for valid ISO timestamps", () => {
    expect(buildWidgetSnapshot({ ...BASE, fastStartsAt: "2026-04-17T20:00:00Z" }).fastActive).toBe(true);
    expect(buildWidgetSnapshot({ ...BASE, fastStartsAt: "not-a-date" }).fastActive).toBe(false);
    expect(buildWidgetSnapshot({ ...BASE, fastStartsAt: null }).fastActive).toBe(false);
  });
});

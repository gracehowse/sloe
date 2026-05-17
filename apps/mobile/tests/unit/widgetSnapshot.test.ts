/**
 * Batch 5.12 — iOS widget snapshot tests.
 *
 * Covers `buildWidgetSnapshot` end-to-end: zero-consumed, mid-day, over-budget,
 * fast active / inactive, and defensive handling of missing / non-finite inputs.
 */
import { describe, it, expect } from "vitest";
import {
  buildWidgetSnapshot,
  SUPPR_WIDGET_SNAPSHOT_KEY,
  SUPPR_WIDGET_SNAPSHOT_FILENAME,
  WIDGET_TAP_DEEP_LINK,
} from "@suppr/shared/nutrition/widgetSnapshot";

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

describe("buildWidgetSnapshot", () => {
  it("returns zeros consumed and full remaining at the start of the day", () => {
    const now = new Date("2026-04-17T06:00:00Z");
    const snap = buildWidgetSnapshot({ ...BASE, now });
    expect(snap.updatedAt).toBe("2026-04-17T06:00:00.000Z");
    expect(snap.kcalConsumed).toBe(0);
    expect(snap.kcalTarget).toBe(2000);
    expect(snap.proteinLeftG).toBe(140);
    expect(snap.carbsLeftG).toBe(220);
    expect(snap.fatLeftG).toBe(70);
    expect(snap.fastActive).toBe(false);
    expect(snap.fastStartsAt).toBeUndefined();
    expect(snap.fastTargetHours).toBeUndefined();
  });

  it("computes mid-day remaining as target minus consumed", () => {
    const snap = buildWidgetSnapshot({
      ...BASE,
      kcalConsumed: 900,
      proteinConsumedG: 70,
      carbsConsumedG: 110,
      fatConsumedG: 30,
    });
    expect(snap.kcalConsumed).toBe(900);
    expect(snap.proteinLeftG).toBe(70);
    expect(snap.carbsLeftG).toBe(110);
    expect(snap.fatLeftG).toBe(40);
  });

  it("returns negative left values when over-budget rather than clamping", () => {
    // The widget renders negatives as "over by N" — we must not hide that.
    const snap = buildWidgetSnapshot({
      ...BASE,
      kcalConsumed: 2400,
      proteinConsumedG: 160,
      carbsConsumedG: 260,
      fatConsumedG: 80,
    });
    expect(snap.kcalConsumed).toBe(2400); // raw consumed never clamped to target
    expect(snap.kcalTarget).toBe(2000);
    expect(snap.proteinLeftG).toBe(-20);
    expect(snap.carbsLeftG).toBe(-40);
    expect(snap.fatLeftG).toBe(-10);
  });

  it("rounds kcal and macros to whole integers", () => {
    const snap = buildWidgetSnapshot({
      ...BASE,
      kcalConsumed: 123.4,
      kcalTarget: 1999.6,
      proteinConsumedG: 12.49,
      proteinTargetG: 140.5,
    });
    expect(snap.kcalConsumed).toBe(123);
    expect(snap.kcalTarget).toBe(2000);
    // 140.5 - 12.49 = 128.01 → 128
    expect(snap.proteinLeftG).toBe(128);
  });

  it("flags fastActive when a valid start timestamp is present", () => {
    const snap = buildWidgetSnapshot({
      ...BASE,
      fastStartsAt: "2026-04-17T20:00:00Z",
      fastTargetHours: 18,
    });
    expect(snap.fastActive).toBe(true);
    expect(snap.fastStartsAt).toBe("2026-04-17T20:00:00Z");
    expect(snap.fastTargetHours).toBe(18);
  });

  it("defaults fastTargetHours to 16 when start is present but target is missing", () => {
    const snap = buildWidgetSnapshot({
      ...BASE,
      fastStartsAt: "2026-04-17T20:00:00Z",
    });
    expect(snap.fastActive).toBe(true);
    expect(snap.fastTargetHours).toBe(16);
  });

  it("falls back to 16h when fastTargetHours is out of range or non-finite", () => {
    const snap1 = buildWidgetSnapshot({
      ...BASE,
      fastStartsAt: "2026-04-17T20:00:00Z",
      fastTargetHours: 0,
    });
    expect(snap1.fastTargetHours).toBe(16);

    const snap2 = buildWidgetSnapshot({
      ...BASE,
      fastStartsAt: "2026-04-17T20:00:00Z",
      fastTargetHours: 72,
    });
    expect(snap2.fastTargetHours).toBe(16);

    const snap3 = buildWidgetSnapshot({
      ...BASE,
      fastStartsAt: "2026-04-17T20:00:00Z",
      fastTargetHours: Number.NaN,
    });
    expect(snap3.fastTargetHours).toBe(16);
  });

  it("treats null or empty fastStartsAt as inactive", () => {
    const snap1 = buildWidgetSnapshot({ ...BASE, fastStartsAt: null });
    expect(snap1.fastActive).toBe(false);
    expect(snap1.fastStartsAt).toBeUndefined();

    const snap2 = buildWidgetSnapshot({ ...BASE, fastStartsAt: "" });
    expect(snap2.fastActive).toBe(false);

    const snap3 = buildWidgetSnapshot({ ...BASE, fastStartsAt: "not-a-date" });
    expect(snap3.fastActive).toBe(false);
  });

  it("coerces non-finite / missing macros to zero without crashing", () => {
    const snap = buildWidgetSnapshot({
      now: new Date("2026-04-17T06:00:00Z"),
      kcalConsumed: Number.NaN,
      kcalTarget: Number.POSITIVE_INFINITY,
      proteinTargetG: Number.NaN,
      proteinConsumedG: undefined as unknown as number,
      carbsTargetG: null as unknown as number,
      carbsConsumedG: 0,
      fatTargetG: 0,
      fatConsumedG: Number.NaN,
    });
    expect(snap.kcalConsumed).toBe(0);
    expect(snap.kcalTarget).toBe(0);
    expect(snap.proteinLeftG).toBe(0);
    expect(snap.carbsLeftG).toBe(0);
    expect(snap.fatLeftG).toBe(0);
  });

  it("uses current time when `now` is missing or invalid", () => {
    const before = Date.now();
    const snap = buildWidgetSnapshot({ ...BASE });
    const after = Date.now();
    const parsed = Date.parse(snap.updatedAt);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("never clamps kcalConsumed to negative even if caller passes junk", () => {
    const snap = buildWidgetSnapshot({ ...BASE, kcalConsumed: -500 });
    expect(snap.kcalConsumed).toBe(0);
  });

  it("exports stable storage key, filename, and widget tap URL", () => {
    expect(SUPPR_WIDGET_SNAPSHOT_KEY).toBe("pm:widget:snapshot");
    expect(SUPPR_WIDGET_SNAPSHOT_FILENAME).toBe("suppr-widget-snapshot.json");
    expect(WIDGET_TAP_DEEP_LINK).toBe("suppr://today/remaining");
  });
});

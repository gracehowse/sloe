/**
 * Action 13 Item #14 (2026-04-19) — pin the "Maintenance source" pill
 * contract against the shared `resolveMaintenance` return value.
 *
 * Bug: when confidence was "low", `resolveMaintenance` correctly fell
 * back to the formula, but the UI had no explicit "this is formula"
 * label. A user reading the card could mistake the low-confidence
 * badge (when it was shown conditionally on `adaptiveConfidence`) for
 * an indication that the displayed kcal was the low-confidence
 * adaptive value. It wasn't — the displayed value was the formula.
 *
 * Fix: the source pill renders "Adaptive" only when
 * `resolved.source === "adaptive"`. When the resolver falls back to
 * the formula, the pill renders "Formula estimate" — and the
 * confidence bar block (gated on `showAdaptiveExtras`) never renders
 * for formula.
 *
 * This test pins the resolver return-value contract that drives both
 * platforms' pill. The rendered pill is exercised in the component
 * snapshot tests; this layer is the one that MUST NOT drift.
 */
import { describe, expect, it } from "vitest";

import { resolveMaintenance } from "../../src/lib/nutrition/resolveMaintenance";

const BASE = {
  sex: "female" as const,
  weight_kg: 65,
  height_cm: 165,
  age: 30,
  activity_level: "sedentary" as const,
};
const NOW = new Date("2026-04-19T12:00:00Z");
const FRESH = "2026-04-18T12:00:00Z";

describe("resolveMaintenance source pill contract (Item #14)", () => {
  it("(a) high-confidence adaptive → source='adaptive'", () => {
    const r = resolveMaintenance(
      { ...BASE, adaptive_tdee: 1900, adaptive_tdee_confidence: "high", adaptive_tdee_updated_at: FRESH },
      { now: NOW },
    );
    expect(r?.source).toBe("adaptive");
    expect(r?.confidence).toBe("high");
  });

  it("(b) medium-confidence adaptive → source='adaptive'", () => {
    const r = resolveMaintenance(
      { ...BASE, adaptive_tdee: 1900, adaptive_tdee_confidence: "medium", adaptive_tdee_updated_at: FRESH },
      { now: NOW },
    );
    expect(r?.source).toBe("adaptive");
    expect(r?.confidence).toBe("medium");
  });

  it("(c) low-confidence adaptive → source='formula' (displayed value IS formula)", () => {
    const r = resolveMaintenance(
      { ...BASE, adaptive_tdee: 1900, adaptive_tdee_confidence: "low", adaptive_tdee_updated_at: FRESH },
      { now: NOW },
    );
    // The resolver falls back to the formula — any "Confidence: low"
    // badge rendered on top of this would misrepresent the displayed
    // value as low-confidence adaptive. The renderer must use
    // `source === "formula"` to show a "Formula estimate" pill.
    expect(r?.source).toBe("formula");
    // `confidence` carries over (so analytics can see what the adaptive
    // would have said), but the pill branches on `source`, not
    // `confidence`.
    expect(r?.confidence).toBe("low");
  });

  it("stale adaptive even with high confidence → source='formula'", () => {
    // Separate failure mode of the same class — any formula fallback
    // should land on the "Formula estimate" pill, not a reshuffled
    // adaptive badge.
    const r = resolveMaintenance(
      {
        ...BASE,
        adaptive_tdee: 1900,
        adaptive_tdee_confidence: "high",
        adaptive_tdee_updated_at: "2026-01-01T00:00:00Z",
      },
      { now: NOW },
    );
    expect(r?.source).toBe("formula");
    expect(r?.adaptiveRejectedAsStale).toBe(true);
  });

  it("no adaptive at all → source='formula'", () => {
    const r = resolveMaintenance({ ...BASE }, { now: NOW });
    expect(r?.source).toBe("formula");
  });
});

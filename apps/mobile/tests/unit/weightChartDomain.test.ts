import { describe, expect, it } from "vitest";

import { computeWeightChartDomain } from "../../../../src/lib/weightProjection";

/**
 * G-3 (TestFlight `AGJmliHTxnmt7sC1VpTZz5E`, 2026-04-19, build 11) —
 * weight chart squished the real data (54.2–55.5 kg) into the top
 * ~20% of the plot because the goal (50 kg) was included directly in
 * the y-axis min/max. These tests pin the post-fix contract:
 *
 *   - domain is derived from the plotted data (+ projection)
 *   - ~10% padding on both ends, ≥ 0.5 unit headroom
 *   - goal is pulled in only when it sits reasonably close to the
 *     data; otherwise caller renders an off-chart hint
 */

describe("computeWeightChartDomain", () => {
  it("pads ~10% on both ends of tight data without a goal", () => {
    const { yMin, yMax, includesGoal } = computeWeightChartDomain(
      [54.2, 54.8, 55.1, 55.5],
    );
    expect(includesGoal).toBe(false);
    // span = 1.3, padding = max(0.13, 0.5) = 0.5
    expect(yMin).toBeCloseTo(53.7, 5);
    expect(yMax).toBeCloseTo(56.0, 5);
  });

  it("G-3 shape — data [54.2, 55.5] with goal 50: goal is off-chart, axis stays tight around the data", () => {
    // 54.2–55.5 with a 50 kg goal is exactly the screenshot in
    // `AGJmliHTxnmt7sC1VpTZz5E`. Goal should NOT anchor the axis.
    const { yMin, yMax, includesGoal } = computeWeightChartDomain(
      [54.2, 54.8, 55.1, 55.5],
      50,
    );
    expect(includesGoal).toBe(false);
    expect(yMin).toBeGreaterThan(52); // far above 50
    expect(yMin).toBeLessThanOrEqual(53.7);
    expect(yMax).toBeGreaterThanOrEqual(56.0);
  });

  it("pulls the goal into the domain when it sits near the data", () => {
    // span = 1.3, padding = 0.5; data [54.2, 55.5], goal 53.8 (just
    // below the padded window) -> should be included.
    const { yMin, yMax, includesGoal } = computeWeightChartDomain(
      [54.2, 54.8, 55.1, 55.5],
      53.8,
    );
    expect(includesGoal).toBe(true);
    expect(yMin).toBeLessThanOrEqual(53.3); // goal - 0.5
    expect(yMax).toBeGreaterThanOrEqual(56.0);
  });

  it("goal exactly inside the data range stays inside", () => {
    const { yMin, yMax, includesGoal } = computeWeightChartDomain(
      [70, 72, 74, 76],
      73,
    );
    expect(includesGoal).toBe(true);
    expect(yMin).toBeLessThan(70);
    expect(yMax).toBeGreaterThan(76);
  });

  it("guarantees at least 0.5 headroom for a flat series", () => {
    const { yMin, yMax } = computeWeightChartDomain([80, 80, 80]);
    expect(yMax - yMin).toBeGreaterThanOrEqual(1); // 0.5 each side
    expect(yMin).toBeLessThanOrEqual(79.5);
    expect(yMax).toBeGreaterThanOrEqual(80.5);
  });

  it("handles a single point without collapsing the axis", () => {
    const { yMin, yMax } = computeWeightChartDomain([72.4]);
    expect(yMax - yMin).toBeGreaterThanOrEqual(1);
  });

  it("empty data + no goal falls back to a sane unit range", () => {
    const { yMin, yMax, includesGoal } = computeWeightChartDomain([]);
    expect(includesGoal).toBe(false);
    expect(yMax).toBeGreaterThan(yMin);
  });

  it("empty data with a goal anchors on the goal", () => {
    const { yMin, yMax, includesGoal } = computeWeightChartDomain([], 70);
    expect(includesGoal).toBe(true);
    expect(yMin).toBeLessThan(70);
    expect(yMax).toBeGreaterThan(70);
  });

  it("ignores non-finite values", () => {
    const { yMin, yMax } = computeWeightChartDomain([
      80,
      81,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      82,
    ]);
    expect(yMin).toBeLessThan(80);
    expect(yMax).toBeGreaterThan(82);
    expect(Number.isFinite(yMin)).toBe(true);
    expect(Number.isFinite(yMax)).toBe(true);
  });

  it("gain journey — goal above data is handled symmetrically", () => {
    const { yMin, yMax, includesGoal } = computeWeightChartDomain(
      [60, 60.3, 60.6],
      80,
    );
    // Goal 80 vs data [60, 60.6] — far out of range, should be off-chart.
    expect(includesGoal).toBe(false);
    expect(yMax).toBeLessThan(80);
  });
});

/**
 * Action 13 Item #4 (2026-04-19) — pin the shared macro-adherence
 * bar formatter. Web + mobile both call this so the cap and label
 * shape can't drift again. Previously web had no cap and mobile
 * clamped at 150% silently; the user-facing label now always carries
 * the actual figure so a 200% protein day shows "200% (capped at
 * 150)" with a clipped 150%-wide bar.
 */
import { describe, expect, it } from "vitest";

import {
  formatMacroAdherenceBar,
  MACRO_ADHERENCE_BAR_CAP_PCT,
} from "../../src/lib/nutrition/progressWeekReport";

describe("formatMacroAdherenceBar", () => {
  it("renders 0% when adherence is 0", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 0 });
    expect(r.barFillPct).toBe(0);
    expect(r.label).toBe("0%");
  });

  it("renders under-target (e.g. 80%) verbatim", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 80 });
    expect(r.barFillPct).toBe(80);
    expect(r.label).toBe("80%");
  });

  it("renders on-target (100%) verbatim", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 100 });
    expect(r.barFillPct).toBe(100);
    expect(r.label).toBe("100%");
  });

  it("renders 150% as exactly the cap with no '(capped)' suffix", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 150 });
    expect(r.barFillPct).toBe(150);
    expect(r.label).toBe("150%");
  });

  it("renders over-target but under-cap (175%) as 150 fill + truthful label", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 175 });
    expect(r.barFillPct).toBe(150);
    expect(r.label).toBe("175% (capped at 150)");
  });

  it("renders over-cap (200%) as 150 fill + truthful label", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 200 });
    expect(r.barFillPct).toBe(150);
    expect(r.label).toBe("200% (capped at 150)");
  });

  it("clamps negative input to 0%", () => {
    const r = formatMacroAdherenceBar({ adherencePct: -10 });
    expect(r.barFillPct).toBe(0);
    expect(r.label).toBe("0%");
  });

  it("treats non-finite input as 0%", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      const r = formatMacroAdherenceBar({ adherencePct: bad as number | null | undefined });
      expect(r.barFillPct).toBe(0);
      expect(r.label).toBe("0%");
    }
  });

  it("rounds before clamping (149.4 → 149%, 149.6 → 150%)", () => {
    expect(formatMacroAdherenceBar({ adherencePct: 149.4 }).label).toBe("149%");
    expect(formatMacroAdherenceBar({ adherencePct: 149.6 }).label).toBe("150%");
  });

  it("exposes the cap constant for tests", () => {
    expect(MACRO_ADHERENCE_BAR_CAP_PCT).toBe(150);
  });
});

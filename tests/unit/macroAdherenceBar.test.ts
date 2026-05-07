/**
 * Action 13 Item #4 (2026-04-19) + F-117 v2 (Grace, 2026-05-07) —
 * pin the shared macro-adherence bar formatter. Web + mobile both
 * call this so the cap and label shape can't drift again.
 *
 * F-117 v2 (Grace, 2026-05-07): the "(capped at 150)" suffix used to
 * appear on over-target rows; it competed with the bar fill colour and
 * looked unreadable. Now the helper emits a clean "187%" label + an
 * `isOver` flag so renderers can flip the % to destructive instead of
 * smearing a parenthetical across the bar. Bar fill is clamped to
 * 100 — the full track fill + destructive label together communicate
 * "over budget".
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
    expect(r.isOver).toBe(false);
  });

  it("renders under-target (e.g. 80%) verbatim", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 80 });
    expect(r.barFillPct).toBe(80);
    expect(r.label).toBe("80%");
    expect(r.isOver).toBe(false);
  });

  it("renders on-target (100%) verbatim, isOver false", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 100 });
    expect(r.barFillPct).toBe(100);
    expect(r.label).toBe("100%");
    expect(r.isOver).toBe(false);
  });

  it("renders 150% as full-track fill + isOver true (no '(capped)' suffix)", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 150 });
    expect(r.barFillPct).toBe(100);
    expect(r.label).toBe("150%");
    expect(r.isOver).toBe(true);
  });

  it("renders over-target (175%) as full-track fill + truthful label + isOver true", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 175 });
    expect(r.barFillPct).toBe(100);
    expect(r.label).toBe("175%");
    expect(r.isOver).toBe(true);
  });

  it("renders far-over (200%) cleanly — no parenthetical, isOver true", () => {
    const r = formatMacroAdherenceBar({ adherencePct: 200 });
    expect(r.barFillPct).toBe(100);
    expect(r.label).toBe("200%");
    expect(r.isOver).toBe(true);
  });

  it("clamps negative input to 0%", () => {
    const r = formatMacroAdherenceBar({ adherencePct: -10 });
    expect(r.barFillPct).toBe(0);
    expect(r.label).toBe("0%");
    expect(r.isOver).toBe(false);
  });

  it("treats non-finite input as 0%", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      const r = formatMacroAdherenceBar({ adherencePct: bad as number | null | undefined });
      expect(r.barFillPct).toBe(0);
      expect(r.label).toBe("0%");
      expect(r.isOver).toBe(false);
    }
  });

  it("rounds before clamping (149.4 → 149%, 149.6 → 150%)", () => {
    expect(formatMacroAdherenceBar({ adherencePct: 149.4 }).label).toBe("149%");
    expect(formatMacroAdherenceBar({ adherencePct: 149.6 }).label).toBe("150%");
  });

  it("never emits a '(capped at …)' suffix (F-117 v2 — Grace 2026-05-07)", () => {
    for (const pct of [105, 130, 175, 200, 999]) {
      const r = formatMacroAdherenceBar({ adherencePct: pct });
      expect(r.label).not.toMatch(/capped at/i);
      expect(r.label).not.toMatch(/[()]/);
    }
  });

  it("exposes the cap constant for tests", () => {
    expect(MACRO_ADHERENCE_BAR_CAP_PCT).toBe(150);
  });
});

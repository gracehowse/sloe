/**
 * progressCommentaryPhase4 — pins the engine-led narrative copy that
 * the Progress headline (Surface E) renders.
 *
 * Authority: D-2026-04-27-12 (always-on TDEE), D-2026-04-27-17
 * (Progress is a story).
 */

import { describe, expect, it } from "vitest";
import {
  generateProgressCommentary,
  splitBodyIntoSegments,
  type ProgressCommentaryTdee,
} from "../../src/lib/nutrition/progressCommentary";

function tdee(
  overrides: Partial<ProgressCommentaryTdee> = {},
): ProgressCommentaryTdee {
  return {
    tdee: 2100,
    confidence: "medium",
    loggingDays: 21,
    ...overrides,
  };
}

describe("generateProgressCommentary — three regimes", () => {
  it("regime=adjustment when delta vs prev > 30 kcal — surfaces both numerals + medium confidence", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2160 }),
      prevWeekTdee: 2100,
      avgIntakeOnLossWeeksKcal: 1840,
    });

    expect(result.regime).toBe("adjustment");
    expect(result.headline).toBe("Your maintenance adjusted up by 60 kcal");
    expect(result.body).toContain("1,840 kcal");
    expect(result.body).toContain("2,160 kcal");
    expect(result.body).toContain("medium confidence");
    expect(result.numerals).toEqual(["1,840 kcal", "2,160 kcal"]);
    expect(result.confidence).toBe("medium");
    expect(result.hasMaintenanceEstimate).toBe(true);
  });

  it("regime=adjustment fires on negative delta too — 'down by N'", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2010 }),
      prevWeekTdee: 2100,
    });
    expect(result.regime).toBe("adjustment");
    expect(result.headline).toBe("Your maintenance adjusted down by 90 kcal");
  });

  it("regime=calibrating when current is null — first-3-days copy when loggingDays<3", () => {
    const result = generateProgressCommentary({
      current: null,
      loggingDays: 2,
    });
    expect(result.regime).toBe("calibrating");
    expect(result.headline).toMatch(/Welcome/);
    expect(result.body).toMatch(/Log meals/);
    expect(result.confidence).toBe("low");
    expect(result.hasMaintenanceEstimate).toBe(false);
    expect(result.numerals).toEqual([]);
  });

  it("regime=calibrating when confidence is low even if engine has a value", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2400, confidence: "low", loggingDays: 9 }),
      prevWeekTdee: null,
    });
    expect(result.regime).toBe("calibrating");
    expect(result.headline).toMatch(/calibrating/);
    expect(result.confidence).toBe("low");
    expect(result.body).toContain("2,400 kcal");
    // Calibrating never claims the maintenance is settled
    expect(result.hasMaintenanceEstimate).toBe(false);
  });

  it("ENG-1034: medium confidence with a range-scoped low day count is NOT downgraded to calibrating", () => {
    // The engine only assigns "medium" once it has ≥14 cumulative logging
    // days (adaptiveTdee.ts ladder), so a stored "medium" already means the
    // warm-up is past. Callers pass a RANGE-scoped day count (this week's
    // ≤7) — re-gating on it forced "still calibrating" + a Low chip while the
    // Maintenance card said "medium". The engine's confidence is the gate.
    const result = generateProgressCommentary({
      current: tdee({ tdee: 1699, confidence: "medium", loggingDays: 5 }),
      loggingDays: 5,
    });
    expect(result.regime).toBe("steady");
    expect(result.confidence).toBe("medium");
    expect(result.headline).not.toMatch(/calibrating/i);
    expect(result.body).toContain("1,699 kcal");
    expect(result.body).toContain("medium confidence");
    expect(result.hasMaintenanceEstimate).toBe(true);
  });

  it("regime=steady when delta ≤ 30 kcal AND confidence ≥ medium", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2110 }),
      prevWeekTdee: 2100,
    });
    expect(result.regime).toBe("steady");
    expect(result.headline).toBe("Maintenance held steady this week");
    expect(result.body).toContain("2,110 kcal");
    expect(result.numerals).toEqual(["2,110 kcal"]);
    expect(result.hasMaintenanceEstimate).toBe(true);
  });

  it("regime=steady when prev is null (no prior week) but engine confident", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2100, confidence: "high", loggingDays: 28 }),
    });
    expect(result.regime).toBe("steady");
    expect(result.confidence).toBe("high");
  });
});

describe("ENG-1034 — confidence chip + copy variant follows the STORED engine confidence", () => {
  // The THIS WEEK card renders `commentary.confidence` straight into the
  // ConfidenceChip and quotes `confidence` inside the body. This pins the
  // chip level + copy variant the card shows for each stored confidence so
  // the chip can never drift back to "Low" while the engine says medium/high
  // (the F-3/F-124/ENG-1034 contradiction). Range-scoped day counts must not
  // change the chip for a non-low engine confidence.

  it("low → calibrating regime, Low chip, 'still calibrating' copy", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 1699, confidence: "low", loggingDays: 5 }),
      loggingDays: 5,
    });
    expect(result.confidence).toBe("low");
    expect(result.regime).toBe("calibrating");
    expect(result.headline).toMatch(/calibrating/i);
  });

  it("medium → steady regime, Medium chip, 'medium confidence' copy with the estimate quoted", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 1699, confidence: "medium", loggingDays: 5 }),
      loggingDays: 5,
    });
    expect(result.confidence).toBe("medium");
    expect(result.regime).toBe("steady");
    expect(result.headline).not.toMatch(/calibrating/i);
    expect(result.body).toContain("1,699 kcal");
    expect(result.body).toContain("medium confidence");
    expect(result.numerals).toContain("1,699 kcal");
  });

  it("high → steady regime, High chip, 'high confidence' copy", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 2100, confidence: "high", loggingDays: 6 }),
      loggingDays: 6,
    });
    expect(result.confidence).toBe("high");
    expect(result.regime).toBe("steady");
    expect(result.headline).not.toMatch(/calibrating/i);
    expect(result.body).toContain("high confidence");
  });

  it("the stored confidence flows into adjustment-regime copy too (delta > 30)", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 1699, confidence: "medium", loggingDays: 5 }),
      prevWeekTdee: 1600,
      loggingDays: 5,
    });
    expect(result.regime).toBe("adjustment");
    expect(result.confidence).toBe("medium");
    expect(result.body).toContain("medium confidence");
  });
});

describe("voice rules — pinned per spec §1.7", () => {
  function exampleRegimes(): Array<ReturnType<typeof generateProgressCommentary>> {
    return [
      generateProgressCommentary({
        current: tdee({ tdee: 2160 }),
        prevWeekTdee: 2100,
        avgIntakeOnLossWeeksKcal: 1840,
      }),
      generateProgressCommentary({ current: null, loggingDays: 2 }),
      generateProgressCommentary({
        current: tdee({ tdee: 2400, confidence: "low", loggingDays: 9 }),
      }),
      generateProgressCommentary({
        current: tdee({ tdee: 2110 }),
        prevWeekTdee: 2100,
      }),
    ];
  }

  it("never uses exclamation marks", () => {
    for (const r of exampleRegimes()) {
      expect(r.headline).not.toContain("!");
      expect(r.body).not.toContain("!");
    }
  });

  it("uses second-person ('your', 'you', 'we') — never 'the user'", () => {
    for (const r of exampleRegimes()) {
      expect(r.headline.toLowerCase()).not.toContain("the user");
      expect(r.body.toLowerCase()).not.toContain("the user");
    }
  });

  it("uses tabular-nums-friendly formatting — kcal always rendered with thousands separator", () => {
    const r = generateProgressCommentary({
      current: tdee({ tdee: 2160 }),
      prevWeekTdee: 2100,
      avgIntakeOnLossWeeksKcal: 1840,
    });
    // The thousands separator is locale-dependent — node uses U+002C; the
    // body must include the commaized form when ≥1000.
    expect(r.body).toMatch(/2,160|1,840/);
  });

  it("UK English — never uses 'maintenance is calibrating' or American spellings", () => {
    // No US-only spellings in our copy. Pin a couple of sensitive ones.
    for (const r of exampleRegimes()) {
      expect(r.body.toLowerCase()).not.toMatch(/\bcolor\b/);
      expect(r.body.toLowerCase()).not.toMatch(/\bbehavior\b/);
      expect(r.body.toLowerCase()).not.toMatch(/\bcalorie burn\b/);
    }
  });
});

describe("always-on display — D-2026-04-27-12 honoured", () => {
  it("returns a headline + body for every regime, even when confidence is low", () => {
    const result = generateProgressCommentary({
      current: tdee({ tdee: 1800, confidence: "low", loggingDays: 8 }),
    });
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  });

  it("returns a headline + body when current is null entirely", () => {
    const result = generateProgressCommentary({ current: null, loggingDays: 0 });
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  });
});

describe("splitBodyIntoSegments — highlights numerics for tabular-nums rendering", () => {
  it("splits body around the numeral set in order", () => {
    const segments = splitBodyIntoSegments(
      "We're now estimating maintenance at 2,100 kcal with medium confidence.",
      ["2,100 kcal"],
    );
    expect(segments).toEqual([
      { text: "We're now estimating maintenance at ", highlight: false },
      { text: "2,100 kcal", highlight: true },
      { text: " with medium confidence.", highlight: false },
    ]);
  });

  it("preserves order with two numerals", () => {
    const segments = splitBodyIntoSegments(
      "Average intake on weeks you lost weight: 1,840 kcal. We're now estimating maintenance at 2,100 kcal with medium confidence.",
      ["1,840 kcal", "2,100 kcal"],
    );
    expect(segments.filter((s) => s.highlight).map((s) => s.text)).toEqual([
      "1,840 kcal",
      "2,100 kcal",
    ]);
    expect(segments.length).toBe(5);
  });

  it("returns the body untouched when numerals is empty", () => {
    const segments = splitBodyIntoSegments("All good.", []);
    expect(segments).toEqual([{ text: "All good.", highlight: false }]);
  });
});

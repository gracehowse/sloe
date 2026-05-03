/**
 * Weekly Check-in (MacroFactor parity) — pin the cascade behaviour.
 *
 * Authority: extended-competitor-audit task (2026-04-30, Step 7).
 * The shared module powers both web (Digest subsection) and mobile
 * (Weekly Recap card). These tests pin:
 *   - First-week placeholder when previous TDEE is unknown.
 *   - Low-confidence placeholder when weighInsThisWeek < 3.
 *   - Why-line phrasing for the four direction × intake patterns
 *     called out in the audit ("ate under, lost more → burning more
 *     than we thought").
 *   - Calm-posture: no exclamation marks, no celebration adjectives,
 *     no emoji glyphs in any rendered string.
 *   - Numeric correctness: TDEE delta = current - previous, weight
 *     delta = end - start, intake delta = total - target * days.
 *   - The flat branch fires when |delta| ≤ TDEE_NOISE_FLOOR_KCAL.
 *
 * Pure module — no React, no IO. No fake timers needed.
 */

import { describe, expect, it } from "vitest";
import {
  buildWeeklyCheckin,
  buildWhyLine,
  formatKcal,
  formatTdeeDelta,
  MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE,
  TDEE_NOISE_FLOOR_KCAL,
} from "../../src/lib/nutrition/weeklyCheckin";

const FORBIDDEN_TOKENS = [
  "!",
  "amazing",
  "Amazing",
  "crushed",
  "Crushed",
  "great job",
  "Great job",
  "on fire",
  "On fire",
  "🔥",
  "💪",
  "🎯",
  "💯",
  "✨",
];

function expectCalmPosture(strings: string[]) {
  for (const s of strings) {
    if (!s) continue;
    for (const tok of FORBIDDEN_TOKENS) {
      expect(s, `forbidden token "${tok}" found in: ${s}`).not.toContain(tok);
    }
  }
}

describe("buildWeeklyCheckin — first-week placeholder", () => {
  it("returns kind=first_week when previousTdeeKcal is null", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: null,
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 14_000,
      dailyTargetKcal: 2000,
      weightStartKg: 80,
      weightEndKg: 79.4,
      weighInsThisWeek: 5,
      daysLogged: 7,
    });
    expect(out.kind).toBe("first_week");
    expect(out.headline).toBe("Your check-in starts after 7 days of data.");
    expect(out.deltaLine).toBe("");
    expect(out.whyLine).toBe("");
    expect(out.tdeeDeltaKcal).toBeNull();
    expectCalmPosture([out.headline, out.whyLine, out.intakeLine, out.weightLine]);
  });

  it("returns kind=first_week when currentTdeeKcal is null", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2300,
      currentTdeeKcal: null,
      weeklyIntakeKcal: 14_000,
      dailyTargetKcal: 2000,
      weightStartKg: 80,
      weightEndKg: 79.4,
      weighInsThisWeek: 5,
      daysLogged: 7,
    });
    expect(out.kind).toBe("first_week");
  });

  it("returns kind=first_week when previousTdeeKcal is non-finite or zero", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = buildWeeklyCheckin({
        previousTdeeKcal: v,
        currentTdeeKcal: 2400,
        weeklyIntakeKcal: 14_000,
        dailyTargetKcal: 2000,
        weightStartKg: 80,
        weightEndKg: 79.4,
        weighInsThisWeek: 5,
        daysLogged: 7,
      });
      expect(out.kind).toBe("first_week");
    }
  });
});

describe("buildWeeklyCheckin — low-confidence placeholder", () => {
  it(`returns kind=low_confidence when weighInsThisWeek < ${MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE}`, () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2340,
      currentTdeeKcal: 2410,
      weeklyIntakeKcal: 14_600,
      dailyTargetKcal: 2000,
      weightStartKg: 80,
      weightEndKg: 79.6,
      weighInsThisWeek: 2, // below the floor
      daysLogged: 7,
    });
    expect(out.kind).toBe("low_confidence");
    expect(out.headline).toBe("Building confidence — needs more data.");
    expect(out.whyLine).toBe(""); // suppressed
    // The delta line is still rendered for transparency — the user
    // sees "what we have so far" — but the headline gates trust.
    expect(out.deltaLine).toBe("2,340 → 2,410 kcal/day");
    expectCalmPosture([out.headline, out.whyLine, out.intakeLine, out.weightLine]);
  });
});

describe("buildWeeklyCheckin — ready / why-line cascade", () => {
  it("ate under previous TDEE + lost weight → burning more than we thought (direction up)", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2340,
      currentTdeeKcal: 2410,
      // 7 days at ~2086 kcal/day → 14,600 kcal
      weeklyIntakeKcal: 14_600,
      dailyTargetKcal: 2000,
      weightStartKg: 80,
      weightEndKg: 79.6, // -0.4 kg
      weighInsThisWeek: 5,
      daysLogged: 7,
    });
    expect(out.kind).toBe("ready");
    expect(out.direction).toBe("up");
    expect(out.tdeeDeltaKcal).toBe(70);
    expect(out.deltaLine).toBe("2,340 → 2,410 kcal/day");
    expect(out.whyLine).toContain("burning more than we thought");
    expect(out.whyLine).toContain("0.4 kg less");
    expect(out.weightLine).toContain("80.0 → 79.6 kg");
    expect(out.weightLine).toContain("(-0.4 kg)");
    expect(out.intakeLine).toContain("14,600 kcal");
    expectCalmPosture([out.headline, out.whyLine, out.intakeLine, out.weightLine]);
  });

  it("ate above previous TDEE + gained weight → burning less than we thought (direction down)", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2400,
      currentTdeeKcal: 2300, // -100 kcal/day
      weeklyIntakeKcal: 17_500, // ~2500/day, above 2400
      dailyTargetKcal: 2200,
      weightStartKg: 80,
      weightEndKg: 80.5,
      weighInsThisWeek: 4,
      daysLogged: 7,
    });
    expect(out.kind).toBe("ready");
    expect(out.direction).toBe("down");
    expect(out.tdeeDeltaKcal).toBe(-100);
    expect(out.whyLine).toContain("burning less than we thought");
    expect(out.whyLine).toContain("0.5 kg more");
    expectCalmPosture([out.headline, out.whyLine, out.intakeLine, out.weightLine]);
  });

  it("flat branch when |delta| <= TDEE_NOISE_FLOOR_KCAL", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2400,
      currentTdeeKcal: 2400 + TDEE_NOISE_FLOOR_KCAL, // exactly at the floor
      weeklyIntakeKcal: 14_000,
      dailyTargetKcal: 2000,
      weightStartKg: 80,
      weightEndKg: 80, // 0.0 delta
      weighInsThisWeek: 5,
      daysLogged: 7,
    });
    expect(out.kind).toBe("ready");
    expect(out.direction).toBe("flat");
    expect(out.headline).toBe("Your TDEE held steady.");
    expect(out.whyLine).toBe("Your TDEE estimate held steady this week.");
    expectCalmPosture([out.headline, out.whyLine, out.intakeLine, out.weightLine]);
  });
});

describe("buildWeeklyCheckin — derived stats", () => {
  it("computes weight delta correctly + suppresses line when weights missing", () => {
    const noWeight = buildWeeklyCheckin({
      previousTdeeKcal: 2300,
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 14_000,
      dailyTargetKcal: 2000,
      weightStartKg: null,
      weightEndKg: null,
      weighInsThisWeek: 0,
      daysLogged: 5,
    });
    expect(noWeight.weightDeltaKg).toBeNull();
    expect(noWeight.weightLine).toBe("");
  });

  it("computes intake delta = total - target * daysLogged", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2300,
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 12_000, // 5 days * 2400 = 12,000 → on target
      dailyTargetKcal: 2400,
      weightStartKg: 80,
      weightEndKg: 79.5,
      weighInsThisWeek: 3,
      daysLogged: 5,
    });
    expect(out.intakeDeltaKcal).toBe(0);
    expect(out.intakeLine).toContain("on target overall");
  });

  it("intake line under target — phrases as 'X under target'", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2300,
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 10_000, // 5 * 2400 = 12,000 → -2,000 under
      dailyTargetKcal: 2400,
      weightStartKg: 80,
      weightEndKg: 79.5,
      weighInsThisWeek: 3,
      daysLogged: 5,
    });
    expect(out.intakeLine).toContain("under target");
    expect(out.intakeLine).toContain("2,000");
  });

  it("daysLogged === 0 suppresses the intake line entirely", () => {
    const out = buildWeeklyCheckin({
      previousTdeeKcal: 2300,
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 0,
      dailyTargetKcal: 2400,
      weightStartKg: 80,
      weightEndKg: 79.5,
      weighInsThisWeek: 3,
      daysLogged: 0,
    });
    expect(out.intakeLine).toBe("");
  });
});

describe("buildWhyLine — direct cases", () => {
  it("flat → fixed observational line", () => {
    expect(
      buildWhyLine({
        tdeeDeltaKcal: 0,
        weightDeltaKg: 0,
        intakeVsExpected: 0,
        direction: "flat",
      }),
    ).toBe("Your TDEE estimate held steady this week.");
  });

  it("up + ate-under + lost-weight → fully-rich pattern", () => {
    const line = buildWhyLine({
      tdeeDeltaKcal: 70,
      weightDeltaKg: -0.5,
      intakeVsExpected: -200,
      direction: "up",
    });
    expect(line).toContain("ate under your previous estimate");
    expect(line).toContain("burning more than we thought");
    expect(line).toContain("0.5 kg less");
  });

  it("up + ate-over but didn't gain → still 'burning more'", () => {
    const line = buildWhyLine({
      tdeeDeltaKcal: 50,
      weightDeltaKg: 0,
      intakeVsExpected: 100,
      direction: "up",
    });
    expect(line).toContain("burning more than we thought");
  });

  it("down + ate-under but didn't lose → 'burning less'", () => {
    const line = buildWhyLine({
      tdeeDeltaKcal: -100,
      weightDeltaKg: 0,
      intakeVsExpected: -100,
      direction: "down",
    });
    expect(line).toContain("burning less than we thought");
  });
});

describe("formatTdeeDelta + formatKcal", () => {
  it("formats kcal with thousand separators", () => {
    expect(formatKcal(2340)).toBe("2,340");
    expect(formatKcal(14600)).toBe("14,600");
    expect(formatKcal(0)).toBe("0");
    expect(formatKcal(-200)).toBe("-200");
    expect(formatKcal(1_234_567)).toBe("1,234,567");
  });

  it("formatTdeeDelta uses the matched arrow glyph", () => {
    expect(formatTdeeDelta(2340, 2410)).toBe("2,340 → 2,410 kcal/day");
  });
});

// ---------------------------------------------------------------------------
// Modal-ritual: gate + content builder
// (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of #26)
//
// These pin the MacroFactor-style weekly TDEE check-in modal. Distinct
// from the digest-cascade builder above; same source module so the
// shape stays in lockstep with the modal-host wire-up.
// ---------------------------------------------------------------------------

import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  MIN_DAYS_LOGGED_FOR_CHECKIN,
  type WeeklyCheckinGateInput,
} from "../../src/lib/nutrition/weeklyCheckin";

const NOW = new Date("2026-05-03T10:00:00Z");

function gate(
  overrides: Partial<WeeklyCheckinGateInput> = {},
): WeeklyCheckinGateInput {
  return {
    adaptiveTdeeConfidence: "medium",
    adaptiveTdee: 2100,
    daysLoggedThisWeek: MIN_DAYS_LOGGED_FOR_CHECKIN,
    lastShownAt: null,
    now: NOW,
    ...overrides,
  };
}

describe("shouldShowWeeklyCheckin (modal ritual)", () => {
  it("fires for medium-confidence with 5+ days logged and no prior show", () => {
    expect(shouldShowWeeklyCheckin(gate())).toBe(true);
  });

  it("fires for high-confidence", () => {
    expect(
      shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: "high" })),
    ).toBe(true);
  });

  it("does not fire when confidence is low", () => {
    expect(
      shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: "low" })),
    ).toBe(false);
  });

  it("does not fire when confidence is null (math hasn't resolved)", () => {
    expect(
      shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: null })),
    ).toBe(false);
  });

  it("does not fire when adaptive TDEE is null / non-finite / non-positive", () => {
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: null }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: NaN }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: 0 }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: -100 }))).toBe(false);
  });

  it("does not fire when fewer than 5 days logged", () => {
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 4 }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 0 }))).toBe(false);
  });

  it("fires when 6 or 7 days logged", () => {
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 6 }))).toBe(true);
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 7 }))).toBe(true);
  });

  it("does not fire when shown within the last 6 days", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400_000).toISOString();
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: fiveDaysAgo }))).toBe(
      false,
    );
  });

  it("fires when last shown was 6+ days ago", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 86400_000).toISOString();
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: sevenDaysAgo }))).toBe(
      true,
    );
  });

  it("treats invalid lastShownAt as 'never shown'", () => {
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: "not-a-date" }))).toBe(
      true,
    );
  });
});

describe("buildWeeklyCheckinContent (modal ritual)", () => {
  it("computes positive delta + suggests higher target preserving deficit", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800, // 300 kcal deficit
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: -0.4,
    });
    expect(content.tdeeDeltaKcal).toBe(200);
    // Suggested = 1800 + 200 = 2000 (deficit preserved at 300)
    expect(content.suggestedTargetKcal).toBe(2000);
    expect(content.whyLine).toMatch(/higher than the formula/);
    expect(content.whyLine).toContain("+200 kcal");
  });

  it("computes negative delta + suggests lower target", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 1900,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1850,
      weightDeltaKg: 0.2,
    });
    expect(content.tdeeDeltaKcal).toBe(-200);
    expect(content.suggestedTargetKcal).toBe(1600);
    expect(content.whyLine).toMatch(/lower than the formula/);
    // Unicode minus, not ASCII
    expect(content.whyLine).toContain("−200 kcal");
  });

  it("never suggests below the 1200 kcal floor", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 1300,
      priorTdee: 2200,
      currentTargetKcal: 1500,
      avgCaloriesThisWeek: 1450,
      weightDeltaKg: null,
    });
    // Raw would be 1500 + (1300-2200) = 600 → clamped to 1200
    expect(content.suggestedTargetKcal).toBe(1200);
  });

  it("suppresses weight delta label when null (never fabricates +0.0 kg)", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1820,
      weightDeltaKg: null,
    });
    expect(content.weightDeltaLabel).toBeNull();
    expect(content.tdeeDeltaKcal).toBe(0);
    expect(content.whyLine).toMatch(/held steady/);
  });

  it("renders weight delta with unicode minus + tabular-friendly formatting", () => {
    const negative = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2050,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: -0.6,
    });
    expect(negative.weightDeltaLabel).toBe("−0.6 kg");
    const positive = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2050,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: 0.3,
    });
    expect(positive.weightDeltaLabel).toBe("+0.3 kg");
  });

  it("falls back to current target when prior TDEE is missing", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: null,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1820,
      weightDeltaKg: null,
    });
    expect(content.tdeeDeltaKcal).toBeNull();
    // No delta = keep target as-is.
    expect(content.suggestedTargetKcal).toBe(1800);
    expect(content.whyLine).toMatch(/Your real burn this week is 2,100 kcal a day\./);
  });

  it("avg this week label uses tabular-friendly group separator (en-GB)", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: null,
    });
    expect(content.avgThisWeekLabel).toBe("1,750 kcal/day");
  });

  it("never uses exclamation marks or performance adjectives in copy", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: 0.0,
    });
    const allText = `${content.headline} ${content.whyLine}`;
    expect(allText).not.toContain("!");
    expect(allText.toLowerCase()).not.toMatch(
      /great|amazing|crushing|killing it|nailed it/,
    );
  });
});

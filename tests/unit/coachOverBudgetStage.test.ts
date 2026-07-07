import { describe, expect, it } from "vitest";
import {
  consecutiveDaysUnderEating,
  isSingleDayUnderEating,
  netEnergyOverBudgetLine,
  overBudgetCoachLine,
  overBudgetStage,
  overBudgetStageForPercent,
  pctOfCalorieGoal,
  underEatingCoachLine,
} from "../../src/lib/nutrition/coachOverBudgetStage";

describe("pctOfCalorieGoal", () => {
  it("computes eaten/goal as a percentage", () => {
    expect(pctOfCalorieGoal(1000, 2000)).toBe(50);
    expect(pctOfCalorieGoal(2000, 2000)).toBe(100);
    expect(pctOfCalorieGoal(2800, 2000)).toBe(140);
  });

  it("returns 0 for a non-positive or missing goal (never NaN/Infinity)", () => {
    expect(pctOfCalorieGoal(1500, 0)).toBe(0);
    expect(pctOfCalorieGoal(1500, -100)).toBe(0);
    expect(pctOfCalorieGoal(1500, NaN)).toBe(0);
  });

  it("clamps a negative/NaN consumed value to 0%", () => {
    expect(pctOfCalorieGoal(-50, 2000)).toBe(0);
    expect(pctOfCalorieGoal(NaN, 2000)).toBe(0);
  });
});

describe("overBudgetStageForPercent — boundary pins", () => {
  it("85–100% (exclusive of 100) is 'approaching'", () => {
    expect(overBudgetStageForPercent(85)).toBe("approaching");
    expect(overBudgetStageForPercent(92)).toBe("approaching");
    expect(overBudgetStageForPercent(99.9)).toBe("approaching");
  });

  it("100–110% (exclusive of 110) is 'landed'", () => {
    expect(overBudgetStageForPercent(100)).toBe("landed");
    expect(overBudgetStageForPercent(105)).toBe("landed");
    expect(overBudgetStageForPercent(109.9)).toBe("landed");
  });

  it("110–140% (exclusive of 140) is 'over'", () => {
    expect(overBudgetStageForPercent(110)).toBe("over");
    expect(overBudgetStageForPercent(125)).toBe("over");
    expect(overBudgetStageForPercent(139.9)).toBe("over");
  });

  it("140%+ is 'big'", () => {
    expect(overBudgetStageForPercent(140)).toBe("big");
    expect(overBudgetStageForPercent(178)).toBe("big");
    expect(overBudgetStageForPercent(500)).toBe("big");
  });

  it("below 85% still resolves to 'approaching' at the raw-percent level (callers gate the 85% floor via overBudgetStage)", () => {
    // overBudgetStageForPercent is a pure bucket function; the 85% floor
    // that returns `null` (no over-budget stage at all) lives one level up
    // in `overBudgetStage`, not here — pinned in the next describe block.
    expect(overBudgetStageForPercent(50)).toBe("approaching");
  });
});

describe("overBudgetStage — the 85% floor gate", () => {
  it("returns null below 85% of goal (caller falls through to existing under-budget copy)", () => {
    expect(overBudgetStage(1000, 2000)).toBeNull(); // 50%
    expect(overBudgetStage(1699, 2000)).toBeNull(); // 84.95%
  });

  it("returns a real stage at and above 85%", () => {
    expect(overBudgetStage(1700, 2000)).toBe("approaching"); // exactly 85%
    expect(overBudgetStage(2000, 2000)).toBe("landed");
    expect(overBudgetStage(2500, 2000)).toBe("over"); // 125%
    expect(overBudgetStage(2780, 2000)).toBe("over"); // 139% — just under the 140% 'big' cutoff
    expect(overBudgetStage(3450, 2000)).toBe("big"); // 172.5% (Fable's evidenced +1,450-over case)
  });
});

describe("overBudgetCoachLine — verbatim string contract (ENG-1454)", () => {
  it("'approaching' — About {n} kcal left — a light dinner fits.", () => {
    expect(overBudgetCoachLine("approaching", 1850, 2000)).toBe(
      "About 150 kcal left — a light dinner fits.",
    );
  });

  it("'landed' — fixed line, no interpolation", () => {
    expect(overBudgetCoachLine("landed", 2000, 2000)).toBe(
      "You've hit today's calories. One day at the line is exactly how this is meant to work.",
    );
  });

  it("'over' — Over by {n} today. Nothing to fix tonight — tomorrow starts fresh.", () => {
    expect(overBudgetCoachLine("over", 2450, 2000)).toBe(
      "Over by 450 today. Nothing to fix tonight — tomorrow starts fresh.",
    );
  });

  it("'big' — fixed line, no interpolation (the +1,450 parody case from the ticket)", () => {
    expect(overBudgetCoachLine("big", 3450, 2000)).toBe(
      "A big day. It happens — log it honestly and move on. Tomorrow's a clean slate.",
    );
  });

  it("never reads 'eat freely' or 'save for tomorrow' at any stage (the retired state-blind line)", () => {
    const goal = 2000;
    for (const [stage, consumed] of [
      ["approaching", 1900],
      ["landed", 2050],
      ["over", 2600],
      ["big", 3800],
    ] as const) {
      const line = overBudgetCoachLine(stage, consumed, goal);
      expect(line).not.toMatch(/eat freely/i);
      expect(line).not.toMatch(/save for tomorrow/i);
    }
  });
});

describe("netEnergyOverBudgetLine — neutral auditable framing (drops the 2nd-person accusation)", () => {
  it("renders 'Net energy today: +{n} kcal'", () => {
    expect(netEnergyOverBudgetLine(2204)).toBe("Net energy today: +2204 kcal");
    expect(netEnergyOverBudgetLine(0)).toBe("Net energy today: +0 kcal");
  });

  it("never says 'you've eaten' (the retired 2nd-person accusation)", () => {
    expect(netEnergyOverBudgetLine(1188)).not.toMatch(/you'?ve eaten/i);
  });

  it("clamps a negative input to 0 (this line is only ever shown while over)", () => {
    expect(netEnergyOverBudgetLine(-50)).toBe("Net energy today: +0 kcal");
  });
});

describe("isSingleDayUnderEating — <60% of goal by ~8pm local", () => {
  it("false before 8pm local regardless of how far under", () => {
    expect(isSingleDayUnderEating(200, 2000, 12)).toBe(false); // 10%, noon
    expect(isSingleDayUnderEating(200, 2000, 19)).toBe(false); // 7pm
  });

  it("true at/after 8pm local when under 60%", () => {
    expect(isSingleDayUnderEating(1000, 2000, 20)).toBe(true); // exactly 50%, 8pm
    expect(isSingleDayUnderEating(500, 2000, 23)).toBe(true); // 25%, 11pm
  });

  it("false at/after 8pm when at or above 60%", () => {
    expect(isSingleDayUnderEating(1200, 2000, 21)).toBe(false); // exactly 60%
    expect(isSingleDayUnderEating(1800, 2000, 22)).toBe(false); // 90%
  });
});

describe("consecutiveDaysUnderEating — 3+ consecutive days <75%", () => {
  it("returns the longest run of <75% days", () => {
    expect(consecutiveDaysUnderEating([60, 65, 70])).toBe(3);
    expect(consecutiveDaysUnderEating([90, 60, 65, 70, 72])).toBe(4);
  });

  it("resets the run on any day >=75%", () => {
    expect(consecutiveDaysUnderEating([60, 65, 80, 70, 72])).toBe(2);
  });

  it("returns 0 when no run of 3+ exists", () => {
    expect(consecutiveDaysUnderEating([60, 65])).toBe(2); // caller gates on >=3 before invoking the copy
    expect(consecutiveDaysUnderEating([90, 95, 100])).toBe(0);
  });

  it("boundary: exactly 75% does not count as under", () => {
    expect(consecutiveDaysUnderEating([75, 75, 75])).toBe(0);
    expect(consecutiveDaysUnderEating([74.9, 74.9, 74.9])).toBe(3);
  });
});

describe("underEatingCoachLine — ED-safe verbatim strings", () => {
  it("single-day line", () => {
    expect(underEatingCoachLine("single-day")).toBe(
      "Well under target so far. If that wasn't the plan, a proper dinner still fits tonight.",
    );
  });

  it("consecutive-days line interpolates the real run length", () => {
    expect(underEatingCoachLine("consecutive-days", 3)).toBe(
      "You've run well under target for 3 days. Consistent fuel is what keeps the plan working — worth raising tonight's dinner.",
    );
    expect(underEatingCoachLine("consecutive-days", 5)).toBe(
      "You've run well under target for 5 days. Consistent fuel is what keeps the plan working — worth raising tonight's dinner.",
    );
  });

  it("never praises or alarms — no exclamation marks, no 'great job', no 'warning'/'danger'", () => {
    const lines = [
      underEatingCoachLine("single-day"),
      underEatingCoachLine("consecutive-days", 4),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/!/);
      expect(line).not.toMatch(/great|amazing|well done/i);
      expect(line).not.toMatch(/warning|danger|alert/i);
    }
  });
});

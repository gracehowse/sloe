/**
 * whyThisNumber — pin the "why is my target X kcal?" breakdown.
 *
 * The sheet renders the rows produced here verbatim; if a label moves,
 * a colour ramp shifts, or the deficit math drifts, this test catches
 * it. Same helper backs mobile + web — one test pins both.
 */
import { describe, expect, it } from "vitest";
import {
  buildStoryBeats,
  buildWhyThisNumber,
  paceKgPerWeekFromPreset,
} from "../../src/lib/nutrition/whyThisNumber";

describe("paceKgPerWeekFromPreset", () => {
  it("maps every legacy preset to its canonical magnitude", () => {
    expect(paceKgPerWeekFromPreset("relaxed", "lose")).toBe(-0.25);
    expect(paceKgPerWeekFromPreset("steady", "lose")).toBe(-0.5);
    expect(paceKgPerWeekFromPreset("accelerated", "lose")).toBe(-0.75);
    expect(paceKgPerWeekFromPreset("vigorous", "lose")).toBe(-1.0);
  });

  it("flips sign for gain goals", () => {
    expect(paceKgPerWeekFromPreset("relaxed", "gain")).toBe(0.25);
    expect(paceKgPerWeekFromPreset("vigorous", "gain")).toBe(1.0);
  });

  it("returns 0 for maintain goal regardless of preset", () => {
    expect(paceKgPerWeekFromPreset("steady", "maintain")).toBe(0);
    expect(paceKgPerWeekFromPreset(null, "maintain")).toBe(0);
  });

  it("returns null for unknown / null presets on lose / gain goals", () => {
    // Distinguishes "user picked Maintain explicitly" (=0) from "user
    // hasn't picked a pace yet" (=null). The renderer surfaces the
    // null case as "Goal not set" rather than mislabelling Maintain.
    expect(paceKgPerWeekFromPreset(null, "lose")).toBeNull();
    expect(paceKgPerWeekFromPreset("frenetic", "lose")).toBeNull();
    expect(paceKgPerWeekFromPreset(undefined, "gain")).toBeNull();
  });
});

describe("buildWhyThisNumber", () => {
  it("renders the canonical 3-row breakdown for a steady weight-loss user", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 21,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.targetHeadline).toBe("Today's target: 1,800 kcal");
    expect(r.lines).toHaveLength(3);
    // loggingDays: 21 is supplied → the qualifier names the gated count.
    expect(r.lines[0]).toEqual({
      key: "tdee",
      label: "Maintenance (TDEE)",
      value: "2,150 kcal (learned from your 21 fully-logged days)",
    });
    expect(r.lines[1]).toEqual({
      key: "goal",
      label: "Goal",
      value: "Lose 0.5 kg/wk",
    });
    expect(r.lines[2]).toEqual({
      key: "result",
      label: "Result",
      value: "−350 kcal/day deficit",
    });
    expect(r.isEarlyEstimate).toBe(false);
    expect(r.calibratingAsk).toBeNull();
  });

  it("uses count-free TDEE copy when loggingDays is unknown but an estimate exists", () => {
    // No loggingDays supplied (null) + high confidence → not early, but we
    // can't name a gated day count, so the qualifier stays count-free.
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("2,150 kcal (learned from your logging)");
    expect(r.isEarlyEstimate).toBe(false);
  });

  it("flags early estimate when loggingDays < 14", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 10,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("~2,150 kcal (early estimate)");
    expect(r.isEarlyEstimate).toBe(true);
  });

  it("flags early estimate when confidence is low even with enough days", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "low",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("~2,150 kcal (early estimate)");
    expect(r.isEarlyEstimate).toBe(true);
  });

  it("renders calibrating copy when no TDEE estimate exists", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      loggingDays: 3,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[0].value).toBe("calibrating — keep logging");
    // Result row falls back to the pace-implied deficit.
    expect(r.lines[2].value).toMatch(/^−550 kcal\/day deficit \(target\)$/);
    expect(r.summary).toContain("still calibrating");
  });

  it("renders a surplus row for a gaining user — Goal pace derived from the budget (ENG-1025)", () => {
    // ENG-1025: the Goal row must reflect the EFFECTIVE pace the budget
    // delivers, not the nominal preset. Here maintenance=2400, target=2700
    // → +300/day surplus → 300 / (7700/7) ≈ 0.273 kg/wk → "Gain 0.25 kg/wk"
    // (rounded to the 0.05 display step). The caller still passes the
    // nominal preset (+0.5 here); the explainer ignores it and reads the
    // budget so the Goal row and the Result row can never disagree by 2×.
    const r = buildWhyThisNumber({
      targetCalories: 2700,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "gain",
      paceKgPerWeek: 0.5, // nominal "steady" — NOT echoed; budget wins
    });
    expect(r.lines[1].value).toBe("Gain 0.25 kg/wk");
    expect(r.lines[2].value).toBe("+300 kcal/day surplus");
    // Parity guard: the surplus the Result row names corresponds to the
    // pace the Goal row shows (no 2× drift).
    expect(r.summary).toContain("gain 0.25 kg/wk");
  });

  it("renders maintain copy when goal=maintain", () => {
    const r = buildWhyThisNumber({
      targetCalories: 2400,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "maintain",
      paceKgPerWeek: 0,
    });
    expect(r.lines[1].value).toBe("Maintain");
    expect(r.lines[2].value).toBe("no deficit (maintaining)");
  });

  it("collapses paceKg=0 to maintain even when goal!=maintain (paused plan)", () => {
    const r = buildWhyThisNumber({
      targetCalories: 2400,
      maintenanceTdee: 2400,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: 0,
    });
    expect(r.lines[1].value).toBe("Maintain");
  });

  it("formats pace fractions cleanly (0.5, 0.25, 0.75)", () => {
    const half = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(half.lines[1].value).toBe("Lose 0.5 kg/wk");

    const quarter = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.25,
    });
    expect(quarter.lines[1].value).toBe("Lose 0.25 kg/wk");

    const threeQuarter = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.75,
    });
    expect(threeQuarter.lines[1].value).toBe("Lose 0.75 kg/wk");
  });

  it("rounds the kcal delta to whole numbers", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1850,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.lines[2].value).toBe("−300 kcal/day deficit");
  });

  it("uses thousand separators for both target and TDEE figures", () => {
    const r = buildWhyThisNumber({
      targetCalories: 3500,
      maintenanceTdee: 4100,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.targetHeadline).toBe("Today's target: 3,500 kcal");
    expect(r.lines[0].value).toContain("4,100 kcal");
  });

  it("summary names the direction (below / above / at maintenance)", () => {
    const below = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(below.summary).toContain("below");

    const above = buildWhyThisNumber({
      targetCalories: 2500,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "gain",
      paceKgPerWeek: 0.25,
    });
    expect(above.summary).toContain("above");

    const at = buildWhyThisNumber({
      targetCalories: 2150,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 30,
      goal: "maintain",
      paceKgPerWeek: 0,
    });
    expect(at.summary).toContain("at your estimated maintenance");
  });

  // ---- Failure 1 (TestFlight feedback 2026-05-02) -----------------
  // "this is wildly incorrect" / "I'm not maintaining" — the panel
  // mislabelled a lose user as Maintain because plan_pace was unset.
  // Distinguish "Goal not set" (paceKgPerWeek=null) from explicit
  // Maintain (paceKgPerWeek=0).
  it("renders 'Goal not set' when paceKgPerWeek is null", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 30,
      goal: "lose",
      paceKgPerWeek: null,
    });
    expect(r.lines[1].value).toBe("Goal not set");
  });

  it("does NOT mislabel a lose-goal user as Maintain when pace is null", () => {
    // Regression for TestFlight feedback 2026-05-02: panel showed
    // "Goal: Maintain" for a user who explicitly chose lose. The
    // helper used to fold paceKg===0 into "Maintain" — but the caller
    // was passing 0 even when the source preset was unknown.
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      loggingDays: 40,
      goal: "lose",
      paceKgPerWeek: null,
    });
    expect(r.lines[1].value).not.toBe("Maintain");
    expect(r.lines[1].value).toBe("Goal not set");
    // And the result row must not lie about "no deficit".
    expect(r.lines[2].value).not.toBe("no deficit (maintaining)");
    expect(r.lines[2].value).toBe("—");
  });

  // ---- Failure 2 (TestFlight feedback 2026-05-02) -----------------
  // "40 days of logging but still calibrating" — the gate also needs
  // 3+ weight logs, but the panel didn't say so. Render a SPECIFIC
  // ask telling the user what to do.
  it("renders a specific 'log weight 3+ times' ask when only weights are missing", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 40,
      weightLogCount: 0,
    });
    expect(r.calibratingAsk).toContain("Log your weight 3+ times");
    expect(r.calibratingAsk).toContain("based on your stated goal");
    expect(r.calibratingAsk).not.toContain("Keep logging meals");
  });

  it("renders a specific 'keep logging meals' ask when only meals are short", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 4,
      weightLogCount: 5,
    });
    expect(r.calibratingAsk).toContain("Keep logging meals");
    expect(r.calibratingAsk).toContain("after 7 days");
    expect(r.calibratingAsk).not.toContain("Log your weight");
  });

  it("lists BOTH asks when neither gate has fired", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 2,
      weightLogCount: 0,
    });
    expect(r.calibratingAsk).toContain("Log your weight");
    expect(r.calibratingAsk).toContain("Keep logging meals");
  });

  it("does NOT render an ask once both gates are satisfied (transient null TDEE)", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 14,
      weightLogCount: 5,
    });
    expect(r.calibratingAsk).toBeNull();
  });

  it("falls back to the generic line when caller didn't supply counts", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    expect(r.calibratingAsk).toBeNull();
    expect(r.summary).toContain("still calibrating");
  });

  it("lifts the specific ask into the summary so screen readers announce it", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 40,
      weightLogCount: 0,
    });
    expect(r.summary).toContain("Log your weight 3+ times");
  });

  // ---- Failure 3 — fixture from spec ------------------------------
  // weekly_pace_kg = -0.5, meal_log_days = 40, weight_logs = 0
  it("renders all three rows correctly for the verbatim spec fixture", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: null,
      confidence: null,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 40,
      weightLogCount: 0,
    });
    // TDEE row: still calibrating but renders the SPECIFIC ask.
    expect(r.lines[0].value).toBe("calibrating — keep logging");
    expect(r.calibratingAsk).toContain("Log your weight 3+ times");
    // Goal row: actual goal preserved (Lose 0.5 kg/wk), not Maintain.
    expect(r.lines[1].value).toBe("Lose 0.5 kg/wk");
    // Result row: implied deficit from pace, not lying "no deficit".
    expect(r.lines[2].value).toBe("−550 kcal/day deficit (target)");
  });

  it("renders the actual TDEE row once 3+ weight logs + 14+ meal log days are present", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "medium",
      loggingDays: 14,
      goal: "lose",
      paceKgPerWeek: -0.5,
      mealLogDays: 14,
      weightLogCount: 3,
    });
    // No longer calibrating — actual computed value renders. loggingDays
    // (14) is the gated complete-day count, so the qualifier names it.
    expect(r.lines[0].value).toBe(
      "2,150 kcal (learned from your 14 fully-logged days)",
    );
    expect(r.calibratingAsk).toBeNull();
  });

  // ---- Story beats — the "how we work this out" architecture ---------
  // The four-layer maintenance story (2026-06-10 adaptive-TDEE decision)
  // must be present on the result so the sheet/dialog can render it.
  it("attaches the architecture story beats to every result", () => {
    const r = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 21,
      goal: "lose",
      paceKgPerWeek: -0.5,
    });
    const keys = r.storyBeats.map((b) => b.key);
    // No wearable supplied → seed, learn, gate, range (no watch beat).
    expect(keys).toEqual(["seed", "learn", "gate", "range"]);
  });

  it("includes the watch beat only when hasWearable is true", () => {
    const withWatch = buildWhyThisNumber({
      targetCalories: 1800,
      maintenanceTdee: 2150,
      confidence: "high",
      loggingDays: 21,
      goal: "lose",
      paceKgPerWeek: -0.5,
      hasWearable: true,
    });
    expect(withWatch.storyBeats.map((b) => b.key)).toEqual([
      "seed",
      "learn",
      "gate",
      "watch",
      "range",
    ]);
    const watch = withWatch.storyBeats.find((b) => b.key === "watch")!;
    // The watch beat must name all three of its roles and the caveat.
    expect(watch.text).toContain("today's budget");
    expect(watch.text).toContain("sanity check");
    expect(watch.text).toContain("baseline");
    expect(watch.text).toContain("least reliable");
  });
});

describe("buildStoryBeats", () => {
  it("frames the learn beat as present-tense + goal-based when no estimate yet", () => {
    const beats = buildStoryBeats({
      maintenanceTdee: null,
      loggingDays: null,
      hasWearable: false,
    });
    const learn = beats.find((b) => b.key === "learn")!;
    expect(learn.text).toContain("As you log meals and weigh in");
    expect(learn.text).toContain("based on your stated goal");
  });

  it("names the gated complete-day count in the learn beat once we have an estimate", () => {
    const beats = buildStoryBeats({
      maintenanceTdee: 2150,
      loggingDays: 9,
      hasWearable: false,
    });
    const learn = beats.find((b) => b.key === "learn")!;
    expect(learn.text).toContain("learned from your 9 fully-logged days");
  });

  it("falls back to count-free learn copy when loggingDays is unknown", () => {
    const beats = buildStoryBeats({
      maintenanceTdee: 2150,
      loggingDays: null,
      hasWearable: false,
    });
    const learn = beats.find((b) => b.key === "learn")!;
    expect(learn.text).toContain("Then we learn from what you actually log");
    expect(learn.text).not.toContain("fully-logged days");
  });

  it("the gate beat always states the forgotten-dinner protection (the 'why')", () => {
    const beats = buildStoryBeats({
      maintenanceTdee: null,
      loggingDays: null,
      hasWearable: false,
    });
    const gate = beats.find((b) => b.key === "gate")!;
    expect(gate.text).toContain("partly logged");
    expect(gate.text).toContain("forgotten dinner");
    expect(gate.text).toContain("drag your number down");
  });

  it("the range beat reassures the number stays within a sensible range", () => {
    const beats = buildStoryBeats({
      maintenanceTdee: 2150,
      loggingDays: 21,
      hasWearable: false,
    });
    const range = beats.find((b) => b.key === "range")!;
    expect(range.text).toContain("updates gradually");
    expect(range.text).toContain("sensible range");
  });

  it("contains no medical claims, guarantees, or shaming language", () => {
    const allText = [
      ...buildStoryBeats({ maintenanceTdee: 2150, loggingDays: 21, hasWearable: true }),
      ...buildStoryBeats({ maintenanceTdee: null, loggingDays: null, hasWearable: false }),
    ]
      .map((b) => b.text)
      .join(" ")
      .toLowerCase();
    for (const banned of [
      "guarantee",
      "guaranteed",
      "cure",
      "diagnos",
      "you should eat",
      "lose weight fast",
    ]) {
      expect(allText).not.toContain(banned);
    }
  });
});

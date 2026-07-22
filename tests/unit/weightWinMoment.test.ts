/**
 * ENG-824 (Redesign — Design Direction 2026, 2026-05-31 design-director
 * review) — the shared new-weight-low landmark detector.
 *
 * Pure-logic unit tests for `isNewWeightLow` / `priorLowestKg`. The win-moment
 * is RESERVED for genuine landmarks, so the edge contract matters: a re-save
 * that doesn't beat the low, and the first-ever weigh-in, must NOT fire; only a
 * strict new low does. Web + mobile both consume this exact function so they
 * celebrate on identical conditions — this test is the single source of truth
 * for those conditions.
 */
import { describe, expect, it } from "vitest";

import {
  isNewWeightLow,
  priorLowestKg,
  NEW_LOW_EPSILON_KG,
  computeWeightMilestone,
  MILESTONE_COUNT,
  MILESTONE_MIN_SPAN_KG,
  resolveWeightSaveCelebration,
} from "../../src/lib/nutrition/weightWinMoment";

const TODAY = "2026-05-31";

describe("priorLowestKg", () => {
  it("returns the minimum positive weight, excluding the written date", () => {
    const map = { "2026-05-28": 80, "2026-05-29": 78.5, "2026-05-30": 79 };
    expect(priorLowestKg(map, TODAY)).toBe(78.5);
  });

  it("excludes the target date so an edit isn't compared to its own stale value", () => {
    // The date being written holds a stale low; it must not count as the prior
    // minimum (otherwise correcting today's value down could never be a low,
    // and correcting it up could spuriously read the old value as the floor).
    const map = { "2026-05-29": 80, [TODAY]: 70 };
    expect(priorLowestKg(map, TODAY)).toBe(80);
  });

  it("ignores zero / negative / non-finite values", () => {
    const map = { a: 0, b: -5, c: Number.NaN, d: 77 };
    expect(priorLowestKg(map, TODAY)).toBe(77);
  });

  it("returns null when there is no prior baseline", () => {
    expect(priorLowestKg({}, TODAY)).toBeNull();
    expect(priorLowestKg({ [TODAY]: 75 }, TODAY)).toBeNull();
  });
});

describe("isNewWeightLow", () => {
  it("fires when the saved weight is strictly below the prior minimum", () => {
    expect(
      isNewWeightLow({
        savedKg: 77.0,
        priorByDay: { "2026-05-29": 78.5, "2026-05-30": 79 },
        targetDateKey: TODAY,
      }),
    ).toBe(true);
  });

  it("does NOT fire on the first-ever weigh-in (no baseline to beat)", () => {
    expect(
      isNewWeightLow({ savedKg: 75, priorByDay: {}, targetDateKey: TODAY }),
    ).toBe(false);
  });

  it("does NOT fire when re-saving a value that ties or exceeds the prior low", () => {
    const priorByDay = { "2026-05-29": 78, "2026-05-30": 78.5 };
    // Equal to the low — not a new low.
    expect(isNewWeightLow({ savedKg: 78, priorByDay, targetDateKey: TODAY })).toBe(false);
    // Above the low — not a new low.
    expect(isNewWeightLow({ savedKg: 80, priorByDay, targetDateKey: TODAY })).toBe(false);
  });

  it("does NOT fire for a sub-epsilon improvement (guards kg↔lb round-trip dither)", () => {
    const priorByDay = { "2026-05-30": 78.0 };
    // 78.0 - 78.0 + tiny float noise: just inside the epsilon → no celebration.
    expect(
      isNewWeightLow({
        savedKg: 78.0 - NEW_LOW_EPSILON_KG / 2,
        priorByDay,
        targetDateKey: TODAY,
      }),
    ).toBe(false);
  });

  it("fires for an improvement larger than the epsilon", () => {
    const priorByDay = { "2026-05-30": 78.0 };
    expect(
      isNewWeightLow({
        savedKg: 78.0 - NEW_LOW_EPSILON_KG * 2,
        priorByDay,
        targetDateKey: TODAY,
      }),
    ).toBe(true);
  });

  it("judges an edit of today's entry against the rest of history, not itself", () => {
    // Today already holds 76 (a prior low for the day). Correcting it DOWN to
    // 74 beats the other days' minimum (75) → new low. Correcting it UP to 80
    // does not.
    const priorByDay = { "2026-05-29": 75, "2026-05-30": 76, [TODAY]: 76 };
    expect(isNewWeightLow({ savedKg: 74, priorByDay, targetDateKey: TODAY })).toBe(true);
    expect(isNewWeightLow({ savedKg: 80, priorByDay, targetDateKey: TODAY })).toBe(false);
  });

  it("rejects non-positive / non-finite saved values", () => {
    const priorByDay = { "2026-05-30": 78 };
    expect(isNewWeightLow({ savedKg: 0, priorByDay, targetDateKey: TODAY })).toBe(false);
    expect(isNewWeightLow({ savedKg: -1, priorByDay, targetDateKey: TODAY })).toBe(false);
    expect(isNewWeightLow({ savedKg: Number.NaN, priorByDay, targetDateKey: TODAY })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ENG-952 — the QUIETER milestone-crossing tier (`computeWeightMilestone`).
//
// A goal is divided into MILESTONE_COUNT (10) evenly spaced thresholds from the
// journey start to the goal. The quiet celebration fires only when a save
// advances the reached-milestone index past where the most recent prior
// weigh-in sat (a genuine crossing) — never on a re-save inside the same band,
// never on the first ever weigh-in (no prior to cross), and never on the goal
// milestone (index 10, which the loud goal-hit surface owns). Web + mobile both
// compute on these exact thresholds.
// ─────────────────────────────────────────────────────────────────────────
describe("computeWeightMilestone (ENG-952)", () => {
  // Start 80 kg → goal 70 kg: 10 kg span, 10 milestones of 1 kg each →
  // thresholds 79, 78, …, 70 (index 10 = the goal).
  const START = 80;
  const GOAL = 70;

  it("derives 10 evenly spaced thresholds from start → goal (goal is the 10th)", () => {
    const r = computeWeightMilestone({
      savedKg: 75,
      priorByDay: { "2026-05-25": 76 },
      targetDateKey: TODAY,
      goalKg: GOAL,
      startKg: START,
    });
    expect(r.thresholds).toHaveLength(MILESTONE_COUNT);
    expect(r.thresholds).toEqual([79, 78, 77, 76, 75, 74, 73, 72, 71, 70]);
    expect(r.thresholds[MILESTONE_COUNT - 1]).toBe(GOAL);
  });

  it("fires the quiet tier when a save CROSSES into a new milestone band", () => {
    // Prior latest 76.4 kg → reached floor((76.4-80)/(70-80)*10) = floor(3.6) = 3.
    // Saving 75.4 kg → floor(4.6) = 4 → advanced past band 3 → crossed ordinal 4.
    const r = computeWeightMilestone({
      savedKg: 75.4,
      priorByDay: { "2026-05-20": 80, "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: GOAL,
      startKg: START,
    });
    expect(r.reachedIndex).toBe(4);
    expect(r.crossedMilestone).toBe(true);
    expect(r.crossedOrdinal).toBe(4);
  });

  it("does NOT fire when the save stays inside the same milestone band", () => {
    // Prior latest 76.4 (band 3); saving 76.2 → floor(3.8) = 3 → no advance.
    const r = computeWeightMilestone({
      savedKg: 76.2,
      priorByDay: { "2026-05-20": 80, "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: GOAL,
      startKg: START,
    });
    expect(r.reachedIndex).toBe(3);
    expect(r.crossedMilestone).toBe(false);
    expect(r.crossedOrdinal).toBeNull();
  });

  it("does NOT fire the quiet tier for the goal milestone itself (index 10 belongs to the loud moment)", () => {
    const r = computeWeightMilestone({
      savedKg: 69.0, // at/below goal → reachedIndex clamps to 10
      priorByDay: { "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: GOAL,
      startKg: START,
    });
    expect(r.reachedIndex).toBe(MILESTONE_COUNT);
    expect(r.crossedMilestone).toBe(false);
    expect(r.crossedOrdinal).toBeNull();
  });

  it("does NOT fire on the first-ever weigh-in (no prior band to cross)", () => {
    const r = computeWeightMilestone({
      savedKg: 75,
      priorByDay: {},
      targetDateKey: TODAY,
      goalKg: GOAL,
      startKg: START,
    });
    // Thresholds still resolve from the explicit start anchor, but with no prior
    // weigh-in there is no crossing — the first save establishes the baseline.
    expect(r.thresholds).toHaveLength(MILESTONE_COUNT);
    expect(r.crossedMilestone).toBe(false);
    expect(r.crossedOrdinal).toBeNull();
  });

  it("anchors the breakdown to the earliest weigh-in when no explicit startKg is given", () => {
    // Earliest prior 80 kg is the start anchor; goal 70 → same thresholds.
    const r = computeWeightMilestone({
      savedKg: 75.4,
      priorByDay: { "2026-05-01": 80, "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: GOAL,
    });
    expect(r.thresholds[0]).toBe(79);
    expect(r.thresholds[MILESTONE_COUNT - 1]).toBe(GOAL);
    expect(r.crossedMilestone).toBe(true);
    expect(r.crossedOrdinal).toBe(4);
  });

  it("returns an empty breakdown when no goal is set (milestones are undefined)", () => {
    const r = computeWeightMilestone({
      savedKg: 75,
      priorByDay: { "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: null,
      startKg: START,
    });
    expect(r.thresholds).toHaveLength(0);
    expect(r.reachedIndex).toBe(0);
    expect(r.crossedMilestone).toBe(false);
  });

  it("suppresses the breakdown when the start→goal span is below the meaningful floor", () => {
    // Span 0.5 kg < MILESTONE_MIN_SPAN_KG (1) → a milestone step would be
    // sub-noise, so nothing fires (guards float dither).
    expect(MILESTONE_MIN_SPAN_KG).toBe(1);
    const r = computeWeightMilestone({
      savedKg: 79.6,
      priorByDay: { "2026-05-25": 79.9 },
      targetDateKey: TODAY,
      goalKg: 79.5,
      startKg: 80,
    });
    expect(r.thresholds).toHaveLength(0);
    expect(r.crossedMilestone).toBe(false);
  });

  it("works the same for a gain goal (upward milestones)", () => {
    // Start 60 → goal 70 (10 kg gain). Prior latest 63.4 → band 3; saving 64.5
    // → floor((64.5-60)/(70-60)*10) = floor(4.5) = 4 → crossed ordinal 4.
    const r = computeWeightMilestone({
      savedKg: 64.5,
      priorByDay: { "2026-05-20": 60, "2026-05-25": 63.4 },
      targetDateKey: TODAY,
      goalKg: 70,
      startKg: 60,
    });
    expect(r.thresholds[0]).toBe(61);
    expect(r.thresholds[MILESTONE_COUNT - 1]).toBe(70);
    expect(r.reachedIndex).toBe(4);
    expect(r.crossedMilestone).toBe(true);
    expect(r.crossedOrdinal).toBe(4);
  });

  it("rejects non-positive / non-finite saved values", () => {
    const base = { priorByDay: { "2026-05-25": 76.4 }, targetDateKey: TODAY, goalKg: GOAL, startKg: START };
    expect(computeWeightMilestone({ ...base, savedKg: 0 }).crossedMilestone).toBe(false);
    expect(computeWeightMilestone({ ...base, savedKg: -1 }).thresholds).toHaveLength(0);
    expect(computeWeightMilestone({ ...base, savedKg: Number.NaN }).thresholds).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ENG-824 / ENG-952 — the shared celebration-tier resolver
// (`resolveWeightSaveCelebration`). Web (`useWeightCelebration`) and mobile
// (`LogWeightSheet`) both delegate the tier decision here, so this is the
// single source of truth for the precedence (the LOUD new-all-time-low owns
// the beat over the QUIET milestone — they never double-fire), the per-tier
// flag gating, and the silent `none` tier. These tests pin every combination
// so the two surfaces celebrate on identical conditions.
//
// `winMomentEnabled` no longer corresponds to a live PostHog flag —
// `redesign_winmoment` collapsed permanently-on (ENG-1651) and both real
// callers now hardcode `winMomentEnabled: true` (pinned in
// `progressDetailRedesign.test.ts`). It stays an explicit parameter of this
// pure function rather than being inlined away, so the tests below that pass
// `false` are pinning the RESOLVER's own contract (a future regression that
// silently hardcodes `true` inside it shouldn't go unnoticed) — not a
// reachable production combination. `milestoneEnabled` remains a real,
// currently-default-off flag (`progress_milestone_celebration_v1`).
// ─────────────────────────────────────────────────────────────────────────
describe("resolveWeightSaveCelebration (ENG-824 / ENG-952)", () => {
  // Start 80 → goal 70 (10 kg loss, 1 kg milestones). Prior latest 76.4 sits in
  // band 3; a save of 75.4 advances to band 4 (a milestone crossing).
  const GOAL = 70;
  const START = 80;
  const PRIOR = { "2026-05-20": 80, "2026-05-25": 76.4 };

  it("fires the LOUD new-low tier when the save is a new all-time low", () => {
    // 75.4 is well below the prior low (76.4) → new low. Both flags on.
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: PRIOR,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: true,
      milestoneEnabled: true,
      startKg: START,
    });
    expect(r.tier).toBe("new-low");
    expect(r.isNewLow).toBe(true);
    expect(r.milestoneOrdinal).toBeNull();
  });

  it("new-low OWNS precedence — never double-fires the milestone even when the save also crosses a band", () => {
    // 75.4 is BOTH a new all-time low (below 76.4) AND a milestone crossing
    // (band 3 → band 4). The resolver must return the loud tier ONLY; the quiet
    // milestone must not also fire. This is the never-double-fire guarantee both
    // platform callers rely on.
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: PRIOR,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: true,
      milestoneEnabled: true,
      startKg: START,
    });
    expect(r.tier).toBe("new-low");
    expect(r.milestoneOrdinal).toBeNull();
  });

  it("falls through to the QUIET milestone tier when the crossing is NOT a new low", () => {
    // Save 75.4 against a prior history whose low is ALREADY 75 (a separate
    // earlier day): the save ties/exceeds the low so it is NOT a new low, but it
    // still advances the most-recent band (76.4 → 75.4 = band 3 → 4) → milestone.
    const priorWithLowerLow = { "2026-05-18": 75, "2026-05-25": 76.4 };
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: priorWithLowerLow,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: true,
      milestoneEnabled: true,
      startKg: START,
    });
    expect(r.tier).toBe("milestone");
    expect(r.isNewLow).toBe(false);
    expect(r.milestoneOrdinal).toBe(4);
  });

  it("returns the silent 'none' tier when the save neither lows nor crosses a band", () => {
    // Re-saving 76.4 against prior latest 76.4: stays in band 3 (no crossing)
    // and ties the prior low (no new low — `isNewWeightLow` needs strictly
    // below by > epsilon). Nothing fires.
    const r = resolveWeightSaveCelebration({
      savedKg: 76.4,
      priorByDay: PRIOR,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: true,
      milestoneEnabled: true,
      startKg: START,
    });
    expect(r.tier).toBe("none");
    expect(r.isNewLow).toBe(false);
    expect(r.milestoneOrdinal).toBeNull();
  });

  it("suppresses the loud tier when winMomentEnabled is false — a new low then surfaces as a milestone if it crosses", () => {
    // 75.4 IS a new low, but with `winMomentEnabled: false` the loud tier is
    // suppressed. With the milestone flag on and the save crossing band 3 → 4,
    // the QUIET tier carries the celebration instead. This is no longer a
    // reachable production combination (`redesign_winmoment` collapsed
    // permanently-on, ENG-1651 — both callers hardcode `true`); it pins the
    // resolver's own flag-independence contract at the unit level.
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: PRIOR,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: false,
      milestoneEnabled: true,
      startKg: START,
    });
    expect(r.tier).toBe("milestone");
    expect(r.isNewLow).toBe(false);
    expect(r.milestoneOrdinal).toBe(4);
  });

  it("suppresses the quiet tier when milestoneEnabled is off — a crossing-only save stays silent", () => {
    // A save that only crosses a band (not a new low) with the milestone flag
    // OFF must return `none` — the flag-off path is fully inert.
    const priorWithLowerLow = { "2026-05-18": 75, "2026-05-25": 76.4 };
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: priorWithLowerLow,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: true,
      milestoneEnabled: false,
      startKg: START,
    });
    expect(r.tier).toBe("none");
    expect(r.milestoneOrdinal).toBeNull();
  });

  it("returns 'none' when both params are false (pins the resolver's own both-off contract)", () => {
    // `winMomentEnabled: false` is no longer production-reachable
    // (`redesign_winmoment` collapsed permanently-on, ENG-1651 — both
    // callers hardcode `true`); `milestoneEnabled: false` still is
    // (`progress_milestone_celebration_v1` defaults off). This pins the pure
    // function's own contract for the combination, not a live runtime state.
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: PRIOR,
      targetDateKey: TODAY,
      goalKg: GOAL,
      winMomentEnabled: false,
      milestoneEnabled: false,
      startKg: START,
    });
    expect(r.tier).toBe("none");
    expect(r.isNewLow).toBe(false);
    expect(r.milestoneOrdinal).toBeNull();
  });

  it("never fires the milestone tier with no goal set (milestones are undefined)", () => {
    // No goal → `computeWeightMilestone` returns the empty breakdown, so even a
    // big downward save can't cross a milestone. With the loud flag off too, the
    // result is silent.
    const r = resolveWeightSaveCelebration({
      savedKg: 75.4,
      priorByDay: { "2026-05-18": 75, "2026-05-25": 76.4 },
      targetDateKey: TODAY,
      goalKg: null,
      winMomentEnabled: false,
      milestoneEnabled: true,
    });
    expect(r.tier).toBe("none");
    expect(r.milestoneOrdinal).toBeNull();
  });
});

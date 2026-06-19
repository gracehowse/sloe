/**
 * Tests for the 5-rule weekly Digest suggestion cascade
 * (`src/lib/nutrition/weeklyDigestSuggestion.ts`).
 *
 * Pin all behaviours decided in the 2026-04-19 designer brief:
 *   - Each of the 5 rules fires when its gate passes.
 *   - Each rule suppresses when its gate fails.
 *   - Cascade is strict first-match-wins (Rule 1 beats Rule 3 when both
 *     are eligible, etc.).
 *   - Rule 2 respects the 14-day manual-override cooldown and the
 *     21-day accepted-recalibration cooldown.
 *   - Rule 4 emits a `null` CTA (informational only).
 *   - Empty cascade returns `null` (UI owns the empty-state copy).
 *   - Voice constraints: no exclamation marks, headlines ≤120 chars,
 *     bodies ≤200 chars.
 *   - Tier-required values match the per-suggestion gating map from A1.
 *
 * The cascade input is built per-test from a deterministic skeleton so
 * a future field added to `DigestSuggestionInput` doesn't accidentally
 * change which rule fires for a given test — every test overrides only
 * what it pins.
 */

import { describe, expect, it } from "vitest";

import {
  DIGEST_BODY_MAX_CHARS,
  DIGEST_HEADLINE_MAX_CHARS,
  selectDigestSuggestion,
  type DigestSuggestion,
  type DigestSuggestionInput,
} from "../../src/lib/nutrition/weeklyDigestSuggestion";
import type { ResolvedMaintenance } from "../../src/lib/nutrition/resolveMaintenance";
import type { WeeklyRecap, UsualMealRecapInsight } from "../../src/lib/nutrition/weeklyRecap";
import type { FreezeLedger } from "../../src/lib/nutrition/streakFreeze";

// ───────────────────────────────────────────────────────────────────
// Test fixtures
// ───────────────────────────────────────────────────────────────────

const FROZEN_NOW = new Date("2026-04-19T18:00:00Z");

function makeRecap(overrides: Partial<WeeklyRecap> = {}): WeeklyRecap {
  return {
    weekKey: "2026-W15",
    weekLabel: "Apr 6 – Apr 12",
    daysLogged: 7,
    avgCalories: 1900,
    avgProtein: 130,
    proteinAdherencePct: 90,
    streakLength: 0,
    freezesAvailable: 0,
    bestDay: null,
    weightDeltaKg: null,
    weightFirstKg: null,
    weightLastKg: null,
    ...overrides,
  };
}

function makeResolvedAdaptive(overrides: Partial<ResolvedMaintenance> = {}): ResolvedMaintenance {
  return {
    kcal: 1900,
    source: "adaptive",
    confidence: "high",
    formulaKcal: 1750,
    adaptiveRejectedAsStale: false,
    adaptiveRejectedBelowFormula: false,
    rejectedAdaptiveKcal: null,
    measuredRejectedBelowFormula: false,
    rejectedMeasuredKcal: null,
    ...overrides,
  };
}

function makeLedger(overrides: Partial<FreezeLedger> = {}): FreezeLedger {
  return { earnedAt: [], usedHistory: [], ...overrides };
}

/**
 * Skeleton input designed so NO rule fires by default. Every test
 * overrides only the fields it needs to flip exactly one rule on, so
 * cascade-order interactions stay explicit.
 */
function makeInput(overrides: Partial<DigestSuggestionInput> = {}): DigestSuggestionInput {
  return {
    recap: makeRecap(),
    proteinOnTarget: 7,
    targets: { calories: 2000, protein: 140 },
    resolvedMaintenance: null,
    staticTdee: null,
    ledger: makeLedger(),
    freezesAvailable: 3,
    saves: { count: 5, recentlyAddedCount: 0 },
    usualMealInsight: null,
    saveSeedItemCount: 0,
    profile: {
      targetCaloriesSource: "onboarding",
      targetCaloriesSetAt: null,
      goal: "maintain",
      weightGoalKg: null,
    },
    now: FROZEN_NOW,
    ...overrides,
  };
}

const promptInsight: UsualMealRecapInsight = {
  kind: "prompt",
  suggestedSlot: "Breakfast",
  repeats: 4,
};

// ───────────────────────────────────────────────────────────────────
// Rule 1 — Re-log prompt
// ───────────────────────────────────────────────────────────────────

describe("Rule 1 — re_log_prompt", () => {
  it("fires when usualMealInsight is a prompt and saveSeedItemCount >= 2", () => {
    const out = selectDigestSuggestion(
      makeInput({
        usualMealInsight: promptInsight,
        saveSeedItemCount: 3,
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.rule).toBe("re_log_prompt");
    expect(out!.headline).toContain("breakfast");
    expect(out!.headline).toContain("4x");
    expect(out!.cta).toEqual({
      label: "Save Breakfast as a meal",
      destination: "/save-meal?slot=Breakfast",
      tierRequired: "free",
    });
  });

  it("suppresses when usualMealInsight is null", () => {
    const out = selectDigestSuggestion(
      makeInput({ usualMealInsight: null, saveSeedItemCount: 5 }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when usualMealInsight is celebration (not prompt)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        usualMealInsight: { kind: "celebration", name: "Oats", count: 3 },
        saveSeedItemCount: 5,
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when saveSeedItemCount < 2 (single-item is not worth a save dialog)", () => {
    const out = selectDigestSuggestion(
      makeInput({ usualMealInsight: promptInsight, saveSeedItemCount: 1 }),
    );
    expect(out).toBeNull();
  });

  it("falls back to saveSeedItemCount when the prompt has no `repeats` (original gate)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        usualMealInsight: { kind: "prompt", suggestedSlot: "Lunch" },
        saveSeedItemCount: 3,
      }),
    );
    expect(out!.headline).toContain("lunch");
    expect(out!.headline).toContain("3x");
  });
});

// ───────────────────────────────────────────────────────────────────
// Rule 2 — Maintenance recalibration
// ───────────────────────────────────────────────────────────────────

describe("Rule 2 — maintenance_recalibration", () => {
  it("fires when adaptive (high) differs from formula by >= 100 kcal and no override is on file", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive({ kcal: 1900, formulaKcal: 1750 }),
        staticTdee: 1750,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "maintain",
          weightGoalKg: null,
        },
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.rule).toBe("maintenance_recalibration");
    expect(out!.headline).toContain("150 kcal higher");
    expect(out!.body).toContain("Update your calorie goal");
    expect(out!.cta).toEqual({
      label: "Adjust calorie goal",
      destination: "/digest/recalibrate-maintenance",
      tierRequired: "free",
    });
  });

  it("fires with negative delta wording when adaptive < formula", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive({ kcal: 1600, formulaKcal: 1800 }),
        staticTdee: 1800,
      }),
    );
    expect(out!.rule).toBe("maintenance_recalibration");
    expect(out!.headline).toContain("200 kcal lower");
  });

  it("suppresses when adaptive source did not win (formula fallback)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: { ...makeResolvedAdaptive(), source: "formula" },
        staticTdee: 1750,
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when adaptive confidence is medium (only 'high' qualifies)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive({ confidence: "medium" }),
        staticTdee: 1750,
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when |delta| < 100 kcal", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive({ kcal: 1800, formulaKcal: 1750 }),
        staticTdee: 1750,
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when targetCaloriesSource === 'user' and setAt < 14 days ago (manual override)", () => {
    const setAt = new Date(FROZEN_NOW.getTime() - 7 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
        profile: {
          targetCaloriesSource: "user",
          targetCaloriesSetAt: setAt,
          goal: "maintain",
          weightGoalKg: null,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("FIRES when targetCaloriesSource === 'user' but setAt > 14 days ago (cooldown elapsed)", () => {
    const setAt = new Date(FROZEN_NOW.getTime() - 20 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
        profile: {
          targetCaloriesSource: "user",
          targetCaloriesSetAt: setAt,
          goal: "maintain",
          weightGoalKg: null,
        },
      }),
    );
    expect(out!.rule).toBe("maintenance_recalibration");
  });

  it("suppresses when targetCaloriesSource === 'digest_recalibration' and setAt < 21 days ago (21-day cooldown)", () => {
    const setAt = new Date(FROZEN_NOW.getTime() - 14 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
        profile: {
          targetCaloriesSource: "digest_recalibration",
          targetCaloriesSetAt: setAt,
          goal: "maintain",
          weightGoalKg: null,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("FIRES when targetCaloriesSource === 'digest_recalibration' but setAt > 21 days ago (cooldown elapsed)", () => {
    const setAt = new Date(FROZEN_NOW.getTime() - 30 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
        profile: {
          targetCaloriesSource: "digest_recalibration",
          targetCaloriesSetAt: setAt,
          goal: "maintain",
          weightGoalKg: null,
        },
      }),
    );
    expect(out!.rule).toBe("maintenance_recalibration");
  });

  it("suppresses when staticTdee is null (no formula baseline to compare against)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: null,
      }),
    );
    expect(out).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────
// Rule 3 — Protein nudge
// ───────────────────────────────────────────────────────────────────

describe("Rule 3 — protein_nudge", () => {
  it("fires when proteinOnTarget < daysLogged * 0.5 and daysLogged >= 4", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 2,
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.rule).toBe("protein_nudge");
    expect(out!.headline).toBe("Protein landed on target 2 of 6 days.");
    expect(out!.body).toContain("high-protein breakfast");
    expect(out!.cta).toEqual({
      label: "Browse high-protein recipes",
      destination: "/recipes?filter=high-protein",
      tierRequired: "base",
    });
  });

  it("suppresses when daysLogged < 4 (insufficient sample)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 3 }),
        proteinOnTarget: 0,
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when proteinOnTarget >= daysLogged * 0.5 (adherence is fine)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 3,
      }),
    );
    expect(out).toBeNull();
  });

  it("CTA tier is 'base' (paywalled for Free per A1)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 4 }),
        proteinOnTarget: 1,
      }),
    );
    expect(out!.cta?.tierRequired).toBe("base");
  });
});

// ───────────────────────────────────────────────────────────────────
// Rule 4 — Streak protection
// ───────────────────────────────────────────────────────────────────

describe("Rule 4 — streak_protection", () => {
  it("fires when freezesAvailable === 0 and streakLength >= 7 and no recent freeze earned", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 10 }),
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.rule).toBe("streak_protection");
    expect(out!.headline).toContain("10-day streak");
  });

  it("CTA is null (informational only — no button to tap)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 7 }),
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    expect(out!.cta).toBeNull();
  });

  it("suppresses when freezesAvailable > 0 (user has protection)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 14 }),
        freezesAvailable: 2,
        ledger: makeLedger(),
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when streakLength < 7 (no streak worth protecting yet)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 5 }),
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when a freeze was earned in the last 14 days (don't disconnect from recent activity)", () => {
    const recentEarn = new Date(FROZEN_NOW.getTime() - 5 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 14 }),
        freezesAvailable: 0,
        ledger: makeLedger({ earnedAt: [{ earnedAt: recentEarn }] }),
      }),
    );
    expect(out).toBeNull();
  });

  it("FIRES when the most recent earned freeze is > 14 days old", () => {
    const oldEarn = new Date(FROZEN_NOW.getTime() - 30 * 86_400_000).toISOString();
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 14 }),
        freezesAvailable: 0,
        ledger: makeLedger({ earnedAt: [{ earnedAt: oldEarn }] }),
      }),
    );
    expect(out!.rule).toBe("streak_protection");
  });
});

// ───────────────────────────────────────────────────────────────────
// Rule 5 — Weight-trend mismatch
// ───────────────────────────────────────────────────────────────────

describe("Rule 5 — weight_trend_mismatch", () => {
  it("fires when goal === 'cut' and weight ticked up despite hitting calorie target", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6, // suppress Rule 3
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.rule).toBe("weight_trend_mismatch");
    expect(out!.headline).toContain("6 days");
    expect(out!.cta).toEqual({
      label: "Open Maintenance",
      destination: "/progress?metric=maintenance",
      tierRequired: "free",
    });
  });

  it("suppresses when goal !== 'cut'", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "maintain",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when weightDeltaKg is null (no honest reading)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: null }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when weightDeltaKg <= 0 (weight didn't go up)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: -0.3 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when avgCalories > targets.calories (user didn't hit target)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 2100, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).toBeNull();
  });

  it("suppresses when daysLogged < 5 (insufficient sample)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 4, avgCalories: 1750, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 4,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────
// Cascade ordering — first-match-wins
// ───────────────────────────────────────────────────────────────────

describe("cascade ordering (first-match-wins)", () => {
  it("Rule 1 wins over Rule 3 when both gates pass", () => {
    const out = selectDigestSuggestion(
      makeInput({
        usualMealInsight: promptInsight,
        saveSeedItemCount: 3,
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 2, // would fire Rule 3
      }),
    );
    expect(out!.rule).toBe("re_log_prompt");
  });

  it("Rule 1 wins over Rule 2 when both gates pass", () => {
    const out = selectDigestSuggestion(
      makeInput({
        usualMealInsight: promptInsight,
        saveSeedItemCount: 3,
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
      }),
    );
    expect(out!.rule).toBe("re_log_prompt");
  });

  it("Rule 2 wins over Rule 3 when both gates pass", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 2,
      }),
    );
    expect(out!.rule).toBe("maintenance_recalibration");
  });

  it("Rule 3 wins over Rule 4 when both gates pass", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, streakLength: 14 }),
        proteinOnTarget: 2,
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    expect(out!.rule).toBe("protein_nudge");
  });

  it("Rule 4 wins over Rule 5 when both gates pass", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({
          daysLogged: 6,
          streakLength: 10,
          avgCalories: 1750,
          weightDeltaKg: 0.4,
        }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6, // Rule 3 fails
        freezesAvailable: 0, // Rule 4 passes
        ledger: makeLedger(),
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out!.rule).toBe("streak_protection");
  });
});

// ───────────────────────────────────────────────────────────────────
// Empty cascade
// ───────────────────────────────────────────────────────────────────

describe("empty cascade", () => {
  it("returns null when every rule's gate fails (UI owns the empty-state copy)", () => {
    const out = selectDigestSuggestion(makeInput());
    expect(out).toBeNull();
  });

  it("returns null when all required inputs are missing/null (no rule can invent data)", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 0, streakLength: 0 }),
        proteinOnTarget: 0,
        targets: { calories: 0, protein: 0 },
        resolvedMaintenance: null,
        staticTdee: null,
        freezesAvailable: 0,
        usualMealInsight: null,
        saveSeedItemCount: 0,
        profile: {
          targetCaloriesSource: null,
          targetCaloriesSetAt: null,
          goal: null,
          weightGoalKg: null,
        },
      }),
    );
    expect(out).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────
// Voice constraints — pin them across every rule
// ───────────────────────────────────────────────────────────────────

describe("voice constraints (apply to every rule)", () => {
  // Build one fixture per rule that fires.
  function allFiringSamples(): DigestSuggestion[] {
    const r1 = selectDigestSuggestion(
      makeInput({ usualMealInsight: promptInsight, saveSeedItemCount: 3 }),
    );
    const r2 = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive({ kcal: 2000, formulaKcal: 1750 }),
        staticTdee: 1750,
      }),
    );
    const r3 = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 2,
      }),
    );
    const r4 = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 9 }),
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    const r5 = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    return [r1!, r2!, r3!, r4!, r5!];
  }

  it("never produces an exclamation mark in any headline or body", () => {
    for (const s of allFiringSamples()) {
      expect(s).not.toBeNull();
      expect(s.headline).not.toMatch(/!/);
      expect(s.body).not.toMatch(/!/);
    }
  });

  it("never uses performance adjectives ('great', 'amazing', 'awesome', 'perfect')", () => {
    const banned = /\b(great job|great work|amazing|awesome|perfect|crushed|nailed it)\b/i;
    for (const s of allFiringSamples()) {
      expect(s.headline).not.toMatch(banned);
      expect(s.body).not.toMatch(banned);
    }
  });

  it("keeps every headline within DIGEST_HEADLINE_MAX_CHARS (120)", () => {
    for (const s of allFiringSamples()) {
      expect(s.headline.length).toBeLessThanOrEqual(DIGEST_HEADLINE_MAX_CHARS);
    }
  });

  it("keeps every body within DIGEST_BODY_MAX_CHARS (200)", () => {
    for (const s of allFiringSamples()) {
      expect(s.body.length).toBeLessThanOrEqual(DIGEST_BODY_MAX_CHARS);
    }
  });
});

// ───────────────────────────────────────────────────────────────────
// Tier-gating map (per A1 decision)
// ───────────────────────────────────────────────────────────────────

describe("tier-gating per A1", () => {
  it("Rule 1 (re_log_prompt) CTA is FREE", () => {
    const out = selectDigestSuggestion(
      makeInput({ usualMealInsight: promptInsight, saveSeedItemCount: 3 }),
    );
    expect(out!.cta?.tierRequired).toBe("free");
  });

  it("Rule 2 (maintenance_recalibration) CTA is FREE — Maintenance is not Pro-gated", () => {
    const out = selectDigestSuggestion(
      makeInput({
        resolvedMaintenance: makeResolvedAdaptive(),
        staticTdee: 1750,
      }),
    );
    expect(out!.cta?.tierRequired).toBe("free");
  });

  it("Rule 3 (protein_nudge) CTA is BASE — locked for Free users", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6 }),
        proteinOnTarget: 2,
      }),
    );
    expect(out!.cta?.tierRequired).toBe("base");
  });

  it("Rule 4 (streak_protection) has no CTA", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ streakLength: 7 }),
        freezesAvailable: 0,
        ledger: makeLedger(),
      }),
    );
    expect(out!.cta).toBeNull();
  });

  it("Rule 5 (weight_trend_mismatch) CTA is FREE — Maintenance is not Pro-gated", () => {
    const out = selectDigestSuggestion(
      makeInput({
        recap: makeRecap({ daysLogged: 6, avgCalories: 1750, weightDeltaKg: 0.4 }),
        targets: { calories: 1800, protein: 140 },
        proteinOnTarget: 6,
        profile: {
          targetCaloriesSource: "onboarding",
          targetCaloriesSetAt: null,
          goal: "cut",
          weightGoalKg: 70,
        },
      }),
    );
    expect(out!.cta?.tierRequired).toBe("free");
  });
});

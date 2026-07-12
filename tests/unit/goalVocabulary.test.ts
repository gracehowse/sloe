/**
 * ENG-1507 — the single goal-normalisation vocabulary.
 *
 * Load-bearing rule: unknown/null NEVER silently becomes 'cut'/'lose'.
 * Three independent readers used to default unknown goals to weight-loss
 * (and one of them wrote 'cut' back on save); this table is the contract
 * that ends that.
 */

import { describe, expect, it } from "vitest";

import {
  formatGoalLabel,
  goalClauseGerund,
  normalizeDbGoal,
} from "../../src/lib/nutrition/goalVocabulary";

describe("goalVocabulary — normalizeDbGoal", () => {
  it("maps the canonical + legacy synonyms", () => {
    expect(normalizeDbGoal("cut")).toBe("cut");
    expect(normalizeDbGoal("lose")).toBe("cut");
    expect(normalizeDbGoal("maintain")).toBe("maintain");
    expect(normalizeDbGoal("health")).toBe("maintain");
    expect(normalizeDbGoal("bulk")).toBe("bulk");
    expect(normalizeDbGoal("gain")).toBe("bulk");
    expect(normalizeDbGoal("strength")).toBe("bulk");
  });

  it("tolerates case / whitespace noise from legacy rows", () => {
    expect(normalizeDbGoal(" Cut ")).toBe("cut");
    expect(normalizeDbGoal("GAIN")).toBe("bulk");
  });

  it("unknown / null / empty → null — never a silent 'cut'", () => {
    expect(normalizeDbGoal(null)).toBeNull();
    expect(normalizeDbGoal(undefined)).toBeNull();
    expect(normalizeDbGoal("")).toBeNull();
    expect(normalizeDbGoal("garbage")).toBeNull();
  });

  it("'recomp' is not a DB value (persist collapses it) → null; fidelity deferred to ENG-1538", () => {
    expect(normalizeDbGoal("recomp")).toBeNull();
  });
});

describe("goalVocabulary — labels + gerund clauses", () => {
  it("noun labels", () => {
    expect(formatGoalLabel("cut")).toBe("Lose weight");
    expect(formatGoalLabel("lose")).toBe("Lose weight");
    expect(formatGoalLabel("maintain")).toBe("Eat healthier");
    expect(formatGoalLabel("bulk")).toBe("Build muscle");
    expect(formatGoalLabel(null)).toBeNull();
    expect(formatGoalLabel("garbage")).toBeNull();
  });

  it("gerund clauses (fixes the 'for lose weight' grammar)", () => {
    expect(goalClauseGerund("cut")).toBe("losing weight");
    expect(goalClauseGerund("maintain")).toBe("eating healthier");
    expect(goalClauseGerund("bulk")).toBe("building muscle");
    expect(goalClauseGerund(null)).toBeNull();
  });
});

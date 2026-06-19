import { describe, it, expect } from "vitest";
import {
  selectBelowMealsPrompts,
  isBelowMealsPromptVisible,
  BELOW_MEALS_PROMPT_MAX,
} from "../../src/lib/today/belowMealsPromptSelection";

describe("selectBelowMealsPrompts", () => {
  it("returns at most BELOW_MEALS_PROMPT_MAX prompts", () => {
    const all = selectBelowMealsPrompts({
      checkin: true,
      northStar: true,
      snap: true,
      nudge: true,
    });
    expect(all.length).toBe(BELOW_MEALS_PROMPT_MAX);
  });

  it("prefers check-in as the single cold-open interruption", () => {
    expect(
      selectBelowMealsPrompts({
        checkin: true,
        northStar: true,
        snap: true,
      }),
    ).toEqual(["checkin"]);
  });

  it("prefers north-star over snap and nudge when check-in is absent", () => {
    expect(
      selectBelowMealsPrompts({
        northStar: true,
        snap: true,
        nudge: true,
      }),
    ).toEqual(["northStar"]);
  });

  it("prefers snap over nudge when only acquisition prompts are eligible", () => {
    expect(
      selectBelowMealsPrompts({
        snap: true,
        nudge: true,
      }),
    ).toEqual(["snap"]);
  });

  it("returns empty when nothing eligible", () => {
    expect(selectBelowMealsPrompts({})).toEqual([]);
  });
});

describe("isBelowMealsPromptVisible", () => {
  it("hides every lower-priority nudge once one interruption is visible", () => {
    const eligible = { checkin: true, northStar: true, nudge: true };
    expect(isBelowMealsPromptVisible("checkin", eligible)).toBe(true);
    expect(isBelowMealsPromptVisible("northStar", eligible)).toBe(false);
    expect(isBelowMealsPromptVisible("nudge", eligible)).toBe(false);
  });
});

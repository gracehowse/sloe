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

  it("prefers check-in over north-star when only two slots", () => {
    expect(
      selectBelowMealsPrompts({
        checkin: true,
        northStar: true,
        snap: true,
      }),
    ).toEqual(["checkin", "northStar"]);
  });

  it("prefers north-star over snap and nudge", () => {
    expect(
      selectBelowMealsPrompts({
        northStar: true,
        snap: true,
        nudge: true,
      }),
    ).toEqual(["northStar", "snap"]);
  });

  it("prefers snap over nudge", () => {
    expect(
      selectBelowMealsPrompts({
        snap: true,
        nudge: true,
      }),
    ).toEqual(["snap", "nudge"]);
  });

  it("returns empty when nothing eligible", () => {
    expect(selectBelowMealsPrompts({})).toEqual([]);
  });
});

describe("isBelowMealsPromptVisible", () => {
  it("hides nudge when check-in and north-star fill the cap", () => {
    const eligible = { checkin: true, northStar: true, nudge: true };
    expect(isBelowMealsPromptVisible("checkin", eligible)).toBe(true);
    expect(isBelowMealsPromptVisible("northStar", eligible)).toBe(true);
    expect(isBelowMealsPromptVisible("nudge", eligible)).toBe(false);
  });
});

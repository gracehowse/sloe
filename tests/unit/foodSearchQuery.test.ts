import { describe, expect, it } from "vitest";
import {
  effectiveFoodSearchQuery,
  stripLeadingMeasureFromFoodQuery,
} from "@/lib/nutrition/foodSearchQuery";

describe("foodSearchQuery", () => {
  it("stripLeadingMeasureFromFoodQuery removes spaced and glued gram amounts", () => {
    expect(stripLeadingMeasureFromFoodQuery("220 g rolled oats")).toBe("rolled oats");
    expect(stripLeadingMeasureFromFoodQuery("220g rolled oats")).toBe("rolled oats");
  });

  it("effectiveFoodSearchQuery keeps usable stripped text", () => {
    expect(effectiveFoodSearchQuery("220g rolled oats")).toBe("rolled oats");
    expect(effectiveFoodSearchQuery("  1 cup  milk  ")).toBe("milk");
  });

  it("effectiveFoodSearchQuery falls back when strip leaves too little", () => {
    expect(effectiveFoodSearchQuery("g")).toBe("g");
  });
});

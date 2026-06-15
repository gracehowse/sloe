import { describe, expect, it } from "vitest";

import {
  isPlausibleMicrosPer100g,
  sanitizeMicrosPer100g,
} from "@/lib/nutrition/microPlausibility";

describe("microPlausibility — ENG-1077", () => {
  it("accepts realistic grape-leaves-class sodium", () => {
    expect(isPlausibleMicrosPer100g({ sodiumMg: 735, fiberG: 4.2 })).toBe(true);
  });

  it("rejects absurd vendor sodium (e.g. 50k mg/100g)", () => {
    expect(isPlausibleMicrosPer100g({ sodiumMg: 50_000 })).toBe(false);
  });

  it("sanitizeMicrosPer100g drops absurd keys and keeps plausible ones", () => {
    expect(
      sanitizeMicrosPer100g({
        sodiumMg: 50_000,
        fiberG: 3,
        sugarG: 12,
      }),
    ).toEqual({ fiberG: 3, sugarG: 12 });
  });

  it("returns empty object for undefined input", () => {
    expect(sanitizeMicrosPer100g(undefined)).toEqual({});
  });
});

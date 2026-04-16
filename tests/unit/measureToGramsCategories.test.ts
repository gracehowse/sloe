/**
 * Tests for category-aware weight defaults added in T2-1/T2-3.
 * Covers: sauce/condiment defaults, grain defaults, cup densities,
 * unknown unit recursion, and the 80g catch-all.
 */
import { describe, it, expect } from "vitest";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";

describe("measureToGrams — sauce/condiment defaults", () => {
  it("soy sauce with no unit defaults to ~15g (1 tbsp)", () => {
    expect(measureToGrams({ name: "soy sauce", amount: 1, unit: "" })).toBe(15);
  });

  it("vinegar with no unit defaults to ~15g", () => {
    expect(measureToGrams({ name: "balsamic vinegar", amount: 1, unit: "" })).toBe(15);
  });

  it("harissa paste with no unit defaults to ~15g", () => {
    expect(measureToGrams({ name: "harissa paste", amount: 2, unit: "" })).toBe(30);
  });

  it("fish sauce with no unit defaults to ~15g", () => {
    expect(measureToGrams({ name: "fish sauce", amount: 1, unit: "" })).toBe(15);
  });
});

describe("measureToGrams — grain/pulse defaults", () => {
  it("rice with no unit defaults to ~75g (dry serving)", () => {
    expect(measureToGrams({ name: "rice", amount: 1, unit: "" })).toBe(75);
  });

  it("pasta with no unit defaults to ~75g", () => {
    expect(measureToGrams({ name: "pasta", amount: 1, unit: "" })).toBe(75);
  });

  it("lentils with no unit defaults to ~75g", () => {
    expect(measureToGrams({ name: "red lentils", amount: 1, unit: "" })).toBe(75);
  });
});

describe("measureToGrams — cup with food-specific density", () => {
  it("1 cup sugar uses density 0.85 (~201g)", () => {
    const g = measureToGrams({ name: "sugar", amount: 1, unit: "cup", gPerMl: 0.85 });
    expect(g).toBeCloseTo(201, 0);
  });

  it("1 cup rice uses density 0.78 (~184g)", () => {
    const g = measureToGrams({ name: "rice", amount: 1, unit: "cup", gPerMl: 0.78 });
    expect(g).toBeCloseTo(185, 0);
  });

  it("1 cup oats uses density 0.34 (~80g)", () => {
    const g = measureToGrams({ name: "oats", amount: 1, unit: "cup", gPerMl: 0.34 });
    expect(g).toBeCloseTo(80, 0);
  });

  it("1 cup flour uses density 0.53 (~125g)", () => {
    const g = measureToGrams({ name: "flour", amount: 1, unit: "cup", gPerMl: 0.53 });
    expect(g).toBeCloseTo(125, 0);
  });

  it("1 cup with no gPerMl uses 0.9 default (~213g)", () => {
    const g = measureToGrams({ name: "unknown", amount: 1, unit: "cup" });
    expect(g).toBeCloseTo(213, 0);
  });
});

describe("measureToGrams — unknown unit falls through to name heuristics", () => {
  it("unknown unit 'whole' for carrot → medium (110g)", () => {
    expect(measureToGrams({ name: "carrot", amount: 1, unit: "whole" })).toBe(110);
  });

  it("unknown unit 'piece' for chicken breast → 200g", () => {
    expect(measureToGrams({ name: "chicken breast", amount: 1, unit: "piece" })).toBe(200);
  });

  it("truly unknown item + unknown unit → 80g catch-all", () => {
    expect(measureToGrams({ name: "xyzzy", amount: 1, unit: "glorp" })).toBe(80);
  });
});

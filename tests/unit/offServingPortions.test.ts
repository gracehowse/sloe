import { describe, expect, it } from "vitest";
import {
  buildOffServingOptionsFromProduct,
  parseParentheticalGrams,
  pickDefaultServingGrams,
} from "../../src/lib/openFoodFacts/offServingPortions";

describe("offServingPortions", () => {
  it("parses grams in parentheses", () => {
    expect(parseParentheticalGrams("4 dumplings (82 g)")).toBe(82);
    expect(parseParentheticalGrams("30ml (30 g)")).toBe(30);
  });

  it("builds multi-dumpling + single-piece options", () => {
    const opts = buildOffServingOptionsFromProduct({
      serving_size: "4 dumplings (82 g)",
      nutriments: {},
    });
    const labels = opts.map((o) => o.label);
    expect(labels.some((l) => l.includes("4") && l.toLowerCase().includes("dumpling"))).toBe(true);
    expect(labels.some((l) => l.startsWith("1 ") && l.includes("g)"))).toBe(true);
    expect(opts.some((o) => Math.abs(o.grams - 82) < 0.01)).toBe(true);
    expect(opts.some((o) => Math.abs(o.grams - 20.5) < 0.1)).toBe(true);
    expect(opts.some((o) => o.grams === 100)).toBe(true);
  });

  it("pickDefaultServingGrams prefers label serving over 100 g", () => {
    const opts = buildOffServingOptionsFromProduct({
      serving_size: "4 dumplings (82 g)",
      nutriments: {},
    });
    expect(pickDefaultServingGrams(opts)).toBe(82);
  });
});

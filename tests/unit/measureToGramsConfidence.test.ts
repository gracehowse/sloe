import { describe, it, expect } from "vitest";
import { measureToGramsConfidence } from "@/lib/nutrition/measureToGrams";

describe("measureToGramsConfidence — count-to-weight safety gate (ENG-943)", () => {
  it("rates mass + volume units HIGH", () => {
    for (const unit of ["g", "kg", "oz", "lb", "ml", "l", "tbsp", "tsp"]) {
      expect(measureToGramsConfidence({ name: "anything", amount: 1, unit })).toBe("high");
    }
  });

  it("rates a count of a known food (food-specific weight) HIGH", () => {
    expect(measureToGramsConfidence({ name: "chicken breast", amount: 2, unit: "" })).toBe("high");
    expect(measureToGramsConfidence({ name: "onion", amount: 1, unit: "each" })).toBe("high");
    expect(measureToGramsConfidence({ name: "large egg", amount: 3, unit: "large" })).toBe("high");
  });

  it("rates a bare count of an UNKNOWN food LOW (would hit the generic 80 g guess)", () => {
    expect(measureToGramsConfidence({ name: "widget", amount: 2, unit: "" })).toBe("low");
    expect(measureToGramsConfidence({ name: "mystery thing", amount: 1, unit: "each" })).toBe("low");
  });

  it("rates a defaulted-density cup LOW", () => {
    expect(measureToGramsConfidence({ name: "flour", amount: 1, unit: "cup" })).toBe("low");
  });

  it("rates recognised discrete units (clove, slice, rasher, tin) HIGH", () => {
    expect(measureToGramsConfidence({ name: "garlic", amount: 2, unit: "clove" })).toBe("high");
    expect(measureToGramsConfidence({ name: "bread", amount: 1, unit: "slice" })).toBe("high");
    expect(measureToGramsConfidence({ name: "bacon", amount: 3, unit: "rasher" })).toBe("high");
    expect(measureToGramsConfidence({ name: "chopped tomatoes", amount: 1, unit: "tin" })).toBe("high");
  });

  it("rates an unrecognised unit LOW (falls back to a name-based guess)", () => {
    expect(measureToGramsConfidence({ name: "widget", amount: 1, unit: "blorp" })).toBe("low");
  });

  // ── ENG-1544 — coarse per-piece estimates must NOT read as HIGH confidence ──

  it("rates a count of a nut/stone-fruit with a defensible per-piece weight HIGH", () => {
    // These now carry USDA-ish single-food references (almond 1.2g, plum 65g,
    // apricot 35g, date 7g, mushroom 20g) so HIGH is honest.
    for (const name of ["almond", "walnut", "plum", "apricot", "date", "mushroom", "strawberry"]) {
      expect(measureToGramsConfidence({ name, amount: 3, unit: "" })).toBe("high");
    }
  });

  // ── ENG-1432/count-to-weight-3 — split the two widest-range single-food
  // outliers out of their catch-alls; give the catch-alls left a MEDIUM tier
  // instead of collapsing them into the same LOW an unmatched food gets. ──

  it("rates a whole shallot and a portobello mushroom HIGH — split out of their old catch-alls", () => {
    // Shallot used to share the misc pickled/allium 5g bucket with capers;
    // portobello used to fall through to the flat "any mushroom = 20g" rule
    // (a 4-7x undercount for a large cap). Both now have their own
    // single-food reference, same tier as onion/potato/tomato.
    expect(measureToGramsConfidence({ name: "shallot", amount: 2, unit: "" })).toBe("high");
    expect(measureToGramsConfidence({ name: "portobello mushroom", amount: 1, unit: "large" })).toBe("high");
  });

  it("rates a count that only hits a COARSE catch-all bucket MEDIUM (not HIGH, not LOW)", () => {
    // olive/caper/cornichon (misc pickled/allium) and shrimp/mussel/scallop
    // (misc shellfish) resolve to a rough weight but per-piece varies too
    // widely across the different foods in the bucket to trust as a specific
    // value — MEDIUM, not HIGH, so the count/weight rows still split at the
    // `!== "high"` cross-convert gate. Not LOW either: a real food-specific
    // class did match (unlike a genuinely unknown food), so the coarseness
    // stays visible as its own tier rather than reading identically to a
    // total unknown.
    for (const name of ["olive", "caper", "cornichon", "shrimp", "mussel", "scallop"]) {
      expect(measureToGramsConfidence({ name, amount: 5, unit: "" })).toBe("medium");
    }
  });

  it("still refuses to cross-convert a MEDIUM-confidence count (same gate as LOW)", () => {
    // Regression guard: `tryCountToWeightGrams` in shoppingMergePrimitives.ts
    // gates on `!== "high"`, so MEDIUM must fail it exactly like LOW — a
    // three-tier confidence read must not accidentally loosen the
    // never-guess-a-weight contract.
    expect(measureToGramsConfidence({ name: "olive", amount: 5, unit: "" })).not.toBe("high");
  });
});

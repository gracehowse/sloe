/**
 * Tests for auto-classification of recipes into meal types.
 * Drives the meal planner's slot assignment.
 */
import { describe, it, expect } from "vitest";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";

describe("classifyMealType", () => {
  // ── Breakfast ──────────────────────────────────────────────────

  it("classifies pancakes as breakfast", () => {
    expect(classifyMealType({ title: "Fluffy American Pancakes" })).toContain("breakfast");
  });

  it("classifies overnight oats as breakfast", () => {
    expect(classifyMealType({ title: "Protein Overnight Oats" })).toContain("breakfast");
  });

  it("classifies scrambled eggs as breakfast", () => {
    expect(classifyMealType({ title: "Perfect scrambled eggs recipe" })).toContain("breakfast");
  });

  it("classifies shakshuka as breakfast", () => {
    expect(classifyMealType({ title: "Shakshuka Recipe" })).toContain("breakfast");
  });

  it("classifies egg muffins as breakfast", () => {
    expect(classifyMealType({ title: "Easy Egg Muffins (3 Ways)" })).toContain("breakfast");
  });

  // ── Dinner ─────────────────────────────────────────────────────

  it("classifies stir-fry as dinner", () => {
    expect(classifyMealType({ title: "Chicken Stir Fry" })).toContain("dinner");
  });

  it("classifies curry as dinner", () => {
    expect(classifyMealType({ title: "Easy Chicken Curry" })).toContain("dinner");
  });

  it("classifies bolognese as dinner", () => {
    expect(classifyMealType({ title: "Classic Spaghetti Bolognese" })).toContain("dinner");
  });

  it("classifies tikka masala as dinner", () => {
    expect(classifyMealType({ title: "Chicken Tikka Masala" })).toContain("dinner");
  });

  it("classifies salmon as dinner", () => {
    expect(classifyMealType({ title: "Baked Salmon with Garlic" })).toContain("dinner");
  });

  // ── Lunch ──────────────────────────────────────────────────────

  it("classifies soup as lunch", () => {
    expect(classifyMealType({ title: "Best Lentil Soup" })).toContain("lunch");
  });

  it("classifies salad as lunch", () => {
    expect(classifyMealType({ title: "Classic Greek Salad" })).toContain("lunch");
  });

  it("classifies wraps as lunch", () => {
    expect(classifyMealType({ title: "Turkey Taco Lettuce Wraps" })).toContain("lunch");
  });

  // ── Snack ──────────────────────────────────────────────────────

  it("classifies brownies as snack", () => {
    expect(classifyMealType({ title: "Best Ever Chocolate Brownies" })).toContain("snack");
  });

  it("classifies banana bread as snack", () => {
    expect(classifyMealType({ title: "Healthy Banana Bread" })).toContain("snack");
  });

  it("classifies muffins as snack", () => {
    expect(classifyMealType({ title: "Blueberry Muffins" })).toContain("snack");
  });

  // ── Multi-tag ──────────────────────────────────────────────────

  it("dinner items also get lunch when under 500 cal", () => {
    const tags = classifyMealType({ title: "Chicken Stir Fry", caloriesPerServing: 350 });
    expect(tags).toContain("dinner");
    expect(tags).toContain("lunch");
  });

  it("returns array format", () => {
    const tags = classifyMealType({ title: "Some Recipe" });
    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("does NOT classify fried rice as breakfast", () => {
    const tags = classifyMealType({ title: "Easy Vegan Fried Rice" });
    expect(tags).not.toContain("breakfast");
    expect(tags).toContain("dinner");
  });

  it("does NOT classify spring rolls as breakfast", () => {
    const tags = classifyMealType({ title: "Fresh Spring Rolls with Peanut Sauce" });
    expect(tags).not.toContain("breakfast");
  });

  it("low calorie items get snack", () => {
    const tags = classifyMealType({ title: "Roasted Cauliflower", caloriesPerServing: 120 });
    expect(tags).toContain("snack");
  });

  it("never returns empty array", () => {
    const tags = classifyMealType({ title: "Something Unknown" });
    expect(tags.length).toBeGreaterThan(0);
  });
});

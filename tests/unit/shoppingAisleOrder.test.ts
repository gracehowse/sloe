import { describe, expect, it } from "vitest";
import { sortShoppingCategories } from "@/lib/planning/shoppingAisleOrder";

describe("sortShoppingCategories", () => {
  it("orders known aisles in supermarket walk order", () => {
    expect(
      sortShoppingCategories(["Dairy", "Produce", "Frozen", "Pantry"]),
    ).toEqual(["Produce", "Dairy", "Frozen", "Pantry"]);
  });

  it("places planner category labels correctly", () => {
    expect(
      sortShoppingCategories(["Pantry", "Meat & Fish", "Fruit & Veg", "Dairy & Eggs"]),
    ).toEqual(["Fruit & Veg", "Meat & Fish", "Dairy & Eggs", "Pantry"]);
  });

  it("sorts unknown categories alphabetically after known aisles", () => {
    expect(sortShoppingCategories(["ZZZ Custom", "Produce"])).toEqual([
      "Produce",
      "ZZZ Custom",
    ]);
  });
});

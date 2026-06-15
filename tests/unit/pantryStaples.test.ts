import { describe, expect, it } from "vitest";

import {
  filterShoppingItemsByPantry,
  isPantryStapleMatch,
  normalizePantryToken,
  parsePantryStaples,
} from "@/lib/planning/pantryStaples";

describe("ENG-1051 — pantryStaples", () => {
  it("parsePantryStaples accepts string array jsonb", () => {
    expect(parsePantryStaples([" olive oil ", "", 3])).toEqual(["olive oil"]);
  });

  it("matches word boundaries — pepper does not match peppercorn", () => {
    expect(isPantryStapleMatch("black pepper", ["pepper"])).toBe(true);
    expect(isPantryStapleMatch("black peppercorn", ["pepper"])).toBe(false);
  });

  it("filterShoppingItemsByPantry removes matching rows", () => {
    const items = [
      { name: "Olive oil", amount: "1", unit: "tbsp" },
      { name: "Chicken breast", amount: "200", unit: "g" },
    ];
    const filtered = filterShoppingItemsByPantry(items, ["olive oil"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe("Chicken breast");
  });

  it("normalizePantryToken lowercases and collapses whitespace", () => {
    expect(normalizePantryToken("  Olive   Oil ")).toBe("olive oil");
  });
});

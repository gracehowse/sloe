import { describe, expect, it } from "vitest";

import { buildCookModeHref } from "@/lib/navigateToCookMode";

describe("buildCookModeHref (ENG-945)", () => {
  it("serialises required cook route params", () => {
    const href = buildCookModeHref({
      recipeId: "abc-123",
      title: "Pasta",
      steps: ["Boil water", "Cook pasta"],
    });
    expect(href).toMatch(/^\/cook\?/);
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("recipeId")).toBe("abc-123");
    expect(qs.get("title")).toBe("Pasta");
    expect(JSON.parse(qs.get("steps")!)).toEqual(["Boil water", "Cook pasta"]);
  });

  it("threads optional servings, portion, sources, and ingredients", () => {
    const href = buildCookModeHref({
      recipeId: "r1",
      title: "Soup",
      steps: ["Simmer"],
      servings: 4,
      portion: 2,
      sourceUrl: "https://example.com/recipe",
      ingredients: [{ name: "onion", amount: 1, unit: "whole" }],
    });
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("servings")).toBe("4");
    expect(qs.get("portion")).toBe("2");
    expect(qs.get("sourceUrl")).toBe("https://example.com/recipe");
    expect(JSON.parse(qs.get("ingredients")!)).toEqual([
      { name: "onion", amount: 1, unit: "whole" },
    ]);
  });

  it("omits portion when 1×", () => {
    const href = buildCookModeHref({
      recipeId: "r1",
      title: "Soup",
      steps: ["Simmer"],
      portion: 1,
    });
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("portion")).toBeNull();
  });
});

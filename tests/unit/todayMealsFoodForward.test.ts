/**
 * Premium P2 — food-forward meal rows (ENG-601).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mealImageFields, mealRowImageUrl } from "../../src/lib/nutrition/foodHistory";

const ROOT = resolve(__dirname, "../..");

describe("meal row image helpers", () => {
  it("mealRowImageUrl prefers recipeImageUrl then imageUrl", () => {
    expect(mealRowImageUrl({ recipeImageUrl: "https://a.test/x.jpg" })).toBe(
      "https://a.test/x.jpg",
    );
    expect(mealRowImageUrl({ imageUrl: "https://b.test/y.jpg" })).toBe(
      "https://b.test/y.jpg",
    );
    expect(mealRowImageUrl({ recipeImageUrl: "", imageUrl: "  " })).toBeUndefined();
  });

  it("mealImageFields only emits when non-empty", () => {
    expect(mealImageFields("https://c.test/z.jpg")).toEqual({
      recipeImageUrl: "https://c.test/z.jpg",
    });
    expect(mealImageFields(null)).toEqual({});
  });
});

describe("Today meals section — food-forward row UI", () => {
  const web = readFileSync(
    resolve(ROOT, "src/app/components/suppr/today-meals-section.tsx"),
    "utf8",
  );
  const mobile = readFileSync(
    resolve(ROOT, "apps/mobile/components/today/TodayMealsSection.tsx"),
    "utf8",
  );

  it("web uses mealRowImageUrl for optional hero thumb", () => {
    expect(web).toContain("mealRowImageUrl");
    expect(web).toMatch(/h-10 w-10 rounded-lg object-cover/);
  });

  it("mobile uses mealRowImageUrl + SmartImage thumb (ENG-685)", () => {
    expect(mobile).toContain("mealRowImageUrl");
    expect(mobile).toContain("<SmartImage");
  });
});

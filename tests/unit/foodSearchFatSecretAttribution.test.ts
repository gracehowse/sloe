/**
 * ENG-1121 — FatSecret attribution on the food-search results panel (web + mobile).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1121 — food-search FatSecret attribution wiring", () => {
  const web = read("src/app/components/food-search/FoodSearchPanel.tsx");
  const mobile = read("apps/mobile/components/food-search/FoodSearchPanel.tsx");

  it("web panel renders FatSecretBadge when branded content is visible", () => {
    expect(web).toContain("import { FatSecretBadge }");
    expect(web).toContain("showFatSecretAttribution");
    expect(web).toContain('data-testid="food-search-fatsecret-badge"');
    expect(web).toMatch(/preview\.source === "FatSecret"/);
    expect(web).toMatch(/r\._source === "FatSecret"/);
  });

  it("mobile panel mirrors web FatSecret attribution wiring", () => {
    expect(mobile).toContain("FatSecretBadge");
    expect(mobile).toContain("showFatSecretAttribution");
    expect(mobile).toContain('testID="food-search-fatsecret-badge"');
    expect(mobile).toMatch(/preview\.source === "FatSecret"/);
    expect(mobile).toMatch(/r\._source === "FatSecret"/);
  });
});

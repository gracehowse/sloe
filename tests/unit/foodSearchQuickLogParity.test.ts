/**
 * ENG-931 — instant log from search row (+) parity pin (web + mobile).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const SURFACES = [
  "apps/mobile/components/food-search/FoodSearchPanel.tsx",
  "src/app/components/food-search/FoodSearchPanel.tsx",
] as const;

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("ENG-931 — FoodSearchPanel quick-log from search row", () => {
  it.each(SURFACES)("%s defines onQuickLogResult and wires a row + affordance", (path) => {
    const src = read(path);
    expect(src).toMatch(/onQuickLogResult\s*=\s*useCallback/);
    expect(src).toMatch(/ENG-931/);
    expect(src).toMatch(/food-search-quick-log-/);
    expect(src).toMatch(/GenericBeverage|GenericFood/);
    expect(src).toMatch(/_source === "OFF"/);
    expect(src).toMatch(/_source === "USDA"/);
  });

  it("quick-log bypasses preview for generic/OFF/USDA with default serving", () => {
    for (const path of SURFACES) {
      const src = read(path);
      const fnStart = src.indexOf("onQuickLogResult = useCallback");
      expect(fnStart).toBeGreaterThanOrEqual(0);
      const fnBody = src.slice(fnStart, fnStart + 4500);
      expect(fnBody).toMatch(/onSelect\(/);
      expect(fnBody).toMatch(/await onPickResult\(item\)/);
    }
  });
});

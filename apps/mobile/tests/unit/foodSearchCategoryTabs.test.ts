/**
 * Mobile food-search category-filter tabs — ENG-748 #8.
 *
 * The `Favourites` category tab was a visible dead affordance: it
 * rendered in the tab row but always returned the unfiltered `results`
 * list (no `isFavourite`-per-row data model exists). Shipping a tab
 * that does nothing is a bug, so it was removed (rather than left as a
 * no-op) until a real favourites model lands.
 *
 * This source-pin breaks if the tab is re-introduced without a backing
 * data model — the same guard shape used by `mealSlotIconFamilyParity`.
 * (RN-renderer assertions can't reliably distinguish the tab row in
 * jsdom, so we pin the source.)
 *
 * Parity note: the web `FoodSearchPanel` has no category-filter tab row
 * at all (the tabs were a mobile-only 2026-05-14 premium-bar addition),
 * so there is no web surface to mirror this removal onto.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("food-search category tabs (ENG-748 #8)", () => {
  const src = read("apps/mobile/components/food-search/FoodSearchPanel.tsx");
  // Strip block + line comments so the explanatory prose ("Favourites
  // tab removed...") doesn't trip a pure-name grep — only real code
  // references should fail the assertions below.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("FoodCategory type no longer includes 'Favourites'", () => {
    const typeLine = code.match(/type FoodCategory =[^;]+;/);
    expect(typeLine, "FoodCategory type must exist").toBeTruthy();
    expect(typeLine?.[0]).not.toContain("Favourites");
  });

  it("CATEGORY_LIST does not render a Favourites tab", () => {
    const listBlock = code.match(/CATEGORY_LIST[\s\S]*?\];/);
    expect(listBlock, "CATEGORY_LIST must exist").toBeTruthy();
    expect(listBlock?.[0]).not.toContain("Favourites");
  });

  it("the filteredResults switch has no Favourites case", () => {
    expect(code).not.toMatch(/case\s+"Favourites"/);
  });

  it("the real category tabs that do filter are still present", () => {
    const listBlock = code.match(/CATEGORY_LIST[\s\S]*?\];/)?.[0] ?? "";
    for (const cat of ["All", "Recents", "Custom", "Branded", "Generic"]) {
      expect(listBlock).toContain(`"${cat}"`);
    }
  });
});

/**
 * ENG-998 — carbs macro letter in FoodSearchPanel library rows must use
 * `--macro-carbs`, not `text-primary` (which flips to damson under Frost).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");
const PANEL = readFileSync(
  join(ROOT, "src/app/components/food-search/FoodSearchPanel.tsx"),
  "utf8",
);

describe("ENG-998 — FoodSearchPanel macro triad colours", () => {
  it("library/search rows use macro CSS vars for P/C/F, not text-primary on carbs", () => {
    expect(PANEL).not.toMatch(/text-primary">C:/);
    expect(PANEL).toMatch(/text-\[var\(--macro-carbs\)\]">C:/);
    expect(PANEL).toMatch(/text-\[var\(--macro-protein\)\]">P:/);
    expect(PANEL).toMatch(/text-\[var\(--macro-fat\)\]">F:/);
  });
});

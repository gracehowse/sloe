/**
 * ENG-998 — carbs macro letter in FoodSearchPanel library rows must use
 * `--macro-carbs`, not `text-primary` (which flips to damson under Frost).
 *
 * ENG-814/ENG-1532 (`redesign_search_results` collapsed permanently-on,
 * ENG-1651) — the row-level P/C/F rendering now lives in the extracted
 * `FoodSearchResultRow.tsx` (pulled out of `FoodSearchPanel.tsx`), not the
 * panel itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");
const ROW = readFileSync(
  join(ROOT, "src/app/components/food-search/FoodSearchResultRow.tsx"),
  "utf8",
);

describe("ENG-998 — FoodSearchPanel macro triad colours", () => {
  it("library/search rows use macro CSS vars for P/C/F, not text-primary on carbs", () => {
    expect(ROW).not.toMatch(/text-primary">C /);
    expect(ROW).toMatch(/text-\[var\(--macro-carbs\)\]">C /);
    expect(ROW).toMatch(/text-\[var\(--macro-protein\)\]">P /);
    expect(ROW).toMatch(/text-\[var\(--macro-fat\)\]">F /);
  });
});

/**
 * F-114 (`AHOkMJ8yu5hA`, 2026-05-07) — pin that both FoodSearchPanel
 * surfaces (mobile + web) catch errors in `loadMore` and stop further
 * pagination attempts when a page fetch fails.
 *
 * Pre-fix shape: `loadMore` had only `try/finally`. A throwing
 * `searchFoods` (network failure, session refresh hang, server 5xx)
 * left `hasMoreRef.current = true`, so every subsequent scroll-to-
 * bottom retriggered the same failing fetch — endless spinner
 * cycle, no user-visible explanation. Tester report described this
 * as "Gets stuck trying to get more data".
 *
 * Post-fix: `try/catch/finally` with the catch setting
 * `hasMoreRef.current = false` and logging the failure. The list
 * settles into a final state on first error.
 *
 * Static-analysis pin so a future agent can't drop the catch block
 * silently.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

const SURFACES: ReadonlyArray<string> = [
  "apps/mobile/components/food-search/FoodSearchPanel.tsx",
  "src/app/components/food-search/FoodSearchPanel.tsx",
];

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-114 — FoodSearchPanel loadMore catches errors and stops further attempts", () => {
  it.each(SURFACES)("$0 has a catch block in loadMore that flips hasMoreRef.current to false", (path) => {
    const src = read(path);
    // Strip block + line comments so the regex inspects code only.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // The loadMore body must include both: a `} catch` clause AND a
    // `hasMoreRef.current = false` assignment. We don't try to parse
    // exact AST positions — these two together is the contract.
    expect(code).toMatch(/loadMore\s*=\s*useCallback/);
    expect(code).toMatch(/}\s*catch\s*\(/);
    // Two false-flips per file: one in the empty-page branch, one in
    // the catch. Pre-fix had only one (empty-page); post-fix has two.
    const flips = (code.match(/hasMoreRef\.current\s*=\s*false/g) ?? []).length;
    expect(flips).toBeGreaterThanOrEqual(2);
  });
});

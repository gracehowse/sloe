/**
 * F-114 broader sweep (2026-05-07) — pin try/catch/finally on the 4
 * surfaces `performance-optimizer` flagged as the top stuck-spinner
 * candidates.
 *
 * Pre-fix shape: bare `await` chains under `setLoading(true)` /
 * `setGenerating(true)`. A rejection stranded the spinner true
 * indefinitely.
 *
 * Post-fix: every spinner state must have a corresponding finally
 * block (or catch + finally) that always resets the flag.
 *
 * Static analysis pin so a future agent can't drop the catch /
 * finally silently.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-114 broader sweep — initial loaders have try/catch/finally", () => {
  const SURFACES: Array<{ path: string; expectedFinallyCount: number; setterName: string }> = [
    // Mobile: recipe verify initial load.
    { path: "apps/mobile/app/recipe/verify.tsx", expectedFinallyCount: 1, setterName: "setLoading" },
    // Mobile: recipe detail initial load.
    { path: "apps/mobile/app/recipe/[id].tsx", expectedFinallyCount: 1, setterName: "setLoading" },
    // Mobile: planner regenerate.
    { path: "apps/mobile/app/(tabs)/planner.tsx", expectedFinallyCount: 1, setterName: "setGenerating" },
    // Mobile: FoodSearchPanel debounced first-page search.
    { path: "apps/mobile/components/food-search/FoodSearchPanel.tsx", expectedFinallyCount: 2, setterName: "setLoading" },
    // Web: FoodSearchPanel debounced first-page search.
    { path: "src/app/components/food-search/FoodSearchPanel.tsx", expectedFinallyCount: 2, setterName: "setLoading" },
  ];

  it.each(SURFACES)("$path has at least $expectedFinallyCount `} finally {` block(s)", ({ path, expectedFinallyCount }) => {
    const src = read(path);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const finallyCount = (code.match(/}\s*finally\s*\{/g) ?? []).length;
    expect(finallyCount).toBeGreaterThanOrEqual(expectedFinallyCount);
  });

  it.each(SURFACES)("$path resets the spinner state ($setterName(false)) inside a finally block", ({ path, setterName }) => {
    const src = read(path);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Find every `} finally {` and verify at least one of them
    // contains the spinner-reset call.
    const finallyBlocks = code.match(/}\s*finally\s*\{[^}]*\}/g) ?? [];
    const setterFalseRe = new RegExp(`${setterName}\\(\\s*false\\s*\\)`);
    const setterCancelGuardedRe = new RegExp(`if\\s*\\(!cancelled\\)\\s*${setterName}\\(\\s*false\\s*\\)`);
    const hasResetInFinally = finallyBlocks.some(
      (block) => setterFalseRe.test(block) || setterCancelGuardedRe.test(block),
    );
    expect(hasResetInFinally, `${path}: no finally block resets ${setterName}(false)`).toBe(true);
  });
});

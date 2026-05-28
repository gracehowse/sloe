/**
 * F-114 broader sweep (2026-05-07) — pin stuck-spinner protections on the
 * surfaces `performance-optimizer` flagged as top stuck-spinner candidates.
 *
 * Pre-fix shape: bare `await` chains under `setLoading(true)` /
 * `setGenerating(true)`. A rejection stranded the spinner true indefinitely.
 *
 * Post-fix invariant: every spinner state must always be reset after a search
 * completes or errors. Implementations vary:
 *   - try/catch/finally (original pattern)
 *   - streaming Promise.race loop with per-source .catch() + unconditional
 *     setLoading(false) on first arrival (ENG-686 — web FoodSearchPanel)
 *
 * Static analysis pin so a future agent can't silently drop the reset path.
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
    // Web FoodSearchPanel is excluded from this check — it uses the ENG-686
    // streaming Promise.race pattern which resets the spinner on first arrival
    // rather than in a finally block. See the dedicated check below.
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

describe("ENG-686 — web FoodSearchPanel streaming pattern still resets loading", () => {
  // The web FoodSearchPanel uses the streaming Promise.race pattern (ENG-686)
  // instead of try/catch/finally. The invariant: setLoading(false) is called
  // unconditionally via the firstArrived guard + the post-loop fallback.
  it("src/app/components/food-search/FoodSearchPanel.tsx uses streaming with unconditional setLoading(false) reset", () => {
    const src = read("src/app/components/food-search/FoodSearchPanel.tsx");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // The streaming loop must have the firstArrived guard pattern.
    expect(code).toMatch(/firstArrived/);
    // setLoading(false) must appear at least twice (first-arrival + post-loop fallback).
    const resetCount = (code.match(/setLoading\(\s*false\s*\)/g) ?? []).length;
    expect(resetCount).toBeGreaterThanOrEqual(2);
    // Each external source must catch errors (no bare await without catch).
    expect(code).toMatch(/\.catch\(\s*\(\)\s*=>/);
  });
});

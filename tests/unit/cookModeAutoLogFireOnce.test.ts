/**
 * Polish A.1 (2026-04-25 follow-up) — pin the cook-mode → recipe page
 * autoLog flow. Cook mode's "Log this meal" CTA uses
 * `router.replace(`/recipe/${recipeId}?autoLog=1`)`; the recipe page
 * reads `autoLog` from the URL params, fires
 * `addRecipeToTodayJournal()` once via a `useRef`-guarded effect, and
 * never re-fires on subsequent re-renders or back-navigation.
 *
 * The contract has three parts; this test pins each one statically.
 * If a future change removes the ref, drops the URL param, or re-fires
 * on every render, this test fails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const COOK = readFileSync(resolve(REPO, "apps/mobile/app/cook.tsx"), "utf8");
const RECIPE = readFileSync(resolve(REPO, "apps/mobile/app/recipe/[id].tsx"), "utf8");

describe("cook-mode autoLog flow (P2-24 + polish A.1)", () => {
  it("cook.tsx done state navigates with `?autoLog=1` and fires the cook_mode_log_tapped analytics event", () => {
    expect(COOK).toMatch(/router\.replace\(`\/recipe\/\$\{recipeId\}\?autoLog=1`/);
    expect(COOK).toMatch(/cook_mode_log_tapped/);
  });

  it("cook.tsx exposes a 'Skip — back to recipe' fallback so users who don't want to log aren't trapped", () => {
    expect(COOK).toMatch(/Skip\s*[—-]\s*back to recipe/);
  });

  it("recipe/[id].tsx reads autoLog from useLocalSearchParams", () => {
    expect(RECIPE).toMatch(/useLocalSearchParams<\{[^}]*autoLog\?:\s*string/);
  });

  it("recipe/[id].tsx fires addRecipeToTodayJournal exactly once via a useRef-guarded effect", () => {
    // The ref-guard pattern: useRef<string | null>(null), effect checks
    // current === recipe.id before firing, sets ref to recipe.id after.
    expect(RECIPE).toMatch(/autoLogFiredRef\s*=\s*useRef<string\s*\|\s*null>/);
    expect(RECIPE).toMatch(/autoLogFiredRef\.current\s*===\s*recipe\.id/);
    expect(RECIPE).toMatch(/autoLogFiredRef\.current\s*=\s*recipe\.id/);
    expect(RECIPE).toMatch(/void\s+addRecipeToTodayJournal\(\)/);
  });

  it("the autoLog effect's dependency array references the relevant inputs (no missing deps that would silently mis-fire)", () => {
    // We don't pin the exact deps array shape (formatting may shift),
    // but we pin that the effect mentions the four signals it needs:
    // autoLog, recipe, userId, addRecipeToTodayJournal.
    const autoLogEffectIdx = RECIPE.indexOf("autoLogFiredRef");
    expect(autoLogEffectIdx).toBeGreaterThan(0);
    // Take a 600-char window around the effect to inspect the deps.
    const window = RECIPE.slice(Math.max(0, autoLogEffectIdx - 100), autoLogEffectIdx + 600);
    expect(window).toMatch(/\[autoLog,\s*recipe,\s*userId,\s*addRecipeToTodayJournal\]/);
  });

  it("the recipe page guards on userId + recipe before firing — no fire-on-mount with an unauthenticated session", () => {
    const idx = RECIPE.indexOf("autoLogFiredRef");
    const window = RECIPE.slice(idx, idx + 500);
    expect(window).toMatch(/if\s*\(\s*autoLog\s*!==\s*["']1["']\s*\)\s*return/);
    expect(window).toMatch(/if\s*\(\s*!recipe\s*\|\|\s*!userId\s*\)\s*return/);
  });
});

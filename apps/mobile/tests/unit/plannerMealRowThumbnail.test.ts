/**
 * Planner meal-row thumbnail.
 *
 * Wave-2 (2026-04-30): the per-day meal rows surface the recipe hero
 * image, replacing the generic slot icon when the meal has both a recipe
 * AND an image. Empty slots fall back to the slot-tinted lucide icon-box
 * so the row layout never drifts.
 *
 * 2026-06-08 (recipe-card §11.4 pass): the rendering moved into a
 * `PlanMealThumb` helper so a stale/expired hero URL that FAILS to load —
 * previously an empty tinted box — now settles into the warm sage→cream
 * `RecipeHeroFallback` tile (the same calm placeholder as the Library /
 * Discover cards). The ladder is: real image → warm recipe-keyed fallback
 * (no image OR onError) → slot icon-box (genuinely empty slot).
 *
 * Structural source-level test: mounting Plan in vitest pulls
 * Supabase / RC / haptics / etc.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const SRC = readFileSync(PLANNER_PATH, "utf8");

describe("Planner meal-row thumbnail", () => {
  it("imports the React Native Image primitive", () => {
    // Sits in the standard react-native named import block at the top
    // of planner.tsx alongside View / Text / Pressable.
    expect(SRC).toMatch(/from "react-native"[\s\S]{0,4}/);
    expect(SRC).toMatch(/^\s*Image,\s*$/m);
  });

  it("extends PlanRecipeRef with an optional image field", () => {
    expect(SRC).toContain("image?: string | null");
    // The pool builder maps `image` from the saved/discover recipe
    // shape (which already exposes `image` derived from `image_url`).
    expect(SRC).toMatch(/image:\s*\(r as \{ image\?: string \| null \}\)\.image/);
  });

  it("renders the thumbnail through the PlanMealThumb helper", () => {
    expect(SRC).toMatch(/function PlanMealThumb/);
    expect(SRC).toMatch(/<PlanMealThumb/);
    // It still renders the recipe photo via an <Image source={{ uri }}>.
    expect(SRC).toMatch(/source=\{\{\s*uri:\s*trimmed\s*\}\}/);
  });

  it("falls back to the warm RecipeHeroFallback on a broken/missing image (§11.4)", () => {
    // The on-error path is the key fix — a stale hero URL now settles
    // into the calm sage→cream tile, not an empty tinted box.
    expect(SRC).toMatch(/<RecipeHeroFallback/);
    expect(SRC).toMatch(/onError=\{\(\) => setBroken\(true\)\}/);
  });

  it("falls back to the lucide slot icon-box for genuinely empty slots", () => {
    // The slot-icon path is preserved (now inside PlanMealThumb) — guards
    // against a regression where empty / unimaged slots blow up.
    expect(SRC).toMatch(/<Icon size=\{16\} color=\{tint\} strokeWidth=\{1\.75\} \/>/);
  });

  it("declares the truncateMealName dead-code helper has been removed", () => {
    // Audit hygiene: the old 12-char truncator + the dayCardMeal
    // styles it would have written into were dead code. (Styles
    // `dayCardMeal` etc. are kept for now since they're also unused but
    // removal is mechanical and not part of this fix's intent.)
    expect(SRC).not.toContain("const truncateMealName");
  });
});

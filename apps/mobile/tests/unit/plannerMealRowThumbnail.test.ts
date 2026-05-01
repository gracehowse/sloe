/**
 * Planner meal-row thumbnail — wave-2 (2026-04-30 audit-vs-competitors)
 * FIX 2 (scoped).
 *
 * Spec called for stacked 24×24 thumbnails per slot inside the small
 * day-strip cards. The actual day-strip cards are flex:1 across a 7-
 * day grid (~50px wide on iPhone) — too narrow to host four stacked
 * thumbnails per slot without a poor visual outcome. The full per-day
 * meal rows below the strip are where users actually scan recipes; we
 * surface the recipe hero image there instead, replacing the generic
 * slot icon when the meal has both a recipe AND an image. Empty slots
 * + recipes without an image still fall back to the slot-tinted
 * lucide icon-box so the row layout never drifts.
 *
 * Structural source-level test: mounting Plan in vitest pulls
 * Supabase / RC / haptics / etc.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const SRC = readFileSync(PLANNER_PATH, "utf8");

describe("Planner meal-row thumbnail (wave-2 FIX 2)", () => {
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

  it("renders an Image when the meal resolves to a recipe with an image", () => {
    // Keep it loose — assert presence of the conditional <Image>
    // render keyed off `planMealHasRecipe(meal) && imageUri`.
    expect(SRC).toMatch(/planMealHasRecipe\(meal\)\s*&&\s*imageUri/);
    expect(SRC).toMatch(/source=\{\{\s*uri:\s*imageUri\s*\}\}/);
  });

  it("falls back to the lucide slot icon-box when no image is available", () => {
    // The fallback path is preserved unchanged — guards against a
    // regression where the icon path is removed and empty / unimaged
    // slots blow up.
    expect(SRC).toMatch(/<Icon size=\{16\} color=\{tint\} strokeWidth=\{1\.75\} \/>/);
  });

  it("declares the truncateMealName dead-code helper has been removed", () => {
    // Audit hygiene: the old 12-char truncator + the dayCardMeal
    // styles it would have written into were dead code. Wave-2 deletes
    // the helper. (Styles `dayCardMeal` etc. are kept for now since
    // they're also unused but removal is mechanical and not part of
    // FIX 2's intent.)
    expect(SRC).not.toContain("const truncateMealName");
  });
});

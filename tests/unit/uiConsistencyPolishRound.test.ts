/**
 * Polish (2026-04-26) — UI consistency round, pin the structural fixes
 * we landed across mobile + web so future PRs cannot quietly regress them.
 *
 * Each block reads a source file and asserts the canonical pattern is
 * present (or the broken pattern is absent). Cheap, no rendering — runs
 * in the existing vitest suite without test setup.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(REPO, rel), "utf8");

describe("Recipe Detail polish (mobile)", () => {
  const SRC = read("apps/mobile/app/recipe/[id].tsx");

  it("does not render the duplicate lowercase meal-type pill on the tag row", () => {
    // Pre-fix the tag row mapped over `pillTags` (the lowercase meal-type
    // strings). The "Lunch" pill below the title is canonical.
    expect(SRC).not.toMatch(/pillTags\.map\s*\(/);
  });

  // The fit-percent pill ("{fitPercent}% match") was INTENTIONALLY REMOVED in
  // commit effefaea (GW-08 — dishonest trust chip; the helper fell back to a
  // hard-coded NEUTRAL_FALLBACK=85, so every recipe showed "85% match" as pure
  // decoration). There is no test for it here because there is no pill to test.

  it("uses the servings STEPPER (RecipeServingsFooter) instead of the legacy portion-preset buttons", () => {
    // Figma 332:2 redesign replaced the {0.5, 1, 1.5, 2} portion-preset button
    // row with a dedicated servings stepper (RecipeServingsFooter). The preset
    // array is gone; logPortion is now driven by the stepper's viewMultiplier.
    expect(SRC).toContain("RecipeServingsFooter");
    expect(SRC).toContain("logPortion");
    // The old preset button array must be gone from the screen file.
    expect(SRC).not.toMatch(/\[0\.5,\s*0\.75,\s*1,\s*1\.5,\s*2\]/);
    expect(SRC).not.toMatch(/\[0\.5,\s*1,\s*1\.5,\s*2\]\s*as const/);
  });
});

describe("Create Recipe polish (mobile)", () => {
  const SRC = read("apps/mobile/app/create-recipe.tsx");

  it("uses the canonical primary colour for the Save Recipe submit (not Accent.success)", () => {
    // The save-button stylesheet must use the theme-aware aubergine ink
    // (accentInk = accent.primarySolid / primarySolidDark, not Accent.success).
    // The redesign patched the static Accent.primary reference to the computed
    // `accentInk` variable so dark-mode contrast holds; semantically still
    // aubergine. Pin via the named-property pattern around saveBtn.
    const idx = SRC.indexOf("saveBtn:");
    expect(idx).toBeGreaterThan(0);
    const block = SRC.slice(idx, idx + 400);
    expect(block).toMatch(/backgroundColor:\s*accentInk/);
    expect(block).not.toMatch(/backgroundColor:\s*Accent\.success/);
  });

  it("removed the duplicate uppercase CREATE submit at the top of the form", () => {
    // Pre-fix the header strip rendered <Text style={styles.topTitle}>CREATE</Text>
    // alongside the bottom Save Recipe button — two affordances for the
    // same action. The submit lives at the bottom only.
    expect(SRC).not.toMatch(/styles\.topTitle\}>CREATE</);
  });

  it("uses 'New recipe' (Title case) in the header strip, matching every other navigation header", () => {
    expect(SRC).toMatch(/styles\.topTitle\}>New recipe</);
  });
});

describe("Title normalisation at render boundary", () => {
  it("mobile useDiscoverRecipes routes title through normalizeRecipeTitle", () => {
    const SRC = read("apps/mobile/lib/recipes.ts");
    expect(SRC).toMatch(/import \{ normalizeRecipeTitle \}/);
    expect(SRC).toMatch(/title:\s*normalizeRecipeTitle\(r\.title\)/);
  });

  it("web AppDataContext routes title through normalizeRecipeTitle", () => {
    const SRC = read("src/context/AppDataContext.tsx");
    expect(SRC).toMatch(/import \{ normalizeRecipeTitle \}/);
    expect(SRC).toMatch(/title:\s*normalizeRecipeTitle\(/);
  });
});

describe("Recipes prominence (mobile tab bar) — Phase 2 collapse", () => {
  const SRC = read("apps/mobile/app/(tabs)/_layout.tsx");

  it("the Library route is the Recipes default sub-tab and remains a visible primary entry", () => {
    // Phase 2 / B1.1 (2026-04-27, D-2026-04-27-02): the previous
    // 6-tab structure surfaced Library as its own primary tab.
    // The collapse re-labels the same `name="library"` Tabs.Screen
    // entry to the visible title "Recipes" — it remains a visible
    // tab-bar entry (NOT `href: null`) and routes to /library by
    // default. This pins both: the entry stays visible, and its
    // title is now "Recipes".
    expect(SRC).toMatch(/name="library"\s*\n\s*options=\{\{\s*\n\s*title:\s*'Recipes'/);
    expect(SRC).not.toMatch(/<Tabs\.Screen name="library" options=\{\{ href: null \}\} \/>/);
  });

  it("Recipes uses the BookOpen icon (lucide)", () => {
    expect(SRC).toMatch(/import \{[^}]*BookOpen[^}]*\} from 'lucide-react-native'/);
    expect(SRC).toMatch(/<BookOpen size=\{22\}/);
  });
});

describe("Import idempotency (mobile)", () => {
  const SRC = read("apps/mobile/lib/saveImportedRecipe.ts");

  it("guards against duplicate import by source_url before insert", () => {
    // The guard must select existing recipe by (author_id, source_url)
    // and return its id without inserting if a match exists.
    expect(SRC).toMatch(/eq\("author_id",\s*userId\)\s*\.eq\("source_url",\s*sourceUrl\)/);
    expect(SRC).toMatch(/return \{ recipeId: existingId \}/);
  });

  it("guard is gated on sourceUrl !== null (manual creates skip the check)", () => {
    expect(SRC).toMatch(/if \(sourceUrl\) \{/);
  });
});

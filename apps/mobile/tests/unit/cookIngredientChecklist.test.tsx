import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");

describe("ENG-946 ingredient checklist wiring", () => {
  it("mobile cook screen gates mise en place", () => {
    const src = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    expect(src).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
    expect(src).toContain("CookMiseEnPlace");
  });

  it("ENG-1329 — mobile recipe detail does NOT duplicate the checklist on the static Ingredients tab", () => {
    // The checklist always starts fully unchecked; duplicated directly under
    // the "Matching…" auto-verify text it read as a stalled matching-progress
    // indicator (two ingredient lists on one screen). CookMiseEnPlace (Cook
    // Mode only) is the sole place it renders now.
    const src = readFileSync(join(REPO, "apps/mobile/app/recipe/[id].tsx"), "utf8");
    expect(src).not.toContain("<CookIngredientChecklist");
    expect(src).not.toContain('surface="recipe_detail"');
    expect(src).toContain("CookMiseEnPlace");
  });

  it("web CookMode gates the checklist; RecipeDetail does NOT duplicate it (ENG-1329)", () => {
    const cook = readFileSync(join(REPO, "src/app/components/CookMode.tsx"), "utf8");
    const detail = readFileSync(join(REPO, "src/app/components/RecipeDetail.tsx"), "utf8");
    expect(cook).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
    expect(cook).toContain("CookMiseEnPlace");
    expect(detail).not.toContain("<CookIngredientChecklist");
  });

  it("ENG-1532 — both platforms build checklist rows from the CLEANED ingredient name", () => {
    // Web CookMode has always cleaned the display name; the mobile cook screen
    // echoed the raw stored name ("2 rashers …" title over a "2 rasher"
    // amount). Pin the identical expression on both so neither regresses.
    const mobileCook = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    const webCook = readFileSync(join(REPO, "src/app/components/CookMode.tsx"), "utf8");
    for (const src of [mobileCook, webCook]) {
      expect(src).toContain("cleanIngredientDisplayName(ing.name) || ing.name");
    }
    // And the mobile import resolves to the shared helper (single source).
    expect(mobileCook).toContain(
      'import { cleanIngredientDisplayName } from "@suppr/shared/recipe/cleanIngredientDisplayName"',
    );
  });
});

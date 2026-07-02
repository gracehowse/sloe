import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");

describe("ENG-942 cook ingredient panel", () => {
  it("mobile cook screen wires ListChecks header + peek sheet behind checklist flag", () => {
    const cook = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    expect(cook).toContain("useCookIngredientPanelUi");
    expect(cook).toContain("ingredientPanel.headerToggle");
    expect(cook).toContain("ingredientPanel.sheet");
    expect(cook).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
  });

  it("panel hook renders shared checklist + header toggle", () => {
    const ui = readFileSync(join(REPO, "apps/mobile/hooks/useCookIngredientPanelUi.tsx"), "utf8");
    const toggle = readFileSync(
      join(REPO, "apps/mobile/components/cook/CookIngredientPanelHeaderToggle.tsx"),
      "utf8",
    );
    expect(ui).toContain("CookIngredientPanelSheet");
    expect(toggle).toContain('testID="cook-ingredient-panel-toggle"');
    const sheet = readFileSync(
      join(REPO, "apps/mobile/components/cook/CookIngredientPanelSheet.tsx"),
      "utf8",
    );
    expect(sheet).toContain("CookIngredientChecklist");
    expect(sheet).toContain('surface="cook"');
  });
});

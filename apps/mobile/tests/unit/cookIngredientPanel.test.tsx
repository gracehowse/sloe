import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");

describe("ENG-942 cook ingredient panel", () => {
  it("mobile cook screen wires ListChecks header + peek sheet behind checklist flag", () => {
    const cook = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    expect(cook).toContain("CookIngredientPanelSheet");
    expect(cook).toContain('testID="cook-ingredient-panel-toggle"');
    expect(cook).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
    expect(cook).toContain("showIngredientPanel");
  });

  it("panel sheet component renders shared checklist", () => {
    const sheet = readFileSync(
      join(REPO, "apps/mobile/components/cook/CookIngredientPanelSheet.tsx"),
      "utf8",
    );
    expect(sheet).toContain("CookIngredientChecklist");
    expect(sheet).toContain('surface="cook"');
    expect(sheet).toContain('testID="cook-ingredient-panel-sheet"');
  });
});

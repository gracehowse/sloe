import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHEET = readFileSync(
  resolve(__dirname, "../../components/recipe/CreateRecipeActionSheet.tsx"),
  "utf8",
);
const GRID = readFileSync(
  resolve(__dirname, "../../components/recipe/CreateRecipeActionSheetGrid.tsx"),
  "utf8",
);

describe("CreateRecipeActionSheet — 2×2 grid (ENG-898)", () => {
  it("gates the Julienne grid behind create_recipe_action_sheet_grid_v1", () => {
    expect(SHEET).toMatch(/isFeatureEnabled\("create_recipe_action_sheet_grid_v1"\)/);
    expect(SHEET).toMatch(/gridLayout \?/);
    expect(SHEET).toMatch(/CreateRecipeActionSheetGrid/);
    expect(SHEET).toMatch(/<ActionRow/);
  });

  it("renders four equal tiles in a 2×2 layout with primary link emphasis", () => {
    expect(GRID).toMatch(/Paste a link/);
    expect(GRID).toMatch(/Scan a photo/);
    expect(GRID).toMatch(/From a PDF/);
    expect(GRID).toMatch(/Create manually/);
    expect(GRID).toMatch(/flexDirection: "row"/);
    expect(GRID).toMatch(/minHeight: 120/);
    expect(GRID).toMatch(/primary \? `\$\{accentPrimary\}14`/);
  });

  it("keeps photo Pro lock + coming-soon PDF when cookbook flag is off", () => {
    expect(GRID).toMatch(/proLocked={isFreeTier}/);
    expect(GRID).toMatch(/comingSoon={!cookbookImportEnabled}/);
    expect(GRID).toMatch(/Coming soon/);
    expect(GRID).toMatch(/Lock size=\{12\}/);
  });

  it("includes the demoted manual scratch row below the grid", () => {
    expect(GRID).toMatch(/Or write from scratch/);
    expect(GRID).toMatch(/create-action-sheet-scratch-row/);
  });
});

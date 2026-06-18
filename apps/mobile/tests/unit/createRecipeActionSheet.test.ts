/**
 * CreateRecipeActionSheet — import.md §3.1 two-by-two source tile grid.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../components/recipe/CreateRecipeActionSheet.tsx"),
  "utf8",
);

describe("CreateRecipeActionSheet — 2×2 source tiles (ENG-898)", () => {
  it("renders a tile grid with link, photo, PDF, and manual entries", () => {
    expect(SRC).toMatch(/function SourceTile/);
    expect(SRC).toMatch(/create-action-sheet-link/);
    expect(SRC).toMatch(/create-action-sheet-photo/);
    expect(SRC).toMatch(/create-action-sheet-cookbook/);
    expect(SRC).toMatch(/create-action-sheet-manual/);
  });

  it("Pro-gates photo before routing to the picker", () => {
    expect(SRC).toMatch(/isFreeTier/);
    expect(SRC).toMatch(/from: "create_photo"/);
    expect(SRC).toMatch(/proLocked/);
    expect(SRC).toMatch(/<Lock size=\{10\}/);
  });

  it("uses PressableScale confirm haptic on source tiles", () => {
    expect(SRC).toMatch(/PressableScale[\s\S]{0,80}haptic=\{disabled \? "none" : "confirm"\}/);
  });
});

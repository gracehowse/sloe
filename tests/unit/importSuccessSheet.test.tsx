// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ImportSuccessSheet } from "../../src/app/components/suppr/import-success-sheet";

describe("ENG-901 M6 — ImportSuccessSheet (web)", () => {
  it("renders saved kicker, title, macro line, and library chip", () => {
    render(
      <ImportSuccessSheet
        recipeTitle="Sheet-Pan Chicken"
        recipeId="recipe-1"
        macroLine="420 kcal · 32P · 12C · 18F per serving"
        onViewRecipe={() => {}}
      />,
    );
    expect(screen.getByTestId("import-success-sheet")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Sheet-Pan Chicken")).toBeInTheDocument();
    expect(screen.getByText(/420 kcal/)).toBeInTheDocument();
    expect(screen.getByText("In your library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View recipe" })).toBeInTheDocument();
  });
});

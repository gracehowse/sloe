// @vitest-environment jsdom
/**
 * ImportReviewFlaggedNote (mobile, ENG-1283) — the honest under-count note on
 * the import review card. Mirror of the web `tests/unit/importReviewFlaggedNote`.
 *
 * Pins the observable behaviour:
 *   - a flagged import shows the "N of M ingredients need review" line;
 *   - a missing macro spine shows the "couldn't be calculated" line;
 *   - a clean, fully-matched import renders NOTHING (today's silent success).
 *
 * Plus a wiring/parity source-grep on `import-shared.tsx`: the note is
 * flag-gated on `import_review_flagged_ingredients_v1` (flag-off = today's
 * render), and the per-row marking reuses the SHARED `isFlaggedIngredientRow`
 * predicate so the row affordance agrees with the "N of M" count.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    border: "#E5E0D8",
    inputBg: "#FFFFFF",
  }),
}));

import { ImportReviewFlaggedNote } from "../../components/import/ImportReviewFlaggedNote";

const matched = (source: string) => ({ source, calories: 120 });
const unverified = () => ({ source: "Unverified", calories: 0 });

const IMPORT_SHARED = readFileSync(resolve(__dirname, "../../app/import-shared.tsx"), "utf8");

describe("ImportReviewFlaggedNote (mobile)", () => {
  it("surfaces the honest 'N of M' line when ≥1 ingredient is flagged", () => {
    const { getByTestId, getByText } = render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 500, ingredientMacros: [matched("USDA"), unverified(), unverified()] }}
      />,
    );
    expect(getByTestId("import-review-flagged-note")).toBeTruthy();
    expect(
      getByText("2 of 3 ingredients need review — the macro total may be incomplete."),
    ).toBeTruthy();
  });

  it("surfaces the 'couldn't be calculated' line when the macro spine is missing", () => {
    const { getByText } = render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 0, ingredientMacros: [matched("USDA"), matched("OFF")] }}
      />,
    );
    expect(
      getByText("The macro total couldn't be calculated — review the ingredients before saving."),
    ).toBeTruthy();
  });

  it("renders NOTHING for a clean, fully-matched import (silent success)", () => {
    const { queryByTestId } = render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 400, ingredientMacros: [matched("USDA"), matched("OFF")] }}
      />,
    );
    expect(queryByTestId("import-review-flagged-note")).toBeNull();
  });
});

describe("import-shared.tsx wiring (ENG-1283)", () => {
  it("flag-gates the honest note on import_review_flagged_ingredients_v1", () => {
    expect(IMPORT_SHARED).toContain('isFeatureEnabled("import_review_flagged_ingredients_v1")');
    expect(IMPORT_SHARED).toContain("importReviewHonesty && <ImportReviewFlaggedNote recipe={pendingRecipe} />");
  });

  it("per-row marking reuses the shared isFlaggedIngredientRow predicate when ON", () => {
    expect(IMPORT_SHARED).toContain("importReviewHonesty\n                    ? isFlaggedIngredientRow(m)");
  });
});

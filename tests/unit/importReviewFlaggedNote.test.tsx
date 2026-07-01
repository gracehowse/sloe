/**
 * ImportReviewFlaggedNote (web, ENG-1283) — the honest under-count note on the
 * import review. Pins the observable behaviour: a flagged import shows the
 * "N of M ingredients need review" line; a clean import renders nothing (today's
 * silent-success stays). Derivation is the SHARED `importQualitySignal`
 * predicate — no recompute here.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ImportReviewFlaggedNote } from "../../src/app/components/import/ImportReviewFlaggedNote";

const matched = (source: string) => ({ source, calories: 120 });
const unverified = () => ({ source: "Unverified", calories: 0 });

describe("ImportReviewFlaggedNote (web)", () => {
  it("surfaces the honest 'N of M' line when ≥1 ingredient is flagged", () => {
    render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 500, ingredientMacros: [matched("USDA"), unverified(), unverified()] }}
      />,
    );
    expect(screen.getByTestId("import-review-flagged-note")).toBeDefined();
    expect(
      screen.getByText("2 of 3 ingredients need review — the macro total may be incomplete."),
    ).toBeDefined();
  });

  it("surfaces the 'couldn't be calculated' line when the macro spine is missing", () => {
    render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 0, ingredientMacros: [matched("USDA"), matched("OFF")] }}
      />,
    );
    expect(
      screen.getByText(
        "The macro total couldn't be calculated — review the ingredients before saving.",
      ),
    ).toBeDefined();
  });

  it("renders NOTHING for a clean, fully-matched import (silent success)", () => {
    const { container } = render(
      <ImportReviewFlaggedNote
        recipe={{ calories: 400, ingredientMacros: [matched("USDA"), matched("OFF")] }}
      />,
    );
    expect(screen.queryByTestId("import-review-flagged-note")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});

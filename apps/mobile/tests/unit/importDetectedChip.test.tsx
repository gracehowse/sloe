// @vitest-environment jsdom
/**
 * ImportDetectedChip (mobile, ENG-1225 #3) — parity mirror of the web chip:
 * renders a "Detected: {label}" cue per classified kind, nothing for empty.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";
import { ImportDetectedChip } from "../../components/import/ImportDetectedChip";

vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primarySoft: "#eee", primarySolid: "#3b2a4d" }),
}));

void React;

describe("ImportDetectedChip (mobile)", () => {
  it("labels a recipe link", () => {
    const { getByText } = render(
      <ImportDetectedChip input="https://www.bbcgoodfood.com/recipes/lasagne" />,
    );
    expect(getByText("Detected: Recipe link")).toBeTruthy();
  });

  it("labels a meal plan", () => {
    const plan = "Monday\nBreakfast: eggs\nLunch: salad\nTuesday\nDinner: salmon";
    expect(render(<ImportDetectedChip input={plan} />).getByText("Detected: Meal plan")).toBeTruthy();
  });

  it("renders nothing for empty input", () => {
    expect(render(<ImportDetectedChip input="  " />).toJSON()).toBeNull();
  });
});

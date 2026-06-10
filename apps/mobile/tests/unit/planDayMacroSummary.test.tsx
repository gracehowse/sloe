// @vitest-environment jsdom
/**
 * `<PlanDayMacroSummary>` unit coverage — the calm Sloe day-row macro line.
 *
 * Replaces the cramped inline run `P 0g ⁻¹⁰¹  C 0g ⁻⁶⁸ …` under each Plan
 * day header with four evenly-spread cells. The presentational contract
 * the Plan tab depends on, pinned here so the day-row can't silently
 * regress to clutter:
 *
 *   1. One cell per macro renders the letter + rounded grams.
 *   2. Within the ±15% close band a cell reads "On track" (sage), NOT a gap.
 *   3. Outside the band a cell shows a signed gap (`+N g` over / `−N g`
 *      under) — amber, never red (over = amber per the carryover rules).
 *   4. Grams are rounded for display; the accessibility label states the
 *      over/under direction so the row scans by screen reader too.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { PlanDayMacroSummary } from "../../components/plan/PlanDayMacroSummary";

void React;

const CELLS = [
  { label: "P", value: 150, target: 150, color: "#7C8466" }, // exactly on target → On track
  { label: "C", value: 0, target: 200, color: "#C8794E" }, // far under → −200g
  { label: "F", value: 90, target: 60, color: "#C9892C" }, // +50% over → +30g
  { label: "Fi", value: 27, target: 30, color: "#4A7878" }, // within 15% → On track
] as const;

describe("PlanDayMacroSummary", () => {
  it("renders one cell per macro with the letter + rounded grams", () => {
    const { getByText } = render(<PlanDayMacroSummary cells={CELLS} />);
    expect(getByText("P 150g")).toBeTruthy();
    expect(getByText("C 0g")).toBeTruthy();
    expect(getByText("F 90g")).toBeTruthy();
    expect(getByText("Fi 27g")).toBeTruthy();
  });

  it("shows 'On track' for macros within the ±15% close band", () => {
    const { getAllByText } = render(<PlanDayMacroSummary cells={CELLS} />);
    // Protein is exact; fiber is 27/30 (10% under) — both inside the band.
    expect(getAllByText("On track")).toHaveLength(2);
  });

  it("shows a signed gap for macros outside the band (over = +, under = −)", () => {
    const { getByText, getAllByText } = render(<PlanDayMacroSummary cells={CELLS} />);
    expect(getByText("+30g")).toBeTruthy(); // fat 90 vs 60 target → +30
    expect(getByText("-200g")).toBeTruthy(); // carbs 0 vs 200 target → -200
    // The two off-band cells show a gap; the two close cells still show
    // "On track" (so exactly two of each across the four-cell row).
    expect(getAllByText("On track")).toHaveLength(2);
  });

  it("states the over/under direction in the accessibility label", () => {
    const { getByLabelText } = render(<PlanDayMacroSummary cells={CELLS} />);
    expect(getByLabelText("F 90 grams, 30 over target")).toBeTruthy();
    expect(getByLabelText("C 0 grams, 200 under target")).toBeTruthy();
    expect(getByLabelText("P 150 grams, on track")).toBeTruthy();
  });

  it("rounds fractional grams for display (fiber arrives as a tenth)", () => {
    const { getByText } = render(
      <PlanDayMacroSummary
        cells={[{ label: "Fi", value: 28.6, target: 30, color: "#4A7878" }]}
      />,
    );
    expect(getByText("Fi 29g")).toBeTruthy();
  });

  it("treats a zero target as 'on track' rather than dividing by zero", () => {
    const { getByText, queryByText } = render(
      <PlanDayMacroSummary
        cells={[{ label: "Fi", value: 12, target: 0, color: "#4A7878" }]}
      />,
    );
    // No target → nothing to miss → reads "On track" (pct guarded to 0,
    // which sits inside the close band). No crash, no spurious gap.
    expect(getByText("On track")).toBeTruthy();
    expect(queryByText("+12g")).toBeNull();
  });
});

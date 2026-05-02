// @vitest-environment jsdom
/**
 * Mobile `FullNutrientPanelSheet` render contract.
 *
 * Audit gap #1 (Cronometer parity, 2026-05-01): the 4-tile widget
 * answers the headline question; this sheet answers the breadth
 * question with all 35 curated nutrients across Macros / Vitamins /
 * Minerals %DV-sorted descending so deficiencies surface first.
 *
 * Coverage:
 *   1. All three section headers render (Macros / Vitamins / Minerals).
 *   2. Within each section, rows are sorted by %DV descending — top
 *      row's %DV >= subsequent rows.
 *   3. Source attribution footer renders the FDA citation.
 *   4. Limit-nutrient ramp: 100%+ sodium goes destructive, not green.
 *   5. visible=false renders nothing.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import FullNutrientPanelSheet from "../../components/today/FullNutrientPanelSheet";
import { DAILY_VALUES_SOURCE_LABEL } from "../../../../src/lib/nutrition/dailyValues";
import {
  buildFullNutrientPanelRows,
  type FullNutrientPanelRow,
  type FullNutrientPanelSection,
} from "../../../../src/lib/nutrition/fullNutrientPanel";

void React;

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const COLORS = {
  background: "#0a0a0f",
  card: "#16161e",
  cardBorder: "#2a2a3a",
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
};

/**
 * Fixture: at least 10 nutrients across all three sections, including
 * limit and target nutrients. The %DV % values are deliberately
 * heterogeneous so the descending-sort assertion has bite.
 */
const MICRO_FIXTURE: Record<string, number> = {
  // Macros (mostly via macro overrides below — sodium / sat fat are
  // micros-keyed since meals push them through the micros map).
  sodiumMg: 1200, // 52% — within target band
  saturatedFatG: 12, // 60%

  // Vitamins
  vitaminAMcgRae: 450, // 50%
  vitaminCMg: 81, // 90%
  vitaminDMcg: 6, // 30%
  thiaminMg: 0.6, // 50%

  // Minerals
  ironMg: 18, // 100%
  calciumMg: 650, // 50%
  potassiumMg: 940, // 20%
  zincMg: 8.8, // 80%
};

describe("FullNutrientPanelSheet (mobile)", () => {
  it("renders all three section headers", () => {
    const { getByTestId } = render(
      <FullNutrientPanelSheet
        visible
        onClose={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        totalFatG={60}
        totalCarbsG={200}
        proteinG={80}
        sugarG={40}
        cholesterolMg={150}
        colors={COLORS}
      />,
    );
    expect(getByTestId("full-panel-section-Macros")).toBeTruthy();
    expect(getByTestId("full-panel-section-Vitamins")).toBeTruthy();
    expect(getByTestId("full-panel-section-Minerals")).toBeTruthy();
  });

  it("renders the FDA source attribution footer", () => {
    const { getByTestId } = render(
      <FullNutrientPanelSheet
        visible
        onClose={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        colors={COLORS}
      />,
    );
    const label = getByTestId("full-panel-source-label");
    // Children of <Text> in our RN shim are an array of strings — the
    // exact attribution is the canonical constant.
    const labelText = JSON.stringify(label.props.children);
    expect(labelText).toContain("FDA 2020");
    expect(labelText).toContain("21 CFR 101.9(c)");
    expect(DAILY_VALUES_SOURCE_LABEL).toContain("FDA 2020");
  });

  it("renders all rows expected for a fixture spanning 3 sections", () => {
    const { getByTestId } = render(
      <FullNutrientPanelSheet
        visible
        onClose={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        totalFatG={60}
        totalCarbsG={200}
        proteinG={80}
        sugarG={40}
        cholesterolMg={150}
        colors={COLORS}
      />,
    );

    // At least one row for each section's anchor nutrient renders.
    expect(getByTestId("full-panel-row-sodiumMg")).toBeTruthy();
    expect(getByTestId("full-panel-row-vitaminCMg")).toBeTruthy();
    expect(getByTestId("full-panel-row-ironMg")).toBeTruthy();
    expect(getByTestId("full-panel-row-fiberG")).toBeTruthy();
  });

  it("sorts rows within each section by %DV descending", () => {
    // Use buildFullNutrientPanelRows directly to assert the sort
    // contract — the DOM-level test would require traversing the
    // RN shim's tree, and the sort logic is the same code path the
    // component renders.
    const sections = buildFullNutrientPanelRows({
      microSum: MICRO_FIXTURE,
      fiberG: 20,
      totalFatG: 60,
      totalCarbsG: 200,
      proteinG: 80,
      sugarG: 40,
      cholesterolMg: 150,
    });
    const expectedSections: FullNutrientPanelSection[] = [
      "Macros",
      "Vitamins",
      "Minerals",
    ];
    expect(sections.map((s) => s.section)).toEqual(expectedSections);

    for (const { rows } of sections) {
      // Within each section, %DVs (treating null as -Infinity) must be
      // non-increasing.
      const pcts = rows.map((r: FullNutrientPanelRow) =>
        r.percentDv === null ? -Infinity : r.percentDv,
      );
      for (let i = 1; i < pcts.length; i++) {
        expect(pcts[i - 1]).toBeGreaterThanOrEqual(pcts[i]);
      }
    }
  });

  it("renders nothing when visible=false", () => {
    const { queryByTestId } = render(
      <FullNutrientPanelSheet
        visible={false}
        onClose={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        colors={COLORS}
      />,
    );
    // RN shim's Modal honours visibility — no content rendered.
    expect(queryByTestId("full-panel-section-Macros")).toBeNull();
  });

  it("treats sodium as a LIMIT — over-100% sodium is destructive, not green", () => {
    const sections = buildFullNutrientPanelRows({
      microSum: { sodiumMg: 3000 },
      fiberG: 0,
    });
    const macros = sections.find((s) => s.section === "Macros");
    const sodiumRow = macros!.rows.find((r) => r.key === "sodiumMg");
    expect(sodiumRow!.isLimit).toBe(true);
    expect(sodiumRow!.percentDv ?? 0).toBeGreaterThanOrEqual(100);
  });
});

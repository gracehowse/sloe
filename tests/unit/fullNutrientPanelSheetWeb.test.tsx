// @vitest-environment jsdom
/**
 * Web `FullNutrientPanelSheet` render contract.
 *
 * Mirrors `apps/mobile/tests/unit/fullNutrientPanelSheet.test.tsx`.
 * Audit gap #1 (Cronometer parity, 2026-05-01).
 *
 * Coverage:
 *   1. All three section headers render when open.
 *   2. Source attribution footer renders the FDA citation.
 *   3. open=false renders nothing (Radix unmounts portal content).
 *   4. Sort: target nutrients ascending, limit nutrients descending (shared row-builder).
 *   5. Limit-nutrient ramp: sodium row carries `isLimit=true`.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FullNutrientPanelSheet } from "../../src/app/components/suppr/full-nutrient-panel-sheet";
import {
  buildFullNutrientPanelRows,
  type FullNutrientPanelSection,
  type FullNutrientPanelRow,
} from "../../src/lib/nutrition/fullNutrientPanel";

void React;

const MICRO_FIXTURE: Record<string, number> = {
  sodiumMg: 1200,
  saturatedFatG: 12,
  vitaminAMcgRae: 450,
  vitaminCMg: 81,
  vitaminDMcg: 6,
  thiaminMg: 0.6,
  ironMg: 18,
  calciumMg: 650,
  potassiumMg: 940,
  zincMg: 8.8,
};

describe("FullNutrientPanelSheet (web)", () => {
  it("renders all three section headers when open", () => {
    render(
      <FullNutrientPanelSheet
        open
        onOpenChange={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        totalFatG={60}
        totalCarbsG={200}
        proteinG={80}
        sugarG={40}
        cholesterolMg={150}
      />,
    );
    expect(screen.getByTestId("full-panel-section-Macros")).toBeTruthy();
    expect(screen.getByTestId("full-panel-section-Vitamins")).toBeTruthy();
    expect(screen.getByTestId("full-panel-section-Minerals")).toBeTruthy();
  });

  it("renders the FDA source attribution footer", () => {
    render(
      <FullNutrientPanelSheet
        open
        onOpenChange={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
      />,
    );
    const footer = screen.getByTestId("full-panel-source-label");
    expect(footer.textContent).toMatch(/FDA 2020/);
    expect(footer.textContent).toMatch(/21 CFR 101\.9\(c\)/);
  });

  it("renders rows for nutrients spanning macros / vitamins / minerals", () => {
    render(
      <FullNutrientPanelSheet
        open
        onOpenChange={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
        totalFatG={60}
        totalCarbsG={200}
        proteinG={80}
        sugarG={40}
        cholesterolMg={150}
      />,
    );
    expect(screen.getByTestId("full-panel-row-sodiumMg")).toBeTruthy();
    expect(screen.getByTestId("full-panel-row-vitaminCMg")).toBeTruthy();
    expect(screen.getByTestId("full-panel-row-ironMg")).toBeTruthy();
    expect(screen.getByTestId("full-panel-row-fiberG")).toBeTruthy();
  });

  it("does not render dialog content when open=false", () => {
    render(
      <FullNutrientPanelSheet
        open={false}
        onOpenChange={() => undefined}
        microSum={MICRO_FIXTURE}
        fiberG={20}
      />,
    );
    expect(screen.queryByTestId("full-panel-section-Macros")).toBeNull();
  });

  it("sorts target rows ascending and limit rows descending within each section", () => {
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
      const targets = rows.filter((r) => !r.isLimit && r.percentDv !== null);
      const limits = rows.filter((r) => r.isLimit && r.percentDv !== null);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i - 1].percentDv!).toBeLessThanOrEqual(targets[i].percentDv!);
      }
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i - 1].percentDv!).toBeGreaterThanOrEqual(limits[i].percentDv!);
      }
    }
  });

  it("flags sodium as a limit so the colour ramp can switch on overshoot", () => {
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

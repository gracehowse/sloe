// @vitest-environment jsdom
/**
 * ProgressEnergyTriad → equation layout (ENG-1225 #23). Behind
 * `sloe_v3_energy_equation`: intake − maintenance = deficit/day (maintenance
 * sage, deficit plum) + a "How maintenance works" explainer. Flag-off keeps the
 * 3-cell triad.
 */
import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressEnergyTriad } from "../../src/app/components/suppr/progress-energy-triad";

void React;

function forceEquation(on: boolean) {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    sloe_v3_energy_equation: on,
  };
}

function forceSemanticStats(equation: boolean) {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    sloe_v3_energy_equation: equation,
    semantic_stat_roles_v1: true,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("ProgressEnergyTriad equation layout", () => {
  it("flag-off renders the 3-cell triad, not the equation", () => {
    forceEquation(false);
    const { queryByTestId } = render(
      <ProgressEnergyTriad avgIntakeKcal={1800} maintenanceKcal={2200} isAdaptive />,
    );
    expect(queryByTestId("progress-energy-triad")).not.toBeNull();
    expect(queryByTestId("progress-energy-equation")).toBeNull();
  });

  it("flag-on renders the equation with the right values + result", () => {
    forceEquation(true);
    const { getByTestId, container } = render(
      <ProgressEnergyTriad avgIntakeKcal={1800} maintenanceKcal={2200} isAdaptive />,
    );
    expect(getByTestId("progress-energy-equation")).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("1,800");
    expect(text).toContain("2,200");
    expect(text).toContain("−400"); // 2200 − 1800 deficit
    expect(text).toContain("Deficit/day");
  });

  it("surplus shows the +amount and 'Surplus/day'", () => {
    forceEquation(true);
    const { container } = render(
      <ProgressEnergyTriad avgIntakeKcal={2400} maintenanceKcal={2200} isAdaptive={false} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("+200");
    expect(text).toContain("Surplus/day");
  });

  it("the 'How maintenance works' explainer expands on click", () => {
    forceEquation(true);
    const { getByTestId, container } = render(
      <ProgressEnergyTriad avgIntakeKcal={1800} maintenanceKcal={2200} isAdaptive />,
    );
    expect(container.textContent).not.toContain("what you'd burn on a normal day");
    fireEvent.click(getByTestId("progress-energy-how"));
    expect(container.textContent).toContain("what you'd burn on a normal day");
    expect(container.textContent).toContain("adaptive estimate");
  });

  it("keeps sibling triad numerals ink and moves state into indicators", () => {
    forceSemanticStats(false);
    const { getByTestId, container } = render(
      <ProgressEnergyTriad avgIntakeKcal={1800} maintenanceKcal={2200} isAdaptive />,
    );
    expect(getByTestId("progress-energy-tdee-value")).toHaveStyle({ color: "var(--foreground)" });
    expect(getByTestId("progress-energy-deficit-value")).toHaveStyle({ color: "var(--foreground)" });
    expect(container.querySelectorAll(".rounded-full").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps equation values ink while state is carried by label dots", () => {
    forceSemanticStats(true);
    const { getByTestId } = render(
      <ProgressEnergyTriad avgIntakeKcal={1800} maintenanceKcal={2200} isAdaptive />,
    );
    const equation = getByTestId("progress-energy-equation");
    expect(equation.querySelectorAll(".text-foreground")).toHaveLength(3);
    expect(equation.querySelectorAll(".rounded-full")).toHaveLength(2);
  });
});

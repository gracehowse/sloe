// @vitest-environment jsdom
/**
 * ENG-1665 — Plan anatomy owner migrations behind `ui_anatomy_owners_v1`.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((_flag: string) => false),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
  bootstrapAnalytics: vi.fn(),
  isFeatureEnabled: isFeatureEnabledSpy,
  isFeatureDisabled: vi.fn(() => false),
}));

import { AdjustConstraintsSheet } from "../../components/plan/AdjustConstraintsSheet";
import { PlanSourceSelector } from "../../components/plan/PlanSourceSelector";
import { UI_ANATOMY_OWNERS_V1 } from "@/lib/uiAnatomyOwners";

void React;

const baseConstraints = {
  source: "library_and_discovery" as const,
  calorieFloor: 1800,
  mealsPerDay: 3 as const,
  allowBatchLeftovers: true,
};

describe("Plan anatomy owners (ENG-1665)", () => {
  beforeEach(() => {
    isFeatureEnabledSpy.mockReset();
    isFeatureEnabledSpy.mockImplementation(() => false);
  });

  it("AdjustConstraintsSheet uses legacy modal when flag is off", () => {
    const { queryByTestId } = render(
      <AdjustConstraintsSheet
        visible
        onClose={vi.fn()}
        initial={baseConstraints}
        libraryCount={2}
        discoverCount={3}
        onSave={vi.fn()}
      />,
    );
    expect(queryByTestId("adjust-constraints-sheet")).toBeNull();
  });

  it("AdjustConstraintsSheet uses SheetShell owner when flag is on", () => {
    isFeatureEnabledSpy.mockImplementation((flag) => flag === UI_ANATOMY_OWNERS_V1);
    const { getByTestId } = render(
      <AdjustConstraintsSheet
        visible
        onClose={vi.fn()}
        initial={baseConstraints}
        libraryCount={2}
        discoverCount={3}
        onSave={vi.fn()}
      />,
    );
    expect(getByTestId("adjust-constraints-sheet")).toBeTruthy();
  });

  it("PlanSourceSelector renders CountBadge when flag is on", () => {
    isFeatureEnabledSpy.mockImplementation((flag) => flag === UI_ANATOMY_OWNERS_V1);
    const { getByTestId } = render(
      <PlanSourceSelector
        mode="library"
        onChange={vi.fn()}
        libraryCount={2}
        discoverCount={5}
      />,
    );
    expect(getByTestId("plan-source-count-library")).toBeTruthy();
  });

  it("PlanSourceSelector keeps legacy count pill when flag is off", () => {
    const { queryByTestId, getByLabelText } = render(
      <PlanSourceSelector
        mode="library"
        onChange={vi.fn()}
        libraryCount={2}
        discoverCount={5}
      />,
    );
    expect(queryByTestId("plan-source-count-library")).toBeNull();
    expect(getByLabelText("My library, 2 recipes")).toBeTruthy();
  });
});

// @vitest-environment jsdom
/**
 * PlanMealFilterChipsV3 + PlanHouseholdBannerV3 (ENG-1225 Block 2) — WEB parity
 * twins of the meal-filter chip row and household context banner. Mirrors
 * `apps/mobile/tests/unit/planFilterAndHouseholdV3.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanMealFilterChipsV3 } from "../../src/app/components/plan/PlanMealFilterChipsV3";
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdMember,
} from "../../src/app/components/plan/PlanHouseholdBannerV3";

void React;

describe("PlanMealFilterChipsV3 (web)", () => {
  it("renders all five chips with 'All meals' label", () => {
    const { getByLabelText } = render(
      <PlanMealFilterChipsV3 selected="All" onSelect={() => {}} />,
    );
    for (const l of ["All meals", "Breakfast", "Lunch", "Dinner", "Snack"]) {
      expect(getByLabelText(l)).not.toBeNull();
    }
  });

  it("marks the selected chip + fires onSelect with the filter key", () => {
    const onSelect = vi.fn();
    const { getByLabelText } = render(
      <PlanMealFilterChipsV3 selected="Lunch" onSelect={onSelect} />,
    );
    expect(getByLabelText("Lunch").getAttribute("aria-pressed")).toBe("true");
    expect(getByLabelText("All meals").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(getByLabelText("Dinner"));
    expect(onSelect).toHaveBeenCalledWith("Dinner");
  });

  it("selection is the shared \u00a77 FilterChip soft tint \u2014 no solid var(--primary) fill (chip ruling 2026-07-10, source pin)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/app/components/plan/PlanMealFilterChipsV3.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from "\.\.\/ui\/filter-chip"/);
    expect(src).not.toMatch(/var\(--primary\)/);
    expect(src).not.toMatch(/bg-primary(?!-soft)/);
  });
});

const members: PlanHouseholdMember[] = [
  { initial: "G", isOwner: true },
  { initial: "S", isOwner: false },
  { initial: "M", isOwner: false },
];

describe("PlanHouseholdBannerV3 (web)", () => {
  it("renders the cooking-for line + avatars + a chevron when matched", () => {
    const { getByText } = render(
      <PlanHouseholdBannerV3
        members={members}
        servingCount={3}
        names="Grace, Sam, Mia"
        mismatchEaters={null}
        onPress={() => {}}
      />,
    );
    expect(getByText("Cooking for 3 · Grace, Sam, Mia")).not.toBeNull();
    expect(getByText("G")).not.toBeNull();
    expect(getByText("M")).not.toBeNull();
  });

  it("shows the mismatch flag when servings ≠ eaters + fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanHouseholdBannerV3
        members={members}
        servingCount={2}
        names="Grace, Sam, Mia"
        mismatchEaters={3}
        onPress={onPress}
      />,
    );
    expect(getByText("3× — match")).not.toBeNull();
    fireEvent.click(getByLabelText(/Cooking for 2/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

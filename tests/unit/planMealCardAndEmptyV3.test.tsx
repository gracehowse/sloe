// @vitest-environment jsdom
/**
 * PlanMealCardV3 + PlanEmptySlotV3 (ENG-1225 Block 3) — WEB parity twins of the
 * per-slot meal card and dashed empty-slot row. Mirrors
 * `apps/mobile/tests/unit/planMealCardAndEmptyV3.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanMealCardV3 } from "../../src/app/components/plan/PlanMealCardV3";
import { PlanEmptySlotV3 } from "../../src/app/components/plan/PlanEmptySlotV3";

void React;

describe("PlanMealCardV3 (web)", () => {
  it("renders slot, name, kcal + fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanMealCardV3
        slot="Lunch"
        name="Tahini bowl"
        kcal={520}
        onPress={onPress}
      />,
    );
    expect(getByText("Lunch")).not.toBeNull();
    expect(getByText("Tahini bowl")).not.toBeNull();
    expect(getByText("520 kcal")).not.toBeNull();
    fireEvent.click(getByLabelText("Lunch: Tahini bowl"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a lock badge when locked and a Batch chip for a batch note", () => {
    const { getByText, getByLabelText } = render(
      <PlanMealCardV3
        slot="Dinner"
        name="Sunday roast"
        kcal={640}
        isLocked
        note="batch"
      />,
    );
    expect(getByLabelText("Locked")).not.toBeNull();
    expect(getByText("Batch")).not.toBeNull();
  });

  it("renders '—' when kcal is null", () => {
    const { getByText } = render(
      <PlanMealCardV3 slot="Breakfast" name="Mystery meal" kcal={null} />,
    );
    expect(getByText("—")).not.toBeNull();
  });

  it("is disabled (no onPress) when no handler is provided", () => {
    const { getByLabelText } = render(
      <PlanMealCardV3 slot="Lunch" name="Static card" kcal={300} />,
    );
    expect(getByLabelText("Lunch: Static card")).toHaveProperty("disabled", true);
  });
});

describe("PlanEmptySlotV3 (web)", () => {
  it("renders the slot + 'Add {slot}' and fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanEmptySlotV3 slot="Dinner" onPress={onPress} />,
    );
    expect(getByText("Dinner")).not.toBeNull();
    expect(getByText("Add dinner")).not.toBeNull();
    fireEvent.click(getByLabelText("Add dinner"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

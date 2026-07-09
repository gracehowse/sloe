// @vitest-environment jsdom
/**
 * PlanMealCardV3 + PlanEmptySlotV3 (ENG-1225 Block 3) — WEB parity twins of the
 * per-slot meal card and dashed empty-slot row. Mirrors
 * `apps/mobile/tests/unit/planMealCardAndEmptyV3.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ENG-1417 — mutable per-test override, defaults OFF (kill switch) so every
// other test in this file keeps asserting the exact pre-ENG-1417 bare kcal.
let kcalTrustQualifierOn = false;
vi.mock("../../src/lib/analytics/track.ts", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "kcal_trust_qualifier_v1" ? kcalTrustQualifierOn : false,
}));

import { PlanMealCardV3 } from "../../src/app/components/plan/PlanMealCardV3";
import { PlanEmptySlotV3 } from "../../src/app/components/plan/PlanEmptySlotV3";

void React;

describe("PlanMealCardV3 (web)", () => {
  it("flag OFF: renders the bare kcal regardless of isVerified (ENG-1417)", () => {
    kcalTrustQualifierOn = false;
    const { getByText, queryByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={false} />,
    );
    expect(getByText("520 kcal")).not.toBeNull();
    expect(queryByText("~520 kcal")).toBeNull();
  });

  it("flag ON + unverified: prefixes the kcal with '~' (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={false} />,
    );
    expect(getByText("~520 kcal")).not.toBeNull();
  });

  it("flag ON + verified: renders the bare kcal, no qualifier (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText, queryByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={true} />,
    );
    expect(getByText("520 kcal")).not.toBeNull();
    expect(queryByText("~520 kcal")).toBeNull();
  });

  it("flag ON + isVerified absent: treats it as unverified — safe default (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} />,
    );
    expect(getByText("~520 kcal")).not.toBeNull();
  });

  it("renders slot, name, kcal + fires onPress", () => {
    kcalTrustQualifierOn = false;
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

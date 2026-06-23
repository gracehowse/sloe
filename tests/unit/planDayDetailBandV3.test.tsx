// @vitest-environment jsdom
/**
 * PlanDayDetailBandV3 (ENG-1225 Block 2) — WEB parity twin. Pins the day label,
 * the kcal/target line, the shared-helper subline, the bar width, and the
 * optional macro mini-stat row. Mirrors
 * `apps/mobile/tests/unit/planDayDetailBandV3.test.tsx`.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanDayDetailBandV3 } from "../../src/app/components/plan/PlanDayDetailBandV3";

void React;

describe("PlanDayDetailBandV3 (web)", () => {
  it("renders the day label, kcal/target, gap subline + macros", () => {
    const { getByText, getByTestId } = render(
      <PlanDayDetailBandV3
        dayLabel="Thursday 19"
        dayTotalKcal={1490}
        targetKcal={1830}
        plannedCount={3}
        cookedCount={0}
        macros={{ protein: 99, carbs: 121, fat: 42 }}
      />,
    );
    expect(getByText("Thursday 19")).not.toBeNull();
    expect(getByText("1,490")).not.toBeNull();
    expect(getByText(/\/ 1,830/)).not.toBeNull();
    expect(getByText("≈340 kcal short — room for more")).not.toBeNull();
    expect(getByText(/P 99g\s+C 121g\s+F 42g/)).not.toBeNull();
    // 1490 / 1830 ≈ 81% bar fill (shared computePlanDayDetail).
    const band = getByTestId("plan-day-detail-band");
    const bar = band.querySelector<HTMLElement>('[style*="width"]');
    expect(bar?.style.width).toBe("81%");
  });

  it("omits the macro row when macros is null + shows the empty subline", () => {
    const { queryByText, getByText } = render(
      <PlanDayDetailBandV3
        dayLabel="Friday 20"
        dayTotalKcal={0}
        targetKcal={1830}
        plannedCount={0}
        cookedCount={0}
        macros={null}
      />,
    );
    expect(getByText("Nothing planned yet")).not.toBeNull();
    expect(queryByText(/P \d+g/)).toBeNull();
  });
});

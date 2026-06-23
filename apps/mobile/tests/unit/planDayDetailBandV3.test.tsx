// @vitest-environment jsdom
/**
 * PlanDayDetailBandV3 (ENG-1225 Block 2) — the v3 Plan day-detail calorie band.
 * Pins the day label, the kcal/target line, the shared-helper subline, and the
 * optional macro pill row.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
    backgroundSecondary: "#F5F4F7",
  }),
}));

import { PlanDayDetailBandV3 } from "../../components/plan/PlanDayDetailBandV3";

describe("PlanDayDetailBandV3", () => {
  it("renders the day label, kcal/target, gap subline + macros", () => {
    const { getByText } = render(
      <PlanDayDetailBandV3
        dayLabel="Thursday 19"
        dayTotalKcal={1490}
        targetKcal={1830}
        plannedCount={3}
        cookedCount={0}
        macros={{ protein: 99, carbs: 121, fat: 42 }}
      />,
    );
    expect(getByText("Thursday 19")).toBeTruthy();
    expect(getByText("1,490")).toBeTruthy();
    expect(getByText(/\/ 1,830/)).toBeTruthy();
    expect(getByText("≈340 kcal short — room for more")).toBeTruthy();
    expect(getByText(/P 99g\s+C 121g\s+F\s+42g/)).toBeTruthy();
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
    expect(getByText("Nothing planned yet")).toBeTruthy();
    expect(queryByText(/P \d+g/)).toBeNull();
  });
});

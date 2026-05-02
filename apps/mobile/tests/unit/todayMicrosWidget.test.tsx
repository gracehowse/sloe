// @vitest-environment jsdom
/**
 * TodayMicrosWidget — pin the 4-tile micros widget rendering.
 *
 * Coverage:
 *  - 4 tiles render with the canonical labels (Fiber / Iron / Vit D / Sodium).
 *  - %DV math from `dailyValuePercent` flows through to the caption.
 *  - Sodium colour ramp: success below 80%, warning 80%-99%, danger 100%+.
 *  - Empty `microSum` renders 0% across all tiles.
 *
 * Web parity pinned by `tests/unit/todayMicrosWidgetWeb.test.tsx`.
 */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayMicrosWidget } from "../../components/today/TodayMicrosWidget";
import { Accent } from "../../constants/theme";

void React;

const BASE_PROPS = {
  cardColor: "#111",
  cardBorderColor: "#222",
  textColor: "#fff",
  textSecondaryColor: "#aaa",
  textTertiaryColor: "#888",
};

describe("TodayMicrosWidget", () => {
  it("renders the four headline nutrient tiles", () => {
    const { getByText, getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ ironMg: 9, vitaminDMcg: 10, sodiumMg: 1150 }}
        fiberG={14}
        {...BASE_PROPS}
      />,
    );
    expect(getByText("Fiber")).toBeTruthy();
    expect(getByText("Iron")).toBeTruthy();
    expect(getByText("Vit D")).toBeTruthy();
    expect(getByText("Sodium")).toBeTruthy();

    expect(getByTestId("today-micros-tile-fiberG")).toBeTruthy();
    expect(getByTestId("today-micros-tile-ironMg")).toBeTruthy();
    expect(getByTestId("today-micros-tile-vitaminDMcg")).toBeTruthy();
    expect(getByTestId("today-micros-tile-sodiumMg")).toBeTruthy();
  });

  it("computes %DV and renders the caption (50% across all tiles)", () => {
    const { getAllByText } = render(
      <TodayMicrosWidget
        microSum={{ ironMg: 9, vitaminDMcg: 10, sodiumMg: 1150 }}
        fiberG={14}
        {...BASE_PROPS}
      />,
    );
    // Each of the 4 tiles is at exactly 50% DV under the inputs above.
    expect(getAllByText("50% DV")).toHaveLength(4);
  });

  it("paints sodium green at 50% DV (well below the 80% warning gate)", () => {
    const { getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ sodiumMg: 1150 }}
        fiberG={0}
        {...BASE_PROPS}
      />,
    );
    const fill = getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.props.style).toMatchObject({ backgroundColor: Accent.success });
  });

  it("paints sodium amber at 80% DV (warning gate)", () => {
    const { getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ sodiumMg: 1840 }} // 1840 / 2300 = 80%
        fiberG={0}
        {...BASE_PROPS}
      />,
    );
    const fill = getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.props.style).toMatchObject({ backgroundColor: Accent.warning });
  });

  it("paints sodium amber at 99% DV (still warning, not danger)", () => {
    const { getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ sodiumMg: 2277 }} // 2277 / 2300 = 99%
        fiberG={0}
        {...BASE_PROPS}
      />,
    );
    const fill = getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.props.style).toMatchObject({ backgroundColor: Accent.warning });
  });

  it("paints sodium red at 100% DV (limit reached)", () => {
    const { getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ sodiumMg: 2300 }}
        fiberG={0}
        {...BASE_PROPS}
      />,
    );
    const fill = getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.props.style).toMatchObject({ backgroundColor: Accent.destructive });
  });

  it("paints sodium red at 120% DV (over limit) and caps the bar fill at 100%", () => {
    const { getByTestId, getByText } = render(
      <TodayMicrosWidget
        microSum={{ sodiumMg: 2760 }} // 2760 / 2300 = 120%
        fiberG={0}
        {...BASE_PROPS}
      />,
    );
    const fill = getByTestId("today-micros-bar-fill-sodiumMg");
    expect(fill.props.style).toMatchObject({
      backgroundColor: Accent.destructive,
      width: "100%", // bar capped, but caption tells the truth
    });
    expect(getByText("120% DV")).toBeTruthy();
  });

  it("keeps non-limit nutrients green even when over target", () => {
    const { getByTestId } = render(
      <TodayMicrosWidget
        microSum={{ ironMg: 36 }} // 200% DV
        fiberG={56} // 200% DV
        {...BASE_PROPS}
      />,
    );
    const ironFill = getByTestId("today-micros-bar-fill-ironMg");
    const fiberFill = getByTestId("today-micros-bar-fill-fiberG");
    expect(ironFill.props.style).toMatchObject({ backgroundColor: Accent.success });
    expect(fiberFill.props.style).toMatchObject({ backgroundColor: Accent.success });
  });

  it("renders 0% across all tiles when microSum is empty and fiber is zero", () => {
    const { getAllByText } = render(
      <TodayMicrosWidget microSum={{}} fiberG={0} {...BASE_PROPS} />,
    );
    expect(getAllByText("0% DV")).toHaveLength(4);
  });

  it("treats null microSum as empty (defensive)", () => {
    const { getAllByText } = render(
      <TodayMicrosWidget microSum={null} fiberG={0} {...BASE_PROPS} />,
    );
    expect(getAllByText("0% DV")).toHaveLength(4);
  });
});

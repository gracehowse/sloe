// @vitest-environment jsdom
/**
 * `GradientAvatar` — default ink fill; `variant="brand"` for marketing.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { Stop } from "react-native-svg";
import { GradientAvatar } from "../../components/GradientAvatar";
import { Brand } from "../../constants/theme";

void React;

describe("GradientAvatar", () => {
  it("renders the initial character", () => {
    const { getByText } = render(
      <GradientAvatar
        size={52}
        initial="G"
        fontSize={18}
        gradientIdSuffix="test-1"
      />,
    );
    expect(getByText("G")).toBeTruthy();
  });

  it("default ink variant does not emit brand gradient stops", () => {
    const { UNSAFE_queryAllByType } = render(
      <GradientAvatar
        size={40}
        initial="G"
        fontSize={14}
        gradientIdSuffix="test-ink"
      />,
    );
    expect(UNSAFE_queryAllByType(Stop).length).toBe(0);
  });

  it("brand variant uses canonical gradient endpoints #4c6ce0 → #e04888", () => {
    expect(Brand.primary.toLowerCase()).toBe("#4c6ce0");
    expect(Brand.accent.toLowerCase()).toBe("#e04888");

    const { UNSAFE_getAllByType } = render(
      <GradientAvatar
        size={40}
        initial="G"
        fontSize={14}
        gradientIdSuffix="test-brand"
        variant="brand"
      />,
    );
    const stops = UNSAFE_getAllByType(Stop);
    const colors = stops.map(
      (s: { props: { stopColor?: string } }) => s.props.stopColor,
    );
    expect(colors).toContain("#4c6ce0");
    expect(colors).toContain("#e04888");
  });
});

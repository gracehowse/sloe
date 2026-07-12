// @vitest-environment jsdom
/**
 * `GradientAvatar` — default identity fill = solid damson (`Accent.purple`,
 * S5 avatar ruling 2026-07-10, ENG-1375); `variant="brand"` for marketing.
 */
import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { Stop } from "react-native-svg";
import { GradientAvatar } from "../../components/GradientAvatar";
import { Accent, Brand } from "../../constants/theme";

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

  it("default identity variant does not emit brand gradient stops", () => {
    const { UNSAFE_queryAllByType } = render(
      <GradientAvatar
        size={40}
        initial="G"
        fontSize={14}
        gradientIdSuffix="test-identity"
      />,
    );
    expect(UNSAFE_queryAllByType(Stop).length).toBe(0);
  });

  it("identity default fill is solid damson (Accent.purple), not grey ink", () => {
    // S5 (ENG-1375): the grey-ink default is retired — ONE identity fill,
    // matching web `--avatar-identity` / `ui/avatar-disc.tsx`. Pinned at
    // source level (render-tree style flattening is renderer-dependent).
    expect(Accent.purple.toLowerCase()).toBe("#6a4b7a");
    const src = readFileSync(
      resolve(__dirname, "../../components/GradientAvatar.tsx"),
      "utf8",
    );
    expect(src).toContain("fill ?? Accent.purple");
    expect(src).not.toContain("fill ?? colors.icon");
  });

  it("brand variant uses canonical gradient endpoints #588CE4 → #DF5EBC", () => {
    // 2026-05-22 evening: 8-slot palette lock. Brand gradient endpoints
    // updated from TF49 hexes (#4c6ce0 / #e04888) to the 8-slot Blue +
    // Magenta hexes.
    expect(Brand.primary.toLowerCase()).toBe("#588ce4");
    expect(Brand.accent.toLowerCase()).toBe("#df5ebc");

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
    expect(colors).toContain("#588CE4");
    expect(colors).toContain("#DF5EBC");
  });
});

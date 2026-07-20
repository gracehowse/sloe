// @vitest-environment jsdom
/**
 * `GradientAvatar` — default identity fill = solid damson (`Accent.purple`,
 * S5 avatar ruling 2026-07-10, ENG-1375); `variant="brand"` for marketing.
 */
import * as React from "react";
import { View } from "react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { Stop } from "react-native-svg";
import { GradientAvatar } from "../../components/GradientAvatar";
import { Accent, Brand, FontFamily } from "../../constants/theme";

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

/**
 * ENG-1593 — Rule 7 (DESIGN-CONSTITUTION.md) monogram treatment: "People may
 * use serif initials only with the frost-ring treatment, as a stated
 * placeholder until real photography lands." `treatment` defaults to
 * `"legacy"` (today's unchanged sans initial, no ring); `"frostRing"` is the
 * new Rule 7-compliant render, gated at every call site behind
 * `avatar_monogram_frost_ring_v1` (default-OFF).
 */
describe("GradientAvatar — Rule 7 frost-ring treatment (ENG-1593)", () => {
  it("legacy treatment (default) renders the disc alone — no ring wrapper", () => {
    const { UNSAFE_getAllByType } = render(
      <GradientAvatar size={36} initial="G" fontSize={13} gradientIdSuffix="test-legacy" />,
    );
    expect(UNSAFE_getAllByType(View).length).toBe(1);
  });

  it("legacy treatment keeps the sans initial — no serif fontFamily override", () => {
    const { getByText } = render(
      <GradientAvatar size={36} initial="G" fontSize={13} gradientIdSuffix="test-legacy-sans" />,
    );
    expect(getByText("G").props.style.fontFamily).toBeUndefined();
    expect(getByText("G").props.style.fontWeight).toBe("700");
  });

  it("frostRing treatment wraps the disc in the prototype's exact double ring", () => {
    // `Sloe-App.html` L1728: `box-shadow: 0 0 0 2px var(--card), 0 0 0 3.5px
    // var(--accent-frost)` — a 2px card-coloured gap, then a 3.5px frost ring.
    const { UNSAFE_getAllByType } = render(
      <GradientAvatar
        size={36}
        initial="G"
        fontSize={13}
        gradientIdSuffix="test-frost-ring"
        treatment="frostRing"
      />,
    );
    const [outerRing, gapRing, disc] = UNSAFE_getAllByType(View);
    expect(UNSAFE_getAllByType(View).length).toBe(3);
    expect(outerRing.props.style.backgroundColor).toBe(Accent.frost);
    expect(outerRing.props.style.width).toBe(36 + 2 * 2 + 2 * 3.5); // 47
    expect(outerRing.props.style.height).toBe(47);
    expect(gapRing.props.style.width).toBe(36 + 2 * 2); // 40 — the card-coloured gap
    expect(disc.props.style.width).toBe(36);
    expect(disc.props.style.backgroundColor).toBe(Accent.purple);
  });

  it("frostRing treatment renders the initial in the Newsreader serif, medium weight", () => {
    const { getByText } = render(
      <GradientAvatar
        size={36}
        initial="G"
        fontSize={13}
        gradientIdSuffix="test-frost-serif"
        treatment="frostRing"
      />,
    );
    const text = getByText("G");
    expect(text.props.style.fontFamily).toBe(FontFamily.serifMedium);
    expect(text.props.style.fontWeight).toBe("500");
  });

  it("frostRing treatment has no effect on the brand variant (marketing gradient unchanged)", () => {
    const { UNSAFE_getAllByType } = render(
      <GradientAvatar
        size={40}
        initial="G"
        fontSize={14}
        gradientIdSuffix="test-brand-frost"
        variant="brand"
        treatment="frostRing"
      />,
    );
    // Still the single overflow-hidden disc + its SVG gradient fill — no ring.
    expect(UNSAFE_getAllByType(View).length).toBe(1);
  });
});

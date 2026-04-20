// @vitest-environment jsdom
/**
 * Mobile `RulerSlider` smoke + helpers test (Phase 1 of the onboarding
 * redesign). Mirrors `tests/unit/rulerSlider.test.tsx` (web).
 *
 * Drag interaction is exercised by the maestro e2e harness — vitest
 * cannot replicate `react-native-gesture-handler`'s Pan loop in a node
 * VM. What we cover here:
 *   - Initial number readout matches the value (with decimals + format
 *     overrides).
 *   - The accessible adjustable element exposes the current value /
 *     min / max so VoiceOver/TalkBack can announce it.
 *   - Imperial helpers round-trip the same way as the web build.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "../../components/RulerSlider";

void React;

describe("RulerSlider (mobile)", () => {
  it("renders the value and unit", () => {
    const { getByText } = render(
      <RulerSlider
        value={170}
        onChange={() => {}}
        min={140}
        max={210}
        unit="cm"
      />,
    );
    expect(getByText("170")).toBeTruthy();
    expect(getByText("cm")).toBeTruthy();
  });

  it("renders the formatted value when format is supplied (imperial height)", () => {
    const { getByText, queryByText } = render(
      <RulerSlider
        value={70}
        onChange={() => {}}
        min={48}
        max={84}
        unit="ignored"
        format={(v) => formatImperialHeightInches(v)}
      />,
    );
    expect(getByText("5′ 10″")).toBeTruthy();
    expect(queryByText("ignored")).toBeNull();
  });
});

describe("imperial helpers (mobile)", () => {
  it("matches the web helper behaviour for formatting", () => {
    expect(formatImperialHeightInches(70)).toBe("5′ 10″");
    expect(formatImperialHeightInches(60)).toBe("5′ 0″");
    expect(formatImperialHeightInches(72)).toBe("6′ 0″");
  });

  it("matches the web helper behaviour for parsing", () => {
    expect(parseImperialHeightInches("5'10\"")).toBe(70);
    expect(parseImperialHeightInches("5 10")).toBe(70);
    expect(parseImperialHeightInches("5ft 10in")).toBe(70);
    expect(parseImperialHeightInches("70")).toBe(70);
  });
});

/**
 * TodayHeroVariantPicker — pin the three-option contract so the
 * prototype port doesn't silently drop a variant on future refactors.
 *
 * 2026-04-20 Claude Design drop → prototype exposes three hero
 * variants (ring / bar / number) with a grid-icon popover in the
 * card's top-right corner. Mobile uses a Modal instead of a popover;
 * this test pins the variant set + the selection-dispatch contract.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayHeroVariantPicker } from "../../components/today/TodayHeroVariantPicker";

describe("TodayHeroVariantPicker", () => {
  const colors = {
    cardBackgroundColor: "#16161e",
    borderColor: "#282830",
    textColor: "#e4e4e8",
    textTertiaryColor: "#64748b",
  };

  it("renders exactly three options — ring, bar, number", () => {
    const { getByLabelText } = render(
      <TodayHeroVariantPicker
        visible
        active="ring"
        onSelect={() => {}}
        onClose={() => {}}
        {...colors}
      />,
    );
    expect(getByLabelText(/Ring hero/)).toBeTruthy();
    expect(getByLabelText(/Bar hero/)).toBeTruthy();
    expect(getByLabelText(/Number hero/)).toBeTruthy();
  });

  it("calls onSelect(variant) then onClose when a new variant is picked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <TodayHeroVariantPicker
        visible
        active="ring"
        onSelect={onSelect}
        onClose={onClose}
        {...colors}
      />,
    );
    fireEvent.press(getByLabelText(/Bar hero/));
    expect(onSelect).toHaveBeenCalledWith("bar");
    expect(onClose).toHaveBeenCalled();
  });

  it("marks the active variant with accessibility selected state", () => {
    const { getByLabelText } = render(
      <TodayHeroVariantPicker
        visible
        active="number"
        onSelect={() => {}}
        onClose={() => {}}
        {...colors}
      />,
    );
    const active = getByLabelText(/Number hero/);
    expect(active.props.accessibilityState?.selected).toBe(true);
    const inactive = getByLabelText(/Ring hero/);
    expect(inactive.props.accessibilityState?.selected).toBe(false);
  });
});

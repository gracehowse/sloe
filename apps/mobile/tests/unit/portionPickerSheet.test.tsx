// @vitest-environment jsdom
/**
 * PortionPickerSheet — replaces the previous `Alert.alert` portion
 * picker on `TodayPlannedMealsCard` (audit 2026-04-30, customer-lens
 * flagged the iOS system alert as prototype-tier mid-flow).
 *
 * Coverage:
 *   1. Renders the four portion options (½×, 1×, 1½×, 2×) when visible.
 *   2. Renders nothing when `visible=false` (Modal honours visibility).
 *   3. Tapping a portion fires `onPick(value)` with the right number
 *      and then `onClose`.
 *   4. Tapping the X button fires `onClose` without firing `onPick`.
 *   5. Tapping Cancel fires `onClose` without firing `onPick`.
 *   6. Header reflects the supplied `mealName`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { PortionPickerSheet } from "../../components/today/PortionPickerSheet";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    card: "#ffffff",
    cardBorder: "#e4e4ec",
    background: "#fafafa",
  }),
}));

describe("PortionPickerSheet (mobile)", () => {
  it("renders all four portion options when visible", () => {
    const { getByText } = render(
      <PortionPickerSheet
        visible
        onClose={() => undefined}
        mealName="Greek yoghurt bowl"
        onPick={() => undefined}
      />,
    );
    expect(getByText("½ ×")).toBeTruthy();
    expect(getByText("1 ×")).toBeTruthy();
    expect(getByText("1½ ×")).toBeTruthy();
    expect(getByText("2 ×")).toBeTruthy();
  });

  it("renders the meal name in the header", () => {
    const { getByText } = render(
      <PortionPickerSheet
        visible
        onClose={() => undefined}
        mealName="Greek yoghurt bowl"
        onPick={() => undefined}
      />,
    );
    expect(getByText("Log Greek yoghurt bowl")).toBeTruthy();
    expect(getByText("How much did you eat?")).toBeTruthy();
  });

  it("renders nothing when visible=false (Modal honours visibility)", () => {
    const { queryByText } = render(
      <PortionPickerSheet
        visible={false}
        onClose={() => undefined}
        mealName="Greek yoghurt bowl"
        onPick={() => undefined}
      />,
    );
    expect(queryByText("How much did you eat?")).toBeNull();
    expect(queryByText("½ ×")).toBeNull();
  });

  it("fires onPick with 0.5 then onClose when ½× is tapped", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={onClose}
        mealName="Greek yoghurt bowl"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("½ × portion"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(0.5);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onPick with 1 when 1× is tapped", () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={() => undefined}
        mealName="x"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("1 × portion"));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("fires onPick with 1.5 when 1½× is tapped", () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={() => undefined}
        mealName="x"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("1½ × portion"));
    expect(onPick).toHaveBeenCalledWith(1.5);
  });

  it("fires onPick with 2 when 2× is tapped", () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={() => undefined}
        mealName="x"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("2 × portion"));
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it("Cancel button fires onClose only — never onPick", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={onClose}
        mealName="x"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("X close button fires onClose only — never onPick", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <PortionPickerSheet
        visible
        onClose={onClose}
        mealName="x"
        onPick={onPick}
      />,
    );
    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});

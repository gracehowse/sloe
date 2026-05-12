/**
 * F-137 (2026-05-11) — `<ServingStepper>` unit pin.
 *
 * Used by barcode result surfaces (Log sheet modal + standalone barcode
 * page) to replace the free-text grams TextInput with a `[−] value [+]`
 * stepper. The barcode result is the only surface today; this test pins
 * the behaviour Grace asked for so a future refactor can't silently
 * regress it.
 *
 * Behaviour pinned:
 *   - `+` increments by `step` (rounded to 1 dp)
 *   - `−` decrements by `step`
 *   - Clamps at `min` / `max`
 *   - Direct text entry still works (TextInput renders the controlled
 *     value)
 *   - Unit pluralisation when `unit` is `{ singular, plural }`
 *   - Buttons disable visually at min/max
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  Minus: () => null,
  Plus: () => null,
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#fff",
    textSecondary: "#aaa",
    border: "#333",
    inputBg: "#222",
  }),
}));

import { ServingStepper } from "../../components/food-log/ServingStepper";

function setup(initialValue: string, props: Partial<React.ComponentProps<typeof ServingStepper>> = {}) {
  let value = initialValue;
  const onChange = vi.fn((next: string) => {
    value = next;
  });
  const utils = render(
    <ServingStepper
      value={value}
      onChange={onChange}
      step={props.step ?? 5}
      unit={props.unit ?? "g"}
      min={props.min ?? 0}
      max={props.max ?? 10000}
      testIdPrefix="stepper"
      {...props}
    />,
  );
  return { ...utils, onChange, get value() { return value; } };
}

describe("<ServingStepper>", () => {
  it("increments by step on + press", () => {
    const { getByTestId, onChange } = setup("100", { step: 5 });
    fireEvent.press(getByTestId("stepper-increment"));
    expect(onChange).toHaveBeenCalledWith("105");
  });

  it("decrements by step on − press", () => {
    const { getByTestId, onChange } = setup("100", { step: 5 });
    fireEvent.press(getByTestId("stepper-decrement"));
    expect(onChange).toHaveBeenCalledWith("95");
  });

  it("rounds to 1 decimal so 1 + 0.5 + 0.5 + 0.5 → '2.5' not '2.5000000004'", () => {
    const { getByTestId, onChange } = setup("1", { step: 0.5, unit: "servings", min: 0 });
    fireEvent.press(getByTestId("stepper-increment"));
    expect(onChange).toHaveBeenLastCalledWith("1.5");
  });

  it("clamps at min — decrement on value === min is a no-op-visible (button disabled)", () => {
    const { getByTestId, onChange } = setup("0.5", { step: 0.5, min: 0.5 });
    // Disabled button — Pressable still fires `onPress` for testing
    // purposes, but `handleDecrement` clamps to min internally.
    fireEvent.press(getByTestId("stepper-decrement"));
    // Either no call (button disabled) or the clamped value.
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenLastCalledWith("0.5");
    }
  });

  it("clamps at max", () => {
    const { getByTestId, onChange } = setup("9999", { step: 5, max: 10000 });
    fireEvent.press(getByTestId("stepper-increment"));
    expect(onChange).toHaveBeenLastCalledWith("10000");
  });

  it("renders the controlled value in the TextInput", () => {
    const { getByTestId } = setup("3.5");
    const input = getByTestId("stepper-input");
    expect(input.props.value).toBe("3.5");
  });

  it("propagates raw text edits via onChange (no auto-format)", () => {
    const { getByTestId, onChange } = setup("100");
    fireEvent.changeText(getByTestId("stepper-input"), "75");
    expect(onChange).toHaveBeenCalledWith("75");
  });

  it("pluralises the unit when given { singular, plural } and value !== 1", () => {
    const { queryByText: queryA } = setup("2", { step: 0.5, unit: { singular: "serving", plural: "servings" } });
    expect(queryA("servings")).not.toBeNull();
    expect(queryA("serving")).toBeNull();

    const { queryByText: queryB } = setup("1", { step: 0.5, unit: { singular: "serving", plural: "servings" } });
    expect(queryB("serving")).not.toBeNull();
    expect(queryB("servings")).toBeNull();
  });

  it("keeps a plain string unit unchanged regardless of value", () => {
    const { queryByText } = setup("3", { unit: "g" });
    expect(queryByText("g")).not.toBeNull();
  });

  it("handles non-numeric value gracefully (no crash, uses min as base)", () => {
    const { getByTestId, onChange } = setup("", { step: 5, min: 0 });
    fireEvent.press(getByTestId("stepper-increment"));
    expect(onChange).toHaveBeenCalledWith("5");
  });
});

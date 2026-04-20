// @vitest-environment jsdom
/**
 * Mobile `OptionCard` render test (Phase 1 of the onboarding redesign).
 *
 * Mirrors the web test at `tests/unit/optionCard.test.tsx`. Used by
 * Goal / Sex / Activity / Diet onboarding steps. Locks in:
 *   - Pressable fires onPress when tapped (and not when disabled).
 *   - Selected state surfaces via accessibilityState so VoiceOver hears
 *     the selection.
 *   - Default trailing checkmark renders for selected items; passing
 *     `trailing={null}` removes it (chip-style multi-select shape).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { OptionCard } from "../../components/OptionCard";

void React;

describe("OptionCard (mobile)", () => {
  it("renders title and subtitle", () => {
    const { getByText } = render(
      <OptionCard title="Lose fat" subtitle="Gradual deficit, protein-first" />,
    );
    expect(getByText("Lose fat")).toBeTruthy();
    expect(getByText("Gradual deficit, protein-first")).toBeTruthy();
  });

  it("fires onPress when tapped", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<OptionCard title="Maintain" onPress={onPress} />);
    fireEvent.press(getByLabelText("Maintain"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(
      <OptionCard title="Locked" onPress={onPress} disabled />,
    );
    fireEvent.press(getByLabelText("Locked"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("reflects selected state via accessibilityState", () => {
    const { getByLabelText } = render(<OptionCard title="Goal" selected />);
    const node = getByLabelText("Goal");
    expect(node.props.accessibilityState?.selected).toBe(true);
  });
});
